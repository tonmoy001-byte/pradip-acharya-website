CREATE OR REPLACE FUNCTION public.admin_create_book(
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
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_book_id text;
  v_fmt jsonb;
BEGIN
  INSERT INTO books (title, author, category, subcategory, subcategory_slug,
    description, synopsis, cover_primary, cover_hover, featured, is_new, trending, is_demo)
  VALUES (p_title, p_author, p_category, COALESCE(p_subcategory, ''), COALESCE(p_subcategory_slug, ''),
    COALESCE(p_description, ''), p_synopsis, p_cover_primary, p_cover_hover,
    COALESCE(p_featured, false), COALESCE(p_is_new, false),
    COALESCE(p_trending, false), COALESCE(p_is_demo, false))
  RETURNING id INTO v_book_id;

  IF p_formats IS NOT NULL THEN
    FOR v_fmt IN SELECT * FROM jsonb_array_elements(p_formats)
    LOOP
      INSERT INTO book_formats (book_id, format_name, price, compare_at_price, available, delivery_type)
      VALUES (v_book_id, v_fmt->>'name', (v_fmt->>'price')::numeric,
        NULLIF(v_fmt->>'compareAtPrice', '')::numeric,
        COALESCE((v_fmt->>'available')::boolean, true),
        COALESCE(v_fmt->>'delivery_type', 'physical'));
    END LOOP;
  END IF;

  RETURN v_book_id;
END;
$function$;
