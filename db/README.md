# db/migrations

Ordered copies of the database function definitions and data updates that the
live InsForge database was built with. If the database ever needs rebuilding,
apply these in filename order with `psql` (or the InsForge SQL runner).

- `001`–`007`: core RPCs (`is_admin`, book CRUD, order approve/reject).
- `008`: admin update-book fix.
- `009`: ebook-only migration.
- `010`: settings-encoding fix.
- `011`: `chhera-pushpo` description data update (history).

Do not edit these files — they record what was actually applied. New changes
go in a new numbered file.
