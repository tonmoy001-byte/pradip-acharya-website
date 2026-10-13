-- 017_rls-lockdown.sql
--
-- Row-level security lockdown, based on the live policy audit.
--
-- What changes and why:
--
-- 1. orders: DROP orders_insert_own.
--    The old policy let any logged-in user INSERT their own rows with
--    arbitrary payment_status ('paid') and total (0). Order creation now
--    happens exclusively inside create_ebook_order() (018), a
--    SECURITY DEFINER function that prices every line from book_formats
--    and sets payment_status itself. Users keep read access to their own
--    rows (orders_select_own) and admins keep read/update
--    (orders_admin_select / orders_admin_update).
--
-- 2. order_items: DROP order_items_insert_own.
--    Same reasoning: order lines are created only by create_ebook_order().
--    Read policies stay.
--
-- 3. contact_rate_limits: ENABLE ROW LEVEL SECURITY with no policies.
--    The table is written and read only by the contact route using the
--    service key (project_admin owns the table and bypasses RLS). With
--    RLS on and zero policies, anon/authenticated can no longer touch
--    it through the public API.
--
-- Everything else already matches the target access matrix:
--   books / book_formats / posts (published) / site_settings /
--   categories: public read, admin write via admin_memberships.
--   orders / order_items / download_grants: read own (plus admin read).
--   digital_assets / payment_events / admin_memberships: admin only.
--   profiles: read/write own row.

BEGIN;

-- Users must no longer be able to insert their own orders.
DROP POLICY IF EXISTS orders_insert_own ON public.orders;
DROP POLICY IF EXISTS order_items_insert_own ON public.order_items;

-- Service-only table: RLS on, no policies (owner/service bypasses RLS).
ALTER TABLE public.contact_rate_limits ENABLE ROW LEVEL SECURITY;

COMMIT;
