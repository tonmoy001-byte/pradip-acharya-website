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
- `014`: `contact_rate_limits` table — persistent per-IP rate limit for the public contact form.

## SECURITY DEFINER contract

Every `SECURITY DEFINER` function in this directory must follow the same
contract, or it is a security bug:

1. **Admin functions** must call `PERFORM public.require_admin();` (or the
   equivalent guard from Step 1) before touching any row. This is what makes
   `scripts/check-rpcs.mjs` pass — an anonymous caller must see a permission
   error, never data.
2. **User functions** must check `auth.uid()` against the row they are
   touching (`user_id = auth.uid()`), and must never run as the table owner
   unless the function is `SECURITY DEFINER` *and* the check above is present.
3. **`search_path` must be set explicitly** (`SET search_path TO 'public'`)
   so a caller cannot supply a `schema` argument and reach another schema.

Do not edit these files — they record what was actually applied. New changes
go in a new numbered file.