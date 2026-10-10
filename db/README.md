# db/migrations

Ordered copies of the database function definitions and data updates that the
live InsForge database was built with. If the database ever needs rebuilding,
apply these in filename order with `psql` (or the InsForge SQL runner).

- `001`–`007`: core RPCs (`is_admin`, book CRUD, order approve/reject).
- `008`: admin update-book fix.
- `009`: ebook-only migration.
- `010`: settings-encoding fix.
- `011`: `chhera-pushpo` description data update (history).
- `012`: `fulfill_paid_order` — creates download grants for paid ebook orders (idempotent, service-only).
- `013`: drops `approve_order_payment` and `reject_order_payment` (manual admin approval removed).
- `014`: `contact_rate_limits` table — persistent contact-form rate limiting (service-only, RLS on, no policies).
- `015`: lock down admin book functions — originals renamed to `*_impl` (bodies untouched), same-signature wrappers call `require_admin()` first; PUBLIC EXECUTE revoked from `_impl` functions, `fulfill_paid_order` and the legacy `create_order_from_cart`; `fulfill_paid_order` default payment_method corrected to `nagorikpay`; explicit `search_path` added to every remaining SECURITY DEFINER function.
- `016`: guard `admin_create_post`, `admin_update_post`, `admin_delete_post`, `admin_upsert_setting` the same way (rename to `*_impl` + `require_admin()` wrapper); `get_site_settings()` keeps public EXECUTE (visitor-facing settings feed) and gains `search_path`.
- `017`: RLS lockdown — drops `orders_insert_own` and `order_items_insert_own` (users can no longer insert their own orders; creation happens only inside `create_ebook_order`), enables RLS on `contact_rate_limits`.
- `018`: `create_ebook_order` (atomic ebook order creation: server-owned pricing, quantity 1, duplicate-purchase block, free-cart auto-settlement) and `consume_download` (atomic download counter; committed for rebuilds, no-op on the live database).

Do not edit these files — they record what was actually applied. New changes
go in a new numbered file.

## SECURITY DEFINER rules

Every `SECURITY DEFINER` function in `public` must:

1. Set an explicit `search_path` (`SET search_path TO 'public'`) — otherwise
   a caller who can create objects in a schema earlier in the search path can
   redirect the function's table references.
2. Check the caller: admin functions call `require_admin()` (which verifies
   `is_admin(auth.uid())`); user functions verify `auth.uid()` themselves.
3. Be revoked from `PUBLIC` unless it is deliberately public (only
   `get_site_settings` and the self-checking user helpers are).

Admin book/post/setting functions follow the `*_impl` pattern: the original
body is renamed to `*_impl` (service-only, no EXECUTE for anon/authenticated)
and a same-signature wrapper checks `require_admin()` first. Application code
calls the wrapper by the original name, so no code changes are needed.
