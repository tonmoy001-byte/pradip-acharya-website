-- 020_payment-attempts.sql
--
-- Prevent duplicate ebook checkouts and payments.
--
-- 1. payment_attempts table: one active attempt per order (and per user+book),
--    with full status history. payment_events remains the audit log.
-- 2. create_ebook_order: advisory lock + active-order check -> active_order_exists.
-- 3. begin_payment_attempt RPC: atomic claim/reuse/expire of attempts.
-- 4. fulfill_paid_order: never overwrite an existing payment_reference.
-- 5. unique download grant per (order_item, user).
-- 6. Backfill paid/pending orders into payment_attempts.
--
-- Apply only after explicit approval. Idempotent where possible.

BEGIN;

-- ===== a) payment_attempts table =====
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                   uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id                    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id                    text NULL REFERENCES public.books(id),
  provider                   text NOT NULL DEFAULT 'nagorikpay',
  provider_transaction_id    text NULL,
  provider_checkout_id       text NULL,
  status                     text NOT NULL
    CHECK (status IN ('created','pending','paid','failed','expired','duplicate','refund_required','refunded')),
  amount                     numeric(12,2) NOT NULL,
  currency                   text NOT NULL DEFAULT 'BDT',
  payment_url                text NULL,
  duplicate_of_attempt_id    uuid NULL REFERENCES public.payment_attempts(id),
  raw_payload                jsonb NULL,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  expires_at                 timestamptz NULL,
  completed_at               timestamptz NULL
);

-- One active attempt per order.
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_one_active_per_order
  ON public.payment_attempts (order_id)
  WHERE status IN ('created','pending');

-- One active attempt per user+book (single-book checkout).
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_one_active_per_user_book
  ON public.payment_attempts (user_id, book_id)
  WHERE status IN ('created','pending') AND book_id IS NOT NULL;

-- One provider transaction per attempt.
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_provider_txn_key
  ON public.payment_attempts (provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_attempts_order_id_idx
  ON public.payment_attempts (order_id);
CREATE INDEX IF NOT EXISTS payment_attempts_user_id_idx
  ON public.payment_attempts (user_id);
CREATE INDEX IF NOT EXISTS payment_attempts_status_idx
  ON public.payment_attempts (status);

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION public.touch_payment_attempts_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payment_attempts_touch_updated_at ON public.payment_attempts;
CREATE TRIGGER payment_attempts_touch_updated_at
  BEFORE UPDATE ON public.payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.touch_payment_attempts_updated_at();

-- RLS: service/admin only.
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_attempts_admin_select ON public.payment_attempts;
CREATE POLICY payment_attempts_admin_select ON public.payment_attempts
  FOR SELECT USING (is_admin(auth.uid()));

-- GRANTs: keep service role (postgres) full access; authenticated can read own? We keep none for authenticated
-- to avoid leaking attempt metadata; backend uses service client + RPC.
REVOKE ALL ON public.payment_attempts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_attempts TO postgres;

-- ===== b) download_grants: one grant per (order_item, user) =====
CREATE UNIQUE INDEX IF NOT EXISTS download_grants_one_per_item_user
  ON public.download_grants (order_item_id, user_id);

