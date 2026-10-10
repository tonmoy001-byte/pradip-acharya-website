-- 014_contact_rate_limits.sql
-- Persistent rate limit for the public contact form.
--
-- The in-memory Map in app/api/contact/route.ts resets on every cold start and is
-- per-instance, so it is easy to bypass by restarting the app or hitting a
-- different instance. This table keys submissions by a hash of the client IP and
-- counts rows in the last 10 minutes; the server inserts a row per submission and
-- refuses once the limit is exceeded.
--
-- RLS: the table is service-only. The route uses the admin/service client, so no
-- public SELECT/INSERT policy is needed. The hash is sha256(ip + a server-side
-- salt) so the raw IP is never stored.
CREATE TABLE IF NOT EXISTS public.contact_rate_limits (
  id            bigserial PRIMARY KEY,
  ip_hash       text NOT NULL,
  submitted_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_rate_limits_ip_hash_submitted_at_idx
  ON public.contact_rate_limits (ip_hash, submitted_at);