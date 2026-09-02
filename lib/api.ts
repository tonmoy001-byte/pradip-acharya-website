// lib/api.ts
// Fetches books from InsForge database.
// Books added in the dashboard appear on the site automatically.
// Uses basic client (no auth cookies) since book data is public.

import { createClient } from "@insforge/sdk"
import type { Book, BookCategory, BookFormat } from "./data"

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL || "https://cpd9mnqf.ap-southeast.insforge.app"
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || "anon_34290d5cd8a56b6f0a9885ad57385af0fe4d38bd8fe02104e94f3f36d8b705e2"

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

function mapRowToBook(row: any): Book {
  const formats = (row.book_formats || []) as any[]
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    category: row.category as BookCategory,
    subcategory: row.subcategory,
    subcategorySlug: row.subcategory_slug,
    description: row.description,
    synopsis: row.synopsis || undefined,
    formats: formats.map((f) => ({
      name: f.format_name as BookFormat["name"],
      price: f.price,
      compareAtPrice: f.compare_at_price || undefined,
      available: f.available,
    })),
    publicationDate: row.publication_date || undefined,
    publisher: row.publisher || undefined,
    isbn: row.isbn || undefined,
    pages: row.pages || undefined,
    language: row.language || undefined,
    images: {
      primary: resolveCoverImage(row.cover_primary),
      hover: resolveCoverImage(row.cover_hover),
    },
    featured: row.featured || false,
    isNew: row.is_new || false,
    trending: row.trending || false,
    isDemo: row.is_demo || false,
  }
}

export interface GetBooksParams {
  category?: BookCategory
  subcategorySlug?: string
  sort?: "featured" | "price-asc" | "price-desc" | "newest"
  query?: string
  limit?: number
}

export async function getBooks(params: GetBooksParams = {}): Promise<Book[]> {
  const client = getClient()

  let query = client.database
    .from("books")
    .select("*, book_formats(*)")

  if (params.category) {
    query = query.eq("category", params.category)
  }
  if (params.subcategorySlug) {
    query = query.eq("subcategory_slug", params.subcategorySlug)
  }
  if (params.limit) {
    query = query.limit(params.limit)
  }

  const { data, error } = await query

  if (error || !data) return []

  let books = data.map(mapRowToBook)

  // Client-side sort
  switch (params.sort) {
    case "price-asc":
      books.sort((a, b) => a.formats[0]?.price - b.formats[0]?.price)
      break
    case "price-desc":
      books.sort((a, b) => b.formats[0]?.price - a.formats[0]?.price)
      break
    case "newest":
      books.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0))
      break
    case "featured":
    default:
      books.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
  }

  // Text search
  if (params.query) {
    const q = params.query.toLowerCase()
    books = books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q),
    )
  }

  return books
}

export async function getBookById(id: string): Promise<Book | null> {
  const client = getClient()

  const { data, error } = await client.database
    .from("books")
    .select("*, book_formats(*)")
    .eq("id", id)
    .single()

  if (error || !data) return null

  return mapRowToBook(data)
}

export async function getFeatured(): Promise<Book[]> {
  const client = getClient()

  const { data, error } = await client.database
    .from("books")
    .select("*, book_formats(*)")
    .eq("featured", true)
    .limit(6)

  if (error || !data) return []
  return data.map(mapRowToBook)
}

export async function getNewReleases(): Promise<Book[]> {
  const client = getClient()

  const { data, error } = await client.database
    .from("books")
    .select("*, book_formats(*)")
    .eq("is_new", true)
    .limit(6)

  if (error || !data) return []
  return data.map(mapRowToBook)
}

export async function getTrending(): Promise<Book[]> {
  const client = getClient()

  const { data, error } = await client.database
    .from("books")
    .select("*, book_formats(*)")
    .eq("trending", true)
    .limit(6)

  if (error || !data) return []
  return data.map(mapRowToBook)
}

export async function getRelated(id: string): Promise<Book[]> {
  const book = await getBookById(id)
  if (!book) return []
  return getBooks({ category: book.category, limit: 4 })
}

export async function getAllSubcategories(): Promise<{ slug: string; label: string }[]> {
  const client = getClient()

  const { data, error } = await client.database
    .from("books")
    .select("subcategory, subcategory_slug")

  if (error || !data) return []

  const seen = new Map<string, string>()
  for (const row of data) {
    if (!seen.has(row.subcategory_slug)) {
      seen.set(row.subcategory_slug, row.subcategory)
    }
  }
  return Array.from(seen.entries()).map(([slug, label]) => ({ slug, label }))
}