-- ===== c) create_ebook_order: active-order guard + advisory lock + attempt =====
CREATE OR REPLACE FUNCTION public.create_ebook_order(p_items jsonb, p_contact jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_order_id   uuid;
  v_total      numeric := 0;
  v_count      int := 0;
  v_book_id    text;
  v_book       record;
  v_fmt        record;
  v_ref        text;
  v_existing   uuid;
  v_first_book text := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'cart_empty';
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'cart_too_large';
  END IF;

  -- Validate + lock per book first, so concurrent orders for the same book
  -- cannot both pass the active-order / already-owned checks.
  FOR v_book_id IN SELECT DISTINCT jsonb_array_elements_text(p_items) LOOP
    PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || ':' || v_book_id)::bigint);

    SELECT id, title, author INTO v_book FROM books WHERE id = v_book_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'book_not_found:%', v_book_id;
    END IF;

    SELECT id, price, format_name INTO v_fmt
    FROM book_formats
    WHERE book_id = v_book_id AND delivery_type = 'digital' AND available
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ebook_unavailable:%', v_book.title;
    END IF;
    IF v_fmt.price IS NULL OR v_fmt.price < 0 THEN
      RAISE EXCEPTION 'invalid_price:%', v_book.title;
    END IF;

    -- Block buying again only while the customer still has a non-revoked grant.
    IF EXISTS (
      SELECT 1
      FROM order_items oi
      JOIN orders o           ON o.id = oi.order_id
      JOIN download_grants dg ON dg.order_item_id = oi.id
      WHERE o.user_id = v_uid
        AND o.payment_status = 'paid'
        AND oi.book_id = v_book_id
        AND dg.revoked_at IS NULL
    ) THEN
      RAISE EXCEPTION 'already_owned:%', v_book.title;
    END IF;

    -- One active (pending) order per book.
    SELECT o.id INTO v_existing
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.user_id = v_uid
      AND o.payment_status IN ('pending_payment','payment_review','pending_verification')
      AND oi.book_id = v_book_id
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RAISE EXCEPTION 'active_order_exists:%', v_existing;
    END IF;

    IF v_first_book IS NULL THEN v_first_book := v_book_id; END IF;
  END LOOP;

  INSERT INTO orders (user_id, contact, shipping_address, currency, payment_method,
                      payment_status, subtotal, delivery_charge, total, fulfillment_status)
  VALUES (v_uid, p_contact, NULL, 'BDT', 'nagorikpay',
          'pending_payment', 0, 0, 0, 'not_applicable')
  RETURNING id INTO v_order_id;

  FOR v_book_id IN SELECT DISTINCT jsonb_array_elements_text(p_items) LOOP
    SELECT id, title, author INTO v_book FROM books WHERE id = v_book_id;

    SELECT id, price, format_name INTO v_fmt
    FROM book_formats
    WHERE book_id = v_book_id AND delivery_type = 'digital' AND available
    LIMIT 1;

    INSERT INTO order_items (order_id, book_id, format_id, title_snapshot, author_snapshot,
                             format_snapshot, delivery_type_snapshot, quantity,
                             unit_price_snapshot, line_total)
    VALUES (v_order_id, v_book_id, v_fmt.id, v_book.title, v_book.author,
            v_fmt.format_name, 'digital', 1, v_fmt.price, v_fmt.price);

    v_total := v_total + v_fmt.price;
    v_count := v_count + 1;
  END LOOP;

  UPDATE orders SET subtotal = v_total, total = v_total WHERE id = v_order_id;

  -- Free books: settle immediately, no attempt row.
  IF v_total = 0 THEN
    v_ref := 'free-' || v_order_id::text;
    UPDATE orders
       SET payment_status = 'paid', paid_at = now(), payment_reference = v_ref
     WHERE id = v_order_id;
    PERFORM public.fulfill_paid_order(v_order_id, v_ref);
    RETURN jsonb_build_object(
      'order_id', v_order_id, 'subtotal', v_total, 'delivery_charge', 0,
      'total', v_total, 'item_count', v_count, 'digital_only', true,
      'free', true, 'attempt_id', NULL
    );
  END IF;

  -- Create the first (created) attempt atomically with the order.
  INSERT INTO public.payment_attempts (order_id, user_id, book_id, provider, status, amount, currency, expires_at)
  VALUES (v_order_id, v_uid, v_first_book, 'nagorikpay', 'created', v_total, 'BDT', now() + interval '30 minutes')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'order_id', v_order_id, 'subtotal', v_total, 'delivery_charge', 0,
    'total', v_total, 'item_count', v_count, 'digital_only', true,
    'free', false,
    'attempt_id', (SELECT id FROM public.payment_attempts WHERE order_id = v_order_id AND status IN ('created','pending') ORDER BY created_at DESC LIMIT 1)
  );
END;
$$;

-- ===== d) begin_payment_attempt RPC =====
CREATE OR REPLACE FUNCTION public.begin_payment_attempt(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_order     record;
  v_attempt   record;
  v_new_id    uuid;
  v_now       timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;
  IF v_order.user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_order.payment_status IN ('paid','refunded','failed') THEN
    RETURN jsonb_build_object('action','rejected','reason',v_order.payment_status,'order_id',v_order.id);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || ':order:' || p_order_id::text)::bigint);

  -- Expire stale attempts.
  UPDATE public.payment_attempts
     SET status = 'expired', updated_at = v_now
   WHERE order_id = p_order_id
     AND status IN ('created','pending')
     AND (expires_at IS NULL OR expires_at < v_now)
     AND created_at < v_now - interval '10 minutes';

  -- Reuse a live pending attempt that already has a URL.
  SELECT * INTO v_attempt
    FROM public.payment_attempts
   WHERE order_id = p_order_id AND status = 'pending' AND payment_url IS NOT NULL
   ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('action','reuse','attempt_id',v_attempt.id,'payment_url',v_attempt.payment_url,'order_id',v_order.id);
  END IF;

  -- A freshly claimed attempt without a URL yet (another request in flight).
  SELECT * INTO v_attempt
    FROM public.payment_attempts
   WHERE order_id = p_order_id AND status = 'pending' AND payment_url IS NULL
     AND created_at > v_now - interval '2 minutes'
   ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('action','in_progress','attempt_id',v_attempt.id,'order_id',v_order.id);
  END IF;

  -- Claim a 'created' attempt.
  SELECT * INTO v_attempt
    FROM public.payment_attempts
   WHERE order_id = p_order_id AND status = 'created'
   ORDER BY created_at DESC LIMIT 1
   FOR UPDATE;
  IF FOUND THEN
    UPDATE public.payment_attempts
       SET status = 'pending', expires_at = COALESCE(expires_at, v_now + interval '30 minutes')
     WHERE id = v_attempt.id
       AND status = 'created'
    RETURNING id INTO v_new_id;
    IF v_new_id IS NOT NULL THEN
      RETURN jsonb_build_object('action','claimed','attempt_id',v_new_id,'order_id',v_order.id);
    END IF;
  END IF;

  -- No reusable/claimable attempt: create a new one (may conflict; partial unique handles).
  INSERT INTO public.payment_attempts (order_id, user_id, book_id, provider, status, amount, currency, expires_at)
  VALUES (p_order_id, v_uid,
          (SELECT oi.book_id FROM order_items oi WHERE oi.order_id = p_order_id LIMIT 1),
          'nagorikpay', 'pending', v_order.total, v_order.currency, v_now + interval '30 minutes')
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('action','claimed','attempt_id',v_new_id,'order_id',v_order.id);
END;
$$;

-- ===== e) fulfill_paid_order: preserve original payment_reference =====
CREATE OR REPLACE FUNCTION public.fulfill_paid_order(p_order_id uuid, p_payment_reference text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_order record;
  v_item record;
  v_token text;
  v_grant_id uuid;
  v_created integer := 0;
  v_grants jsonb := '[]'::jsonb;
begin
  select * into v_order from orders where id = p_order_id for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.payment_status <> 'paid' then
    raise exception 'Order is not paid (current status: %)', v_order.payment_status;
  end if;

  -- Preserve the ORIGINAL payment reference. Only fill it when missing.
  if v_order.payment_reference is null and p_payment_reference is not null then
    update orders
       set payment_reference = p_payment_reference,
           payment_method    = coalesce(payment_method, 'nagorikpay'),
           paid_at           = coalesce(paid_at, now()),
           updated_at        = now()
     where id = p_order_id;
  else
    update orders
       set paid_at    = coalesce(paid_at, now()),
           updated_at = now()
     where id = p_order_id;
  end if;

  for v_item in
    select oi.id as item_id
    from order_items oi
    where oi.order_id = p_order_id
      and oi.delivery_type_snapshot = 'digital'
  loop
    if v_order.user_id is not null and not exists (
      select 1 from download_grants dg
      where dg.order_item_id = v_item.item_id
        and dg.user_id = v_order.user_id
    ) then
      v_token := encode(gen_random_bytes(32), 'hex');

      insert into download_grants (
        order_id, order_item_id, user_id, token_hash,
        max_downloads, download_count, expires_at
      ) values (
        p_order_id, v_item.item_id, v_order.user_id,
        encode(sha256(v_token::bytea), 'hex'),
        NULL, 0, NULL
      )
      returning id into v_grant_id;

      v_created := v_created + 1;
      v_grants := v_grants || jsonb_build_object('order_item_id', v_item.item_id, 'grant_id', v_grant_id);
    end if;
  end loop;

  return jsonb_build_object(
    'order_id',      p_order_id,
    'payment_status','paid',
    'grants_created',v_created,
    'grants',        v_grants,
    'ready',         true
  );
end;
$function$;

-- ===== f) grant execute to authenticated =====
GRANT EXECUTE ON FUNCTION public.begin_payment_attempt(uuid) TO authenticated;

-- ===== g) backfill payment_attempts =====
-- Paid orders
INSERT INTO public.payment_attempts (order_id, user_id, book_id, provider, provider_transaction_id, status, amount, currency, completed_at, created_at, expires_at)
SELECT o.id, o.user_id,
       (SELECT oi.book_id FROM order_items oi WHERE oi.order_id = o.id ORDER BY oi.id LIMIT 1),
       'nagorikpay', o.payment_reference, 'paid', o.total, o.currency, o.paid_at, COALESCE(o.paid_at,o.created_at), NULL
FROM orders o
WHERE o.payment_status = 'paid'
  AND NOT EXISTS (SELECT 1 FROM payment_attempts pa WHERE pa.order_id = o.id);

-- Pending orders with a reference -> expired (old sessions, kept for audit)
INSERT INTO public.payment_attempts (order_id, user_id, book_id, provider, provider_transaction_id, status, amount, currency, created_at, expires_at)
SELECT o.id, o.user_id,
       (SELECT oi.book_id FROM order_items oi WHERE oi.order_id = o.id ORDER BY oi.id LIMIT 1),
       'nagorikpay', o.payment_reference, 'expired', o.total, o.currency, o.created_at, o.created_at
FROM orders o
WHERE o.payment_status IN ('pending_payment','payment_review','pending_verification')
  AND o.payment_reference IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payment_attempts pa WHERE pa.order_id = o.id);

COMMIT;

NOTIFY pgrst, 'reload schema';
