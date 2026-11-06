-- 024_fix_guest_order_owner_constraint.sql
--
-- The live orders table has an additional CHECK constraint:
--   order_has_owner: (user_id IS NOT NULL) OR
--     (is_guest AND guest_token_hash IS NOT NULL AND guest_email IS NOT NULL)
--
-- Migration 021's create_guest_ebook_order did not set is_guest/guest_email,
-- so every guest order insert failed. This migration repairs that function.

CREATE OR REPLACE FUNCTION public.create_guest_ebook_order(
  p_items jsonb,
  p_contact jsonb,
  p_guest_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id   uuid;
  v_total      numeric := 0;
  v_count      int := 0;
  v_book_id    text;
  v_book       record;
  v_fmt        record;
  v_first_book text := NULL;
  v_guest_email text;
BEGIN
  IF p_guest_token_hash IS NULL OR p_guest_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_guest_token' USING ERRCODE = '42501';
  END IF;

  v_guest_email := NULLIF(TRIM(COALESCE(p_contact->>'email', '')), '');
  IF v_guest_email IS NULL THEN
    RAISE EXCEPTION 'invalid_guest_token' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'cart_empty';
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'cart_too_large';
  END IF;

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

  INSERT INTO orders (user_id, is_guest, guest_email, guest_token_hash, contact, shipping_address, currency,
                      payment_method, payment_status, subtotal, delivery_charge, total,
                      fulfillment_status)
  VALUES (NULL, true, v_guest_email, p_guest_token_hash, p_contact, NULL, 'BDT', 'nagorikpay',
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
$function$;