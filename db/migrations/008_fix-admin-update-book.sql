DROP FUNCTION public.admin_update_book(uuid, text, text, text, text, text, text, text, text, text, boolean, boolean, boolean, boolean, jsonb);

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
AS $function$
DECLARE
  v_fmt JSONB;
  v_book_id TEXT := p_book_id;
BEGIN
  UPDATE books SET
    title = p_title, author = p_author, category = p_category,
    subcategory = p_subcategory, subcategory_slug = p_subcategory_slug,
    description = COALESCE(p_description, ''), synopsis = p_synopsis,
    cover_primary = p_cover_primary, cover_hover = p_cover_hover,
    featured = COALESCE(p_featured, false), is_new = COALESCE(p_is_new, false),
    trending = COALESCE(p_trending, false), is_demo = COALESCE(p_is_demo, false)
  WHERE id = v_book_id;

  DELETE FROM book_formats WHERE book_id = v_book_id;

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
END;
$function$;
