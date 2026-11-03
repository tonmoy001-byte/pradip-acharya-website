-- 016_rls-lockdown.sql
--
-- RLS audit (Step 2) showed that orders and order_items still allowed an
-- authenticated user to INSERT through the REST API. The app now creates
-- orders only through the SECURITY DEFINER create_ebook_order() function, so
-- those policies are dead weight: they are the only path that lets a client
-- set payment_status / total directly, and removing them closes that hole.
--
-- The remaining policies match the target access matrix:
--   orders, order_items, download_grants: read own row only; admin reads all.
--   digital_assets, payment_events, admin_memberships: admin only.
--   No INSERT/UPDATE/DELETE policies for authenticated on those tables — all
--   writes go through SECURITY DEFINER functions or the service key.

BEGIN;

DROP POLICY IF EXISTS orders_insert_own ON public.orders;
DROP POLICY IF EXISTS order_items_insert_own ON public.order_items;

COMMIT;