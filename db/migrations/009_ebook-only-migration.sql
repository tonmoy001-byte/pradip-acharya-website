-- incoming/ebook-only-migration.sql
--
-- EBOOK-ONLY STORE — safe, ADDITIVE data migration.
--
-- WHAT THIS DOES
--   For every book that has no `delivery_type = 'digital'` format row, it adds
--   one, priced from that book's cheapest existing (physical) format.
--
-- WHAT THIS DOES NOT DO (deliberately)
--   * It does NOT delete any book_formats row. Legacy paperbook rows are kept
--     so historical order_items.format_id references stay intact.
--   * It does NOT touch orders, order_items, download_grants, digital_assets,
--     addresses, profiles or any other table.
--   * It does NOT change prices of existing rows.
--
-- The application already ignores every non-digital format: the storefront
-- only reads digital rows, /api/orders resolves the digital format server-side,
-- and the admin book form forces delivery_type = 'digital'. So this migration
-- is only needed to make previously paper-only titles purchasable.
--
-- REVIEW AND RUN MANUALLY. Take a database backup first.

BEGIN;

-- 1. Report what will be added (run this read-only first if you want a preview).
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE 'Books that will gain an eBook format:';
  FOR r IN
    SELECT b.id, b.title
    FROM books b
    WHERE NOT EXISTS (
      SELECT 1 FROM book_formats f
      WHERE f.book_id = b.id AND f.delivery_type = 'digital'
    )
  LOOP
    RAISE NOTICE '  % (%)', r.id, r.title;
  END LOOP;
END $$;

-- 2. Add the missing digital format, priced from the cheapest existing row.
INSERT INTO book_formats (book_id, format_name, price, compare_at_price, available, delivery_type)
SELECT
  b.id,
  'eBook',
  COALESCE(
    (SELECT MIN(price) FROM book_formats f WHERE f.book_id = b.id),
    0
  ),
  NULL,
  true,
  'digital'
FROM books b
WHERE NOT EXISTS (
  SELECT 1 FROM book_formats f
  WHERE f.book_id = b.id AND f.delivery_type = 'digital'
);

COMMIT;

-- ---------------------------------------------------------------------------
-- OPTIONAL CONTENT CLEANUP (admin-authored text, not schema)
-- ---------------------------------------------------------------------------
-- The admin-editable site settings still contain paperbook/shipping wording and
-- the two delivery-charge keys are now unused by the application. Updating them
-- only changes displayed text / adds no schema; it touches no order data.
--
-- UPDATE site_settings
--    SET value = 'সব বই ডিজিটাল ইবুক (PDF) আকারে — কোনো ডেলিভারি চার্জ নেই। এখনই অর্ডার করুন।'
--  WHERE key = 'promo_banner_text';
--
-- UPDATE site_settings SET value = '0' WHERE key = 'delivery_charge';
-- UPDATE site_settings SET value = '0' WHERE key = 'free_delivery_threshold';
--
-- These can equally be done from Admin → Settings in the UI.

-- ---------------------------------------------------------------------------
-- OPTIONAL FOLLOW-UP (only after you have verified downloads still work)
-- ---------------------------------------------------------------------------
-- Physical format rows are now invisible to the app but still occupy rows. If
-- you later want to remove them, do it ONLY after confirming no order_items
-- references them, e.g.:
--
--   SELECT DISTINCT oi.format_id, oi.format_snapshot, oi.delivery_type_snapshot
--   FROM order_items oi
--   JOIN book_formats f ON f.id = oi.format_id
--   WHERE f.delivery_type <> 'digital';
--
-- and only for books where that returns no rows. Deleting them is NOT required
-- for the ebook-only store to work, and is NOT done by the application.
