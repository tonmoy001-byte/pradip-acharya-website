# Listings Import

## How to Use

1. Add your CSV rows to `listings.csv` (copy the template header from `listings-template.csv`)
2. Drop book cover images into `images/` named as referenced in `image1`, `image2` columns
3. Run from project root:

```bash
npm run import-listings
```

This will:
- Optimize images with sharp (max 1400px, JPEG quality 80)
- Output images to `public/images/books/<id>-1.jpg`, `<id>-2.jpg`
- Regenerate `lib/generated-books.ts` (idempotent — safe to run repeatedly)

## CSV Columns

| Column | Required | Description |
|--------|----------|-------------|
| title | Yes | Book title in Bengali |
| author | Yes | Author name |
| category | Yes | `novels` or `books` |
| subcategory | Yes | Bengali display label (e.g., `উপন্যাস`) |
| subcategorySlug | Yes | URL slug (e.g., `novels`, `poetry`) |
| description | Yes | Short description |
| synopsis | No | Longer synopsis |
| price | Yes | Price in BDT (number) |
| compareAtPrice | No | Original price for strikethrough |
| format | Yes | `Paperback`, `Hardcover`, or `eBook` |
| publicationDate | No | ISO date (YYYY-MM-DD) |
| publisher | No | Publisher name |
| isbn | No | ISBN |
| pages | No | Page count |
| language | No | Language (e.g., `বাংলা`) |
| image1 | Yes | Primary image URL or local path |
| image2 | No | Hover/secondary image URL or local path |

## Multiple Formats

For a book with multiple formats, add one row per format with the same title. The script will merge them into a single book entry with multiple formats.

## Notes

- IDs are auto-generated from titles (slugified). Collision suffixes (`-2`, `-3`) are added automatically.
- The script validates against `BASE_BOOKS` IDs — no collisions with the seed data.
- Missing images fall back to `public/images/book-placeholder.svg`.
- The `lib/generated-books.ts` file is auto-generated. Never hand-edit it.
