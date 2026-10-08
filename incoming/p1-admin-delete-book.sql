CREATE OR REPLACE FUNCTION public.admin_delete_book(p_book_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_book_id text := p_book_id;
    v_order_count int;
    v_asset_count int;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM books WHERE id = v_book_id) THEN
        RAISE EXCEPTION 'Book not found: %', v_book_id;
    END IF;

    SELECT COUNT(*) INTO v_order_count
    FROM order_items oi
    LEFT JOIN book_formats bf ON bf.id = oi.format_id
    WHERE oi.book_id = v_book_id OR bf.book_id = v_book_id;

    IF v_order_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete book: % order(s) reference this book', v_order_count;
    END IF;

    SELECT COUNT(*) INTO v_asset_count
    FROM digital_assets da
    JOIN book_formats bf ON bf.id = da.format_id
    WHERE bf.book_id = v_book_id;

    IF v_asset_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete book: % digital asset(s) exist for this book', v_asset_count;
    END IF;

    DELETE FROM book_formats WHERE book_id = v_book_id;
    DELETE FROM books WHERE id = v_book_id;
END;
$function$;
