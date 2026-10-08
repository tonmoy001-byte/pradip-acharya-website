CREATE OR REPLACE FUNCTION public.admin_update_book(
  p_book_id text,
  p_title text,
  p_author text,
  p_category text,
  p_subcategory text,
  p_subcategory_slug text,
  p_description text,
  p_synopsis text,
  p_cover_primary text,
  p_cover_hover text,
  p_featured boolean,
  p_is_new boolean,
  p_trending boolean,
  p_is_demo boolean,
  p_formats jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fmt JSONB;
  v_book_id TEXT := p_book_id;
  v_name TEXT;
  v_existing_id UUID;
  v_kept_ids UUID[] := ARRAY[]::uuid[];
  v_order_count INT;
  v_row RECORD;
  v_updated INT;
BEGIN
  UPDATE books SET
    title = p_title, author = p_author, category = p_category,
    subcategory = p_subcategory, subcategory_slug = p_subcategory_slug,
    description = COALESCE(p_description, ''), synopsis = p_synopsis,
    cover_primary = p_cover_primary, cover_hover = p_cover_hover,
    featured = COALESCE(p_featured, false), is_new = COALESCE(p_is_new, false),
    trending = COALESCE(p_trending, false), is_demo = COALESCE(p_is_demo, false)
  WHERE id = v_book_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Book not found: %', v_book_id;
  END IF;

  IF p_formats IS NULL THEN
    RETURN;
  END IF;

  FOR v_fmt IN SELECT * FROM jsonb_array_elements(p_formats)
  LOOP
    v_name := v_fmt->>'name';
    IF v_name IS NULL OR v_name = '' THEN
      CONTINUE;
    END IF;

    SELECT bf.id INTO v_existing_id
    FROM book_formats bf
    WHERE bf.book_id = v_book_id AND bf.format_name = v_name
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE book_formats SET
        price = (v_fmt->>'price')::numeric,
        compare_at_price = NULLIF(v_fmt->>'compareAtPrice', '')::numeric,
        available = COALESCE((v_fmt->>'available')::boolean, true),
        delivery_type = COALESCE(v_fmt->>'delivery_type', 'physical')
      WHERE id = v_existing_id;
      v_kept_ids := array_append(v_kept_ids, v_existing_id);
      v_existing_id := NULL;
    ELSE
      INSERT INTO book_formats (book_id, format_name, price, compare_at_price, available, delivery_type)
      VALUES (
        v_book_id,
        v_name,
        (v_fmt->>'price')::numeric,
        NULLIF(v_fmt->>'compareAtPrice', '')::numeric,
        COALESCE((v_fmt->>'available')::boolean, true),
        COALESCE(v_fmt->>'delivery_type', 'physical')
      )
      RETURNING id INTO v_existing_id;
      v_kept_ids := array_append(v_kept_ids, v_existing_id);
      v_existing_id := NULL;
    END IF;
  END LOOP;

  FOR v_row IN
    SELECT bf.id, bf.format_name
    FROM book_formats bf
    WHERE bf.book_id = v_book_id
      AND NOT (bf.id = ANY (v_kept_ids))
  LOOP
    SELECT COUNT(*) INTO v_order_count
    FROM order_items oi
    WHERE oi.format_id = v_row.id;

    IF v_order_count > 0 THEN
      UPDATE book_formats SET available = false WHERE id = v_row.id;
    ELSE
      DELETE FROM book_formats WHERE id = v_row.id;
    END IF;
  END LOOP;
END;
$function$;
