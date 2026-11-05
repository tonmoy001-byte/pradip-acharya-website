-- 021_guest_checkout.sql
--
-- Guest checkout: a buyer can purchase an ebook without an account and receive
-- a download link by email.
--
-- Security model
-- --------------
-- * A guest order has user_id = NULL and is identified by two independent
--   256-bit bearer tokens. Only their SHA-256 hex hashes are stored:
--       guest_token_hash        checkout token (httpOnly cookie `go_<order>`)
--       guest_email_token_hash  email token (minted after payment)
-- * The browser never calls these functions directly. Every guest route runs
--   server-side, checks the cookie/token locally, then uses the server-side
--   project_admin client for the authorization RPC (and, only afterwards, for
--   the private storage download).
-- * Guest functions are therefore executable by project_admin only. They are
--   SECURITY DEFINER and owned by project_admin, so they can read/write rows
--   that RLS hides from anon/authenticated.
-- * All guest authorization failures raise the same `forbidden` error, so a
--   caller cannot tell "order missing" from "wrong token".
--
-- Downloads follow the owner policy from 019: unlimited, no expiry.
--
-- Apply only after explicit approval. Idempotent where possible.

BEGIN;

-- ===== 0. Nullable ownership =====
-- orders.user_id is already nullable in production; keep this conditional.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders'
      AND column_name = 'user_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'download_grants'
      AND column_name = 'user_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.download_grants ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE public.payment_attempts ALTER COLUMN user_id DROP NOT NULL;

-- ===== 1. Guest token + delivery columns =====
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS guest_token_hash        text,
  ADD COLUMN IF NOT EXISTS guest_email_token_hash  text,
  ADD COLUMN IF NOT EXISTS delivery_email_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_emailed_at     timestamptz;

-- One order per token. A token is a bearer credential, never shared.
CREATE UNIQUE INDEX IF NOT EXISTS orders_guest_token_hash_key
  ON public.orders (guest_token_hash)
  WHERE guest_token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_guest_email_token_hash_key
  ON public.orders (guest_email_token_hash)
  WHERE guest_email_token_hash IS NOT NULL;

-- One guest grant per order item. The (order_item_id, user_id) index from 020
-- does not dedupe NULL user_id rows.
CREATE UNIQUE INDEX IF NOT EXISTS download_grants_one_per_item_guest
  ON public.download_grants (order_item_id)
  WHERE user_id IS NULL;

-- ===== 2. Insert-only ownership validation =====
-- A CHECK constraint would also fire on UPDATE, which would break the
-- orders.user_id ON DELETE SET NULL foreign key. An INSERT-only trigger leaves
-- updates (settlement, deletion of the owning account) untouched.
CREATE OR REPLACE FUNCTION public.orders_validate_guest_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.guest_token_hash IS NULL THEN
    RAISE EXCEPTION 'order_owner_required' USING ERRCODE = '23514';
  END IF;
  IF NEW.user_id IS NOT NULL AND NEW.guest_token_hash IS NOT NULL THEN
    RAISE EXCEPTION 'order_owner_conflict' USING ERRCODE = '23514';
  END IF;
  IF NEW.guest_token_hash IS NOT NULL AND NEW.guest_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_guest_token' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_validate_guest_owner ON public.orders;
CREATE TRIGGER orders_validate_guest_owner
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_validate_guest_owner();

-- ===== 3. Guest checkout rate limits =====
-- Service-only table (RLS on, no policies). Hashed IP + hashed email so the
-- raw values are never stored. The order route fails closed when this table is
-- unavailable.
CREATE TABLE IF NOT EXISTS public.guest_checkout_rate_limits (
  id          bigserial PRIMARY KEY,
  ip_hash     text NOT NULL,
  email_hash  text NOT NULL,
  scope       text NOT NULL DEFAULT 'order',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_checkout_rate_limits_ip_idx
  ON public.guest_checkout_rate_limits (ip_hash, scope, created_at);

CREATE INDEX IF NOT EXISTS guest_checkout_rate_limits_email_idx
  ON public.guest_checkout_rate_limits (email_hash, scope, created_at);

ALTER TABLE public.guest_checkout_rate_limits ENABLE ROW LEVEL SECURITY;

-- ===== 4. create_guest_ebook_order =====
-- KEEP IN SYNC with create_ebook_order (019/020). The logged-in function is
-- untouched. Guests skip the already_owned / active_order_exists checks
-- because those are account-scoped and would leak purchase history.
CREATE OR REPLACE FUNCTION public.create_guest_ebook_order(
  p_items jsonb,
  p_contact jsonb,
  p_guest_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id   uuid;
  v_total      numeric := 0;
  v_count      int := 0;
  v_book_id    text;
  v_book       record;
  v_fmt        record;
  v_first_book text := NULL;
BEGIN
  IF p_guest_token_hash IS NULL OR p_guest_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_guest_token' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'cart_empty';
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'cart_too_large';
  END IF;

  -- Price every line from server-owned data before writing anything.
  FOR v_book_id IN SELECT DISTINCT jsonb_array_elements_text(p_items) LOOP
    PERFORM pg_advisory_xact_lock(hashtext('guest:' || p_guest_token_hash || ':' || v_book_id)::bigint);

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

    IF v_first_book IS NULL THEN v_first_book := v_book_id; END IF;
  END LOOP;

  INSERT INTO orders (user_id, guest_token_hash, contact, shipping_address, currency,
                      payment_method, payment_status, subtotal, delivery_charge, total,
                      fulfillment_status)
  VALUES (NULL, p_guest_token_hash, p_contact, NULL, 'BDT', 'nagorikpay',
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

  -- Guests must pay; free carts are not a guest path.
  IF v_total = 0 THEN
    RAISE EXCEPTION 'free_not_allowed';
  END IF;

  INSERT INTO public.payment_attempts
    (order_id, user_id, book_id, provider, status, amount, currency, expires_at)
  VALUES
    (v_order_id, NULL, v_first_book, 'nagorikpay', 'created', v_total, 'BDT',
     now() + interval '30 minutes')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'order_id', v_order_id, 'subtotal', v_total, 'delivery_charge', 0,
    'total', v_total, 'item_count', v_count, 'digital_only', true,
    'free', false,
    'attempt_id', (
      SELECT id FROM public.payment_attempts
      WHERE order_id = v_order_id AND status IN ('created','pending')
      ORDER BY created_at DESC LIMIT 1
    )
  );
END;
$$;

-- ===== 5. begin_guest_payment_attempt =====
-- KEEP IN SYNC with begin_payment_attempt (020). Every ownership failure uses
-- the same `forbidden` error so an unknown order id and a wrong token are
-- indistinguishable.
CREATE OR REPLACE FUNCTION public.begin_guest_payment_attempt(
  p_order_id uuid,
  p_guest_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order     record;
  v_attempt   record;
  v_new_id    uuid;
  v_now       timestamptz := now();
BEGIN
  IF p_guest_token_hash IS NULL OR p_guest_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_order.user_id IS NOT NULL
     OR COALESCE(v_order.guest_token_hash = p_guest_token_hash, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_order.payment_status IN ('paid','refunded','failed') THEN
    RETURN jsonb_build_object('action','rejected','reason',v_order.payment_status,'order_id',v_order.id);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('guest-order:' || p_order_id::text)::bigint);

  UPDATE public.payment_attempts
     SET status = 'expired', updated_at = v_now
   WHERE order_id = p_order_id
     AND status IN ('created','pending')
     AND (expires_at IS NULL OR expires_at < v_now)
     AND created_at < v_now - interval '10 minutes';

  SELECT * INTO v_attempt
    FROM public.payment_attempts
   WHERE order_id = p_order_id AND status = 'pending' AND payment_url IS NOT NULL
   ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('action','reuse','attempt_id',v_attempt.id,
                              'payment_url',v_attempt.payment_url,'order_id',v_order.id);
  END IF;

  SELECT * INTO v_attempt
    FROM public.payment_attempts
   WHERE order_id = p_order_id AND status = 'pending' AND payment_url IS NULL
     AND created_at > v_now - interval '2 minutes'
   ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('action','in_progress','attempt_id',v_attempt.id,'order_id',v_order.id);
  END IF;

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
      RETURN jsonb_build_object(
        'action','claimed','attempt_id',v_new_id,'order_id',v_order.id,
        'total',v_order.total,'currency',v_order.currency,'contact',v_order.contact
      );
    END IF;
  END IF;

  INSERT INTO public.payment_attempts
    (order_id, user_id, book_id, provider, status, amount, currency, expires_at)
  VALUES
    (p_order_id, NULL,
     (SELECT oi.book_id FROM order_items oi WHERE oi.order_id = p_order_id LIMIT 1),
     'nagorikpay', 'pending', v_order.total, v_order.currency, v_now + interval '30 minutes')
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'action','claimed','attempt_id',v_new_id,'order_id',v_order.id,
    'total',v_order.total,'currency',v_order.currency,'contact',v_order.contact
  );
END;
$$;

-- ===== 6. fulfill_paid_order (020 body + guest branch) =====
CREATE OR REPLACE FUNCTION public.fulfill_paid_order(
  p_order_id uuid,
  p_payment_reference text DEFAULT NULL::text
)
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

  -- Logged-in owner branch (byte-for-byte behaviour from 020).
  if v_order.user_id is not null then
    for v_item in
      select oi.id as item_id
      from order_items oi
      where oi.order_id = p_order_id
        and oi.delivery_type_snapshot = 'digital'
    loop
      if not exists (
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
  end if;

  -- Guest branch: user_id IS NULL, guest_token_hash IS NOT NULL.
  if v_order.guest_token_hash is not null then
    for v_item in
      select oi.id as item_id
      from order_items oi
      where oi.order_id = p_order_id
        and oi.delivery_type_snapshot = 'digital'
    loop
      v_grant_id := null;

      insert into download_grants (
        order_id, order_item_id, user_id, token_hash,
        max_downloads, download_count, expires_at
      ) values (
        p_order_id, v_item.item_id, NULL,
        encode(sha256(gen_random_bytes(32)), 'hex'),
        NULL, 0, NULL
      )
      on conflict do nothing
      returning id into v_grant_id;

      if v_grant_id is not null then
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
  end if;

  raise exception 'Order has no owner';
end;
$function$;

-- ===== 7. get_guest_order =====
-- Server-only read used by the exchange route and the guest order page.
-- Returns no row data unless the presented token belongs to this guest order.
CREATE OR REPLACE FUNCTION public.get_guest_order(
  p_order_id uuid,
  p_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
  v_items jsonb;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_order.guest_token_hash = p_token_hash, false) IS NOT TRUE
     AND COALESCE(v_order.guest_email_token_hash = p_token_hash, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object('title', oi.title_snapshot, 'grant_id', dg.id)
             ORDER BY oi.created_at
           ),
           '[]'::jsonb
         )
    INTO v_items
    FROM order_items oi
    LEFT JOIN download_grants dg
      ON dg.order_item_id = oi.id
     AND dg.user_id IS NULL
     AND dg.revoked_at IS NULL
   WHERE oi.order_id = p_order_id
     AND oi.delivery_type_snapshot = 'digital';

  RETURN jsonb_build_object(
    'order_id',       v_order.id,
    'payment_status', v_order.payment_status,
    'total',          v_order.total,
    'currency',       v_order.currency,
    'items',          v_items
  );
END;
$function$;

-- ===== 8. consume_guest_download =====
-- Accepts either the checkout token or the email token. Returns the private
-- storage key and the book title so the route never reads tables itself.
CREATE OR REPLACE FUNCTION public.consume_guest_download(
  p_grant_id uuid,
  p_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_grant  record;
  v_order  record;
  v_asset  record;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT dg.*, oi.title_snapshot, oi.format_id
    INTO v_grant
    FROM download_grants dg
    JOIN order_items oi ON oi.id = dg.order_item_id
   WHERE dg.id = p_grant_id
   FOR UPDATE OF dg;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_grant.user_id IS NOT NULL OR v_grant.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_grant.order_id;
  IF NOT FOUND
     OR v_order.user_id IS NOT NULL
     OR v_order.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_order.guest_token_hash = p_token_hash, false) IS NOT TRUE
     AND COALESCE(v_order.guest_email_token_hash = p_token_hash, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT da.* INTO v_asset
    FROM digital_assets da
   WHERE da.format_id = v_grant.format_id
     AND da.active = true
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Private statistic only (unlimited downloads).
  UPDATE download_grants
     SET download_count = download_count + 1,
         last_downloaded_at = now()
   WHERE id = p_grant_id;

  RETURN jsonb_build_object(
    'storage_key',    v_asset.storage_key,
    'download_count', v_grant.download_count + 1,
    'title',          v_grant.title_snapshot
  );
END;
$function$;

-- ===== 9. Email delivery lease =====
-- Claim -> send -> mark. If the send fails, release clears the claim so a
-- later verify/webhook retry can deliver. A crashed worker's claim expires
-- after 15 minutes.
CREATE OR REPLACE FUNCTION public.claim_guest_delivery_email(
  p_order_id uuid,
  p_email_token_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rows int;
BEGIN
  IF p_email_token_hash IS NULL OR p_email_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;

  UPDATE orders
     SET guest_email_token_hash     = p_email_token_hash,
         delivery_email_claimed_at  = now(),
         delivery_emailed_at        = NULL
   WHERE id = p_order_id
     AND user_id IS NULL
     AND payment_status = 'paid'
     AND delivery_emailed_at IS NULL
     AND (delivery_email_claimed_at IS NULL
          OR delivery_email_claimed_at < now() - interval '15 minutes');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_guest_delivery_sent(
  p_order_id uuid,
  p_email_token_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rows int;
BEGIN
  IF p_email_token_hash IS NULL OR p_email_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;

  UPDATE orders
     SET delivery_emailed_at = now()
   WHERE id = p_order_id
     AND user_id IS NULL
     AND guest_email_token_hash = p_email_token_hash;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_guest_delivery_email(
  p_order_id uuid,
  p_email_token_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rows int;
BEGIN
  IF p_email_token_hash IS NULL OR p_email_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;

  UPDATE orders
     SET guest_email_token_hash    = NULL,
         delivery_email_claimed_at = NULL,
         delivery_emailed_at       = NULL
   WHERE id = p_order_id
     AND user_id IS NULL
     AND guest_email_token_hash = p_email_token_hash;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$function$;

-- ===== 10. F1: consume_download must be NULL-safe =====
-- 019 compared `v_grant.user_id != v_user_id`. Once guest grants have
-- user_id = NULL that comparison is NULL, the raise never fires, and any
-- logged-in user who knows a guest grant id can read its storage key.
-- Identical behaviour for real owners.
CREATE OR REPLACE FUNCTION public.consume_download(p_grant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_grant record;
  v_asset record;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_grant
  FROM download_grants
  WHERE id = p_grant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Download grant not found';
  END IF;

  -- F1: NULL-safe ownership check.
  IF v_grant.user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Forbidden: not your download grant';
  END IF;

  IF v_grant.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Download grant has been revoked';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE id = v_grant.order_id AND payment_status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Order payment not verified';
  END IF;

  SELECT da.* INTO v_asset
  FROM digital_assets da
  JOIN book_formats bf ON bf.id = da.format_id
  JOIN order_items oi ON oi.format_id = bf.id
  WHERE oi.id = v_grant.order_item_id AND da.active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Digital asset not found';
  END IF;

  UPDATE download_grants
  SET download_count = download_count + 1,
      last_downloaded_at = now()
  WHERE id = p_grant_id;

  SELECT jsonb_build_object(
    'storage_key', v_asset.storage_key,
    'download_count', v_grant.download_count + 1
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- ===== 11. Permissions =====
-- New guest functions: project_admin only. No anon / authenticated execute.
REVOKE ALL ON FUNCTION public.create_guest_ebook_order(jsonb, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_guest_ebook_order(jsonb, jsonb, text) FROM anon;
REVOKE ALL ON FUNCTION public.create_guest_ebook_order(jsonb, jsonb, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_ebook_order(jsonb, jsonb, text) TO project_admin;

REVOKE ALL ON FUNCTION public.begin_guest_payment_attempt(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.begin_guest_payment_attempt(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.begin_guest_payment_attempt(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.begin_guest_payment_attempt(uuid, text) TO project_admin;

REVOKE ALL ON FUNCTION public.get_guest_order(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_guest_order(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.get_guest_order(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_order(uuid, text) TO project_admin;

REVOKE ALL ON FUNCTION public.consume_guest_download(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_guest_download(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.consume_guest_download(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_guest_download(uuid, text) TO project_admin;

REVOKE ALL ON FUNCTION public.claim_guest_delivery_email(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_guest_delivery_email(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.claim_guest_delivery_email(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_guest_delivery_email(uuid, text) TO project_admin;

REVOKE ALL ON FUNCTION public.mark_guest_delivery_sent(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_guest_delivery_sent(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.mark_guest_delivery_sent(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_guest_delivery_sent(uuid, text) TO project_admin;

REVOKE ALL ON FUNCTION public.release_guest_delivery_email(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_guest_delivery_email(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.release_guest_delivery_email(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_guest_delivery_email(uuid, text) TO project_admin;

-- Trigger function: no direct execution by client roles.
REVOKE ALL ON FUNCTION public.orders_validate_guest_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.orders_validate_guest_owner() FROM anon;
REVOKE ALL ON FUNCTION public.orders_validate_guest_owner() FROM authenticated;

-- fulfill_paid_order is service-only. CREATE OR REPLACE preserved its ACL,
-- but state it explicitly so a future re-run cannot widen it.
REVOKE ALL ON FUNCTION public.fulfill_paid_order(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fulfill_paid_order(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.fulfill_paid_order(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_paid_order(uuid, text) TO project_admin;

-- consume_download keeps the logged-in download path, but only for
-- authenticated (and the service client). Remove the default PUBLIC grant.
REVOKE ALL ON FUNCTION public.consume_download(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_download(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.consume_download(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_download(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_download(uuid) TO project_admin;

-- Rate-limit table: service-only (RLS on, no policies).
REVOKE ALL ON public.guest_checkout_rate_limits FROM PUBLIC;
REVOKE ALL ON public.guest_checkout_rate_limits FROM anon;
REVOKE ALL ON public.guest_checkout_rate_limits FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.guest_checkout_rate_limits TO project_admin;
GRANT USAGE, SELECT ON SEQUENCE public.guest_checkout_rate_limits_id_seq TO project_admin;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ===== ROLLBACK (commented) =====
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.release_guest_delivery_email(uuid, text);
-- DROP FUNCTION IF EXISTS public.mark_guest_delivery_sent(uuid, text);
-- DROP FUNCTION IF EXISTS public.claim_guest_delivery_email(uuid, text);
-- DROP FUNCTION IF EXISTS public.consume_guest_download(uuid, text);
-- DROP FUNCTION IF EXISTS public.get_guest_order(uuid, text);
-- DROP FUNCTION IF EXISTS public.begin_guest_payment_attempt(uuid, text);
-- DROP FUNCTION IF EXISTS public.create_guest_ebook_order(jsonb, jsonb, text);
-- DROP TRIGGER IF EXISTS orders_validate_guest_owner ON public.orders;
-- DROP FUNCTION IF EXISTS public.orders_validate_guest_owner();
-- DROP TABLE IF EXISTS public.guest_checkout_rate_limits;
-- DROP INDEX IF EXISTS public.download_grants_one_per_item_guest;
-- DROP INDEX IF EXISTS public.orders_guest_email_token_hash_key;
-- DROP INDEX IF EXISTS public.orders_guest_token_hash_key;
-- ALTER TABLE public.orders DROP COLUMN IF EXISTS delivery_emailed_at;
-- ALTER TABLE public.orders DROP COLUMN IF EXISTS delivery_email_claimed_at;
-- ALTER TABLE public.orders DROP COLUMN IF EXISTS guest_email_token_hash;
-- ALTER TABLE public.orders DROP COLUMN IF EXISTS guest_token_hash;
-- -- Restore consume_download to the 019 definition (the only change is the
-- -- ownership comparison), and fulfill_paid_order to the 020 definition
-- -- (db/migrations/019_unlimited-downloads.sql section b and
-- --  db/migrations/020_payment-attempts.sql section e).
-- -- Restore NOT NULL only if no NULL rows exist:
-- -- ALTER TABLE public.download_grants ALTER COLUMN user_id SET NOT NULL;
-- -- ALTER TABLE public.payment_attempts ALTER COLUMN user_id SET NOT NULL;
-- COMMIT;
