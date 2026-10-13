-- 018_order-and-download-functions.sql
--
-- 1. create_ebook_order(p_items jsonb, p_contact jsonb)
--    Atomic order creation for digital goods, replacing the two-insert
--    pattern in app/api/orders/route.ts:
--      * one transaction: order + items + totals, no orphan empty orders
--      * prices come from book_formats (server-owned), never the client
--      * quantity is always 1 per book; duplicate cart lines are merged
--      * a book the customer can still download cannot be bought again
--        (already_owned) — after the grant expires or is revoked, it can
--      * a 0-price cart never reaches the gateway: it is settled and
--        fulfilled immediately (free books)
--      * payment_method is fixed to 'nagorikpay'
--    Called with the customer's session client: the function reads
--    auth.uid() to attribute the order, so it must run as the logged-in
--    user, not the service key.
--
-- 2. consume_download(p_grant_id uuid)
--    Already exists in the live database and is the atomic download
--    counter: it locks the grant (FOR UPDATE), re-checks ownership,
--    revocation, expiry, the parent order's paid status and the download
--    limit, increments, and returns the storage key. The definition is
--    committed here so a rebuilt database has it; applying this to the
--    live database is a no-op (CREATE OR REPLACE with the same body).
--    app/api/my-downloads/[grantId]/route.ts calls it AFTER fetching the
--    file, so a storage failure never costs the customer a download.

BEGIN;

-- ===== Atomic order creation (digital goods, quantity always 1) =====
-- p_items: JSON array of book id strings, e.g. ["book-1","book-2"]
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

    -- Block buying again only while the customer still has a usable download.
    IF EXISTS (
      SELECT 1
      FROM order_items oi
      JOIN orders o           ON o.id = oi.order_id
      JOIN download_grants dg ON dg.order_item_id = oi.id
      WHERE o.user_id = v_uid
        AND o.payment_status = 'paid'
        AND oi.book_id = v_book_id
        AND dg.revoked_at IS NULL
        AND dg.expires_at > now()
        AND dg.download_count < dg.max_downloads
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

REVOKE ALL ON FUNCTION public.create_ebook_order(jsonb, jsonb) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.create_ebook_order(jsonb, jsonb) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.create_ebook_order(jsonb, jsonb) TO authenticated;
  END IF;
END $$;

-- ===== Atomic download counting =====
-- Returns the storage key and increments only if the grant is still
-- usable. Definition matches the live function (committed for rebuilds).
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

  -- Check expiry
  IF v_grant.expires_at < now() THEN
    RAISE EXCEPTION 'Download grant has expired';
  END IF;

  -- Check payment status of parent order
  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE id = v_grant.order_id AND payment_status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Order payment not verified';
  END IF;

  -- Check download limit
  IF v_grant.download_count >= v_grant.max_downloads THEN
    RAISE EXCEPTION 'Download limit reached';
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

  -- Atomic increment
  UPDATE download_grants
  SET download_count = download_count + 1,
      last_downloaded_at = now()
  WHERE id = p_grant_id;

  -- Return storage key
  SELECT jsonb_build_object(
    'storage_key', v_asset.storage_key,
    'download_count', v_grant.download_count + 1,
    'max_downloads', v_grant.max_downloads,
    'expires_at', v_grant.expires_at
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

COMMIT;

NOTIFY pgrst, 'reload schema';
