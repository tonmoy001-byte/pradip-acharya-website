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

Do not edit these files — they record what was actually applied. New changes
go in a new numbered file.
