-- 019_unlimited-downloads.sql
--
-- Intent: a paid, non-revoked grant works forever with unlimited downloads.
-- Admin revocation still works. download_count and last_downloaded_at remain
-- as private statistics only (never enforced, never shown to customers).
--
-- What changes:
--   a) download_grants.max_downloads and .expires_at become NULLable
--      (columns are kept; only the NOT NULL constraint is dropped).
--   b) consume_download: keeps auth / ownership / revoked / paid-order
--      checks; removes the expiry and download-limit checks; still updates
--      last_downloaded_at and increments download_count.
--   c) fulfill_paid_order: new grants insert max_downloads = NULL and
--      expires_at = NULL. All other behavior (ownership, idempotency,
--      SECURITY DEFINER, search_path, GRANT/REVOKE from 015) is preserved.
--   d) create_ebook_order's already_owned check no longer looks at
--      expires_at / max_downloads — a non-revoked grant means the customer
--      already owns the book.
--   e) UPDATE existing non-revoked grants to NULL out both columns.
--
-- Apply only after explicit approval. Idempotent where possible.

BEGIN;

-- ===== a) Drop NOT NULL (conditional on current state) =====
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'download_grants'
      AND column_name = 'max_downloads'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.download_grants ALTER COLUMN max_downloads DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'download_grants'
      AND column_name = 'expires_at'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.download_grants ALTER COLUMN expires_at DROP NOT NULL;
  END IF;
END $$;

-- ===== b) consume_download: no expiry / limit enforcement =====
-- Same signature, same SECURITY DEFINER + search_path. Ownership, revocation
-- and paid-order checks are kept. download_count / last_downloaded_at are
-- still written as private statistics.
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

  -- Fetch grant with lock
  SELECT * INTO v_grant
  FROM download_grants
  WHERE id = p_grant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Download grant not found';
  END IF;

  -- Check ownership
  IF v_grant.user_id != v_user_id THEN
    RAISE EXCEPTION 'Forbidden: not your download grant';
  END IF;

  -- Check revocation
  IF v_grant.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Download grant has been revoked';
  END IF;

  -- Check payment status of parent order
  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE id = v_grant.order_id AND payment_status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Order payment not verified';
  END IF;

  -- Fetch the active digital asset
  SELECT da.* INTO v_asset
  FROM digital_assets da
  JOIN book_formats bf ON bf.id = da.format_id
  JOIN order_items oi ON oi.format_id = bf.id
  WHERE oi.id = v_grant.order_item_id AND da.active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Digital asset not found';
  END IF;

  -- Private statistic only: increment and stamp.
  UPDATE download_grants
  SET download_count = download_count + 1,
      last_downloaded_at = now()
  WHERE id = p_grant_id;

  -- Same JSON shape the route already expects.
  SELECT jsonb_build_object(
    'storage_key', v_asset.storage_key,
    'download_count', v_grant.download_count + 1
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- ===== c) fulfill_paid_order: new grants have NULL limit / expiry =====
-- Same signature, same SECURITY DEFINER + search_path. GRANT/REVOKE from
-- 015 are unchanged (service-only; not re-stated here).
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
  -- Lock the order so a concurrent verify/webhook cannot double-grant.
  select * into v_order from orders where id = p_order_id for update;

  if not found then
    raise exception 'Order not found';
  end if;

  -- The payment gateway is the gate, not a human. This function only ever
  -- releases files for an order the server has already confirmed as paid, so it
  -- is safe to call from the verify/webhook handlers without an admin step.
  if v_order.payment_status <> 'paid' then
    raise exception 'Order is not paid (current status: %)', v_order.payment_status;
  end if;

  if p_payment_reference is not null and v_order.payment_reference is distinct from p_payment_reference then
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
    -- Idempotent: one grant per order line, re-running is a no-op.
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

-- ===== d) create_ebook_order: already_owned = any non-revoked grant =====
-- A non-revoked grant means the customer already owns the book forever.
-- The old expires_at / max_downloads predicates are removed (NULL-safe).
CREATE OR REPLACE FUNCTION public.create_ebook_order(p_items jsonb, p_contact jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_order_id uuid;
  v_total    numeric := 0;
  v_count    int := 0;
  v_book_id  text;
  v_book     record;
  v_fmt      record;
  v_ref      text;
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

  INSERT INTO orders (user_id, contact, shipping_address, currency, payment_method,
                      payment_status, subtotal, delivery_charge, total, fulfillment_status)
  VALUES (v_uid, p_contact, NULL, 'BDT', 'nagorikpay',
          'pending_payment', 0, 0, 0, 'not_applicable')
  RETURNING id INTO v_order_id;

  FOR v_book_id IN SELECT DISTINCT jsonb_array_elements_text(p_items) LOOP
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

    -- Block buying again only while the customer still has a non-revoked
    -- grant (unlimited downloads; no expiry / limit to check).
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

    INSERT INTO order_items (order_id, book_id, format_id, title_snapshot, author_snapshot,
                             format_snapshot, delivery_type_snapshot, quantity,
                             unit_price_snapshot, line_total)
    VALUES (v_order_id, v_book_id, v_fmt.id, v_book.title, v_book.author,
            v_fmt.format_name, 'digital', 1, v_fmt.price, v_fmt.price);

    v_total := v_total + v_fmt.price;
    v_count := v_count + 1;
  END LOOP;

  UPDATE orders SET subtotal = v_total, total = v_total WHERE id = v_order_id;

  -- Free books: no gateway needed, settle and release the files immediately.
  IF v_total = 0 THEN
    v_ref := 'free-' || v_order_id::text;
    UPDATE orders
       SET payment_status = 'paid', paid_at = now(), payment_reference = v_ref
     WHERE id = v_order_id;
    PERFORM public.fulfill_paid_order(v_order_id, v_ref);
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id, 'subtotal', v_total, 'delivery_charge', 0,
    'total', v_total, 'item_count', v_count, 'digital_only', true,
    'free', v_total = 0
  );
END;
$$;

-- ===== e) Clear limit / expiry on existing active grants =====
UPDATE download_grants
SET max_downloads = NULL,
    expires_at    = NULL
WHERE revoked_at IS NULL
  AND (max_downloads IS NOT NULL OR expires_at IS NOT NULL);

COMMIT;

NOTIFY pgrst, 'reload schema';
