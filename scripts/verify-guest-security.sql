-- scripts/verify-guest-security.sql
-- Read-only security verification for guest checkout.
-- Run with: psql ... -f scripts/verify-guest-security.sql  (or via rawsql endpoint)

-- 1. Table grants to anon/authenticated/public (should be empty for sensitive tables)
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('orders','download_grants','payment_attempts','payment_events','guest_checkout_rate_limits')
  AND grantee IN ('anon','authenticated','public')
ORDER BY table_name, grantee, privilege_type;

-- 2. RLS policies
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('orders','download_grants','payment_attempts','payment_events','guest_checkout_rate_limits')
ORDER BY tablename, policyname;

-- 3. RLS enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('orders','download_grants','payment_attempts','payment_events','guest_checkout_rate_limits');

-- 4. Guest function ACLs (must be project_admin only)
SELECT p.proname,
       coalesce(array_to_string(p.proacl, ','), 'NULL(default=PUBLIC)') AS acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('create_guest_ebook_order','begin_guest_payment_attempt','get_guest_order',
                     'consume_guest_download','claim_guest_delivery_email','mark_guest_delivery_sent',
                     'release_guest_delivery_email','orders_validate_guest_owner',
                     'authorize_guest_download','record_guest_download','fulfill_paid_order')
ORDER BY p.proname;

-- 5. consume_download ACL (authenticated + project_admin)
SELECT p.proname,
       coalesce(array_to_string(p.proacl, ','), 'NULL(default=PUBLIC)') AS acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'consume_download';

-- 6. digital-books bucket privacy (run via storage API, not SQL)
-- SELECT name, public FROM storage.buckets WHERE name = 'digital-books';
-- Expected: public = false

-- 7. Null-owner grant count (should be 0 until first guest purchase)
SELECT count(*) AS null_owner_grants FROM download_grants WHERE user_id IS NULL;