// lib/api-db.ts
// Database-backed API layer - fetches books from InsForge database.

import { createServerClient } from "./insforge-server"
import type { Book, BookCategory, BookFormat } from "./data"

function mapRowToBook(row: any, formats: any[]): Book {
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
      primary: row.cover_primary || "/images/books/placeholder.jpg",
      hover: row.cover_hover || undefined,
    },
    featured: row.featured || false,
    isNew: row.is_new || false,
    trending: row.trending || false,
    isDemo: row.is_demo || false,
  }
}

export async function getBooksFromDB(params: {
  category?: BookCategory
  subcategorySlug?: string
  sort?: string
  limit?: number
}): Promise<Book[]> {
  const client = await createServerClient()

  let query = client.database
    .from("books")
    .select("*, book_formats(*)")
    .order("created_at", { ascending: false })

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

  let books = data.map((row) => mapRowToBook(row, row.book_formats || []))

  // Sort
  switch (params.sort) {
    case "price-asc":
      books.sort((a, b) => a.formats[0].price - b.formats[0].price)
      break
    case "price-desc":
      books.sort((a, b) => b.formats[0].price - a.formats[0].price)
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

export async function getBookByIdFromDB(id: string): Promise<Book | null> {
  const client = await createServerClient()

  const { data, error } = await client.database
    .from("books")
    .select("*, book_formats(*)")
    .eq("id", id)
    .single()

  if (error || !data) return null

  return mapRowToBook(data, data.book_formats || [])
}
