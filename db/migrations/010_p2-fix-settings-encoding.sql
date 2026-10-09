UPDATE site_settings
SET value = (value #>> '{}')::jsonb
WHERE jsonb_typeof(value) = 'string'
  AND left(value #>> '{}', 1) = '"'
  AND right(value #>> '{}', 1) = '"'
  AND value #>> '{}' ~ '^".*"$'
  AND left(ltrim(value #>> '{}'), 2) = '""'
  AND right(rtrim(value #>> '{}'), 2) = '""';

UPDATE site_settings
SET value = (value #>> '{}')::jsonb
WHERE jsonb_typeof(value) = 'string'
  AND left(value #>> '{}', 1) = '"'
  AND right(value #>> '{}', 1) = '"'
  AND value #>> '{}' ~ '^".*"$';

UPDATE site_settings
SET value = (value #>> '{}')::jsonb
WHERE jsonb_typeof(value) = 'string'
  AND left(value #>> '{}', 1) = '"'
  AND right(value #>> '{}', 1) = '"'
  AND value #>> '{}' ~ '^".*"$';

UPDATE site_settings
SET value = to_jsonb((value #>> '{}')::numeric)
WHERE key IN ('delivery_charge', 'free_delivery_threshold')
  AND jsonb_typeof(value) = 'string'
  AND value #>> '{}' ~ '^-?[0-9]+(\.[0-9]+)?$';

UPDATE site_settings
SET value = (value #>> '{}')::jsonb
WHERE key = 'featured_book_ids'
  AND jsonb_typeof(value) = 'string'
  AND left(value #>> '{}', 1) = '['
  AND right(value #>> '{}', 1) = ']'
  AND value #>> '{}' ~ '^\[.*\]$';
