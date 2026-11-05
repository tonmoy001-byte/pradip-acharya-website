-- 023_revoke_table_grants.sql
-- Harden table-level grants for anon only.
-- Admin routes use the session client (authenticated role) with requireAdmin(),
-- so authenticated grants must remain. RLS is the primary enforcement.
-- Anon has no legitimate direct access to these tables.

BEGIN;

REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.download_grants FROM anon;
REVOKE ALL ON public.payment_events FROM anon;

COMMIT;