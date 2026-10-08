// lib/api.ts
// Fetches books from InsForge database.
// Books added in the dashboard appear on the site automatically.
// Uses basic client (no auth cookies) since book data is public.

import { createClient } from "@insforge/sdk"
import {
  BOOK_CATEGORY,
  BOOK_CATEGORY_LABEL,
  EBOOK_FORMAT_NAME,
  type Book,
  type BookCategory,
  type BookFormat,
} from "./data"

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!

const FALLBACK_IMAGE = "/images/books/placeholder.png"

function getClient() {
  return createClient({
    baseUrl: INSFORGE_URL,
    anonKey: INSFORGE_ANON_KEY,
  } as any)
}

/**
 * Resolves a cover image value from the database into a frontend URL.
 *
 * Handles all input forms:
 *   1. Complete https:// URL → return unchanged
 *   2. Local /images/... path → return unchanged
 *   3. InsForge object key (e.g. "books/cover.png") → build public bucket URL
 *   4. Legacy leading-slash value (e.g. "/images/books/cover.png") → treat as local path
 *   5. Empty or invalid → use fallback
 */
export function resolveCoverImage(value: string | null | undefined): string {
  if (!value || typeof value !== "string") return FALLBACK_IMAGE

  const trimmed = value.trim()
  if (!trimmed) return FALLBACK_IMAGE

  // 1. Complete URL — return as-is
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
  }

  // 2 & 4. Local path with leading slash — return as-is (served from public/)
  if (trimmed.startsWith("/")) {
    return trimmed
  }

  // 3. InsForge storage object key (no leading slash, no protocol) — build URL
  //    Only for the book-covers bucket (public)
  return `${INSFORGE_URL}/api/storage/buckets/book-covers/objects/${trimmed}`
}

/**
 * Resolves an OPTIONAL secondary cover (the hover image) into a URL.
 *
 * Unlike {@link resolveCoverImage} this returns `undefined` instead of a
 * fallback path when the value is missing. A missing hover image must stay
 * missing: substituting the placeholder here would stack a second image on top
 * of the real cover, which is exactly the duplicate-image bug this guards
 * against.
 */
export function resolveHoverImage(value: string | null | undefined): string | undefined {
  if (!value || typeof value !== "string" || !value.trim()) return undefined
  return resolveCoverImage(value)
}

/**
 * Resolve the single sellable ebook format from a book's `book_formats` rows.
 *
 * The store is ebook-only: only `delivery_type = 'digital'` rows are ever
 * exposed. Physical (paperbook) rows that still exist in the database are
 * ignored entirely — they can never be shown or bought. A book that has no
 * digital format is reported as an unavailable ebook so the storefront cannot
 * offer a product that cannot be delivered.
 */
function resolveEbookFormat(rows: any): BookFormat {
  const digital = ((rows || []) as any[]).filter(
    (f) => String(f?.delivery_type).toLowerCase() === "digital",
  )
  const chosen = digital[0]

  if (!chosen) {
    return { name: EBOOK_FORMAT_NAME, price: 0, available: false }
  }

  return {
    name: EBOOK_FORMAT_NAME,
    price: Number(chosen.price) || 0,
    compareAtPrice: chosen.compare_at_price || undefined,
    available: chosen.available === true,
  }
}

function mapRowToBook(row: any): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    // Single-category store: the raw taxonomy columns are not user-facing.
    // `categoryLabel` is always the Bengali label so no English key can leak.
    category: BOOK_CATEGORY,
    categoryLabel: BOOK_CATEGORY_LABEL,
    description: row.description,
    synopsis: row.synopsis || undefined,
    ebook: resolveEbookFormat(row.book_formats),
    publicationDate: row.publication_date || undefined,
    publisher: row.publisher || undefined,
    isbn: row.isbn || undefined,
    pages: row.pages || undefined,
    language: row.language || undefined,
    images: {
      primary: resolveCoverImage(row.cover_primary),
      hover: resolveHoverImage(row.cover_hover),
    },
    featured: row.featured || false,
    isNew: row.is_new || false,
    trending: row.trending || false,
    isDemo: row.is_demo || false,
  }
}

export interface GetBooksParams {
  category?: BookCategory
  sort?: "featured" | "price-asc" | "price-desc" | "newest"
  limit?: number
}

/**
 * Classifies a list-query result:
 *  - error → log + throw (a failure must never be cached as [])
 *  - no error, array returned → as-is ([] is a legitimate empty result)
 *  - no error, data missing → unexpected response shape: log + throw
 *    (a successful list select always yields an array, never null)
 */
export function resolveRows<T>(
  result: { data: T[] | null | undefined; error: { message?: string } | null },
  context: string,
): T[] {
  if (result.error) {
    console.error(`[books] ${context} failed`, result.error)
    throw new Error(`${context}: ${result.error.message || "query failed"}`)
  }
  if (!Array.isArray(result.data)) {
    console.error(`[books] ${context} returned no data`, result.data)
    throw new Error(`${context}: no data returned`)
  }
  return result.data
}

export async function getBooks(params: GetBooksParams = {}): Promise<Book[]> {
  const client = getClient()

  let query = client.database
    .from("books")
    .select("*, book_formats(*)")

  if (params.category) {
    query = query.eq("category", params.category)
  }
  if (params.limit) {
    query = query.limit(params.limit)
  }

  const rows = resolveRows(await query, `getBooks(${JSON.stringify(params)})`)

  let books = rows.map(mapRowToBook)

  // Client-side sort
  switch (params.sort) {
    case "price-asc":
      books.sort((a, b) => a.ebook.price - b.ebook.price)
      break
    case "price-desc":
      books.sort((a, b) => b.ebook.price - a.ebook.price)
      break
    case "newest":
      books.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0))
      break
    case "featured":
    default:
      books.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
  }

  return books
}

/**
 * Classifies a maybeSingle() query result:
 *  - error → log + throw (a failure must never be cached as a miss)
 *  - no error, no row → null (true not-found, safe to cache)
 *  - row → returned as-is
 */
export function resolveSingleRow<T>(
  result: { data: T | null; error: { message?: string } | null },
  context: string,
): T | null {
  if (result.error) {
    console.error(`[books] ${context} failed`, result.error)
    throw new Error(`${context}: ${result.error.message || "query failed"}`)
  }
  return result.data
}

export async function getBookById(id: string): Promise<Book | null> {
  const client = getClient()

  const { data, error } = await client.database
    .from("books")
    .select("*, book_formats(*)")
    .eq("id", id)
    .maybeSingle()

  const row = resolveSingleRow({ data, error }, `getBookById(${id})`)
  if (!row) return null

  return mapRowToBook(row)
}

export async function getFeatured(): Promise<Book[]> {
  const client = getClient()

  const result = await client.database
    .from("books")
    .select("*, book_formats(*)")
    .eq("featured", true)
    .limit(6)

  return resolveRows(result, "getFeatured()").map(mapRowToBook)
}

export async function getNewReleases(): Promise<Book[]> {
  const client = getClient()

  const result = await client.database
    .from("books")
    .select("*, book_formats(*)")
    .eq("is_new", true)
    .limit(6)

  return resolveRows(result, "getNewReleases()").map(mapRowToBook)
}

export async function getTrending(): Promise<Book[]> {
  const client = getClient()

  const result = await client.database
    .from("books")
    .select("*, book_formats(*)")
    .eq("trending", true)
    .limit(6)

  return resolveRows(result, "getTrending()").map(mapRowToBook)
}

export async function getRelated(id: string): Promise<Book[]> {
  // getBookById already logs + throws on failure — never degrade that to []
  const book = await getBookById(id)
  if (!book) return []
  return getBooks({ category: book.category, limit: 4 })
}

export type SiteSettings = Record<string, any>

function unwrapJsonString(value: any): any {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (typeof parsed === "string") return parsed
    } catch {
      /* not a JSON string */
    }
  }
  return value
}

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const res = await fetch(`${INSFORGE_URL}/api/database/rpc/get_site_settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: INSFORGE_ANON_KEY,
        Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
      },
      body: "{}",
    })
    if (!res.ok) return {}
    const data = await res.json()
    const out: SiteSettings = {}
    for (const [key, value] of Object.entries(data || {})) {
      out[key] = unwrapJsonString(value)
    }
    return out
  } catch {
    return {}
  }
}

export interface Post {
  id: string
  slug: string
  title: string
  excerpt?: string | null
  content?: string | null
  status?: string
  post_type?: string
  author_name?: string | null
  published_at?: string | null
  tags?: string[] | null
  cover_image?: string | null
  meta_description?: string | null
}

export async function getPublishedPosts(): Promise<Post[]> {
  try {
    const res = await fetch(`${INSFORGE_URL}/api/database/records/posts?status=eq.published&order=published_at.desc`, {
      headers: { apikey: INSFORGE_ANON_KEY, Authorization: `Bearer ${INSFORGE_ANON_KEY}` },
    })
    if (!res.ok) return []
    return (await res.json()) as Post[]
  } catch {
    return []
  }
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  try {
    const res = await fetch(
      `${INSFORGE_URL}/api/database/records/posts?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=*`,
      { headers: { apikey: INSFORGE_ANON_KEY, Authorization: `Bearer ${INSFORGE_ANON_KEY}` } },
    )
    if (!res.ok) return null
    const posts = (await res.json()) as Post[]
    return posts[0] || null
  } catch {
    return null
  }
}
