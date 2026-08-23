// lib/api.ts
// Mock async service layer - the backend-swap seam.
// Replace these with fetch() calls when connecting a real API.
// No page-level changes needed when swapping backends.

import { BOOKS, type Book, type BookCategory } from "./data"

export interface GetBooksParams {
  category?: BookCategory
  subcategorySlug?: string
  sort?: "featured" | "price-asc" | "price-desc" | "newest"
  query?: string
  limit?: number
}

function delay(ms: number = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function getBooks(params: GetBooksParams = {}): Promise<Book[]> {
  await delay()
  let books = [...BOOKS]

  if (params.category) {
    books = books.filter((b) => b.category === params.category)
  }
  if (params.subcategorySlug) {
    books = books.filter((b) => b.subcategorySlug === params.subcategorySlug)
  }
  if (params.query) {
    const q = params.query.toLowerCase()
    books = books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.subcategory.toLowerCase().includes(q),
    )
  }

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

  if (params.limit) {
    books = books.slice(0, params.limit)
  }

  return books
}

export async function getBookById(id: string): Promise<Book | null> {
  await delay()
  return BOOKS.find((b) => b.id === id) ?? null
}

export async function getFeatured(): Promise<Book[]> {
  return getBooks({ sort: "featured", limit: 6 })
}

export async function getNewReleases(): Promise<Book[]> {
  return getBooks({ sort: "newest", limit: 6 })
}

export async function getTrending(): Promise<Book[]> {
  await delay()
  return BOOKS.filter((b) => b.trending).slice(0, 6)
}

export async function getRelated(id: string): Promise<Book[]> {
  const book = await getBookById(id)
  if (!book) return []
  return getBooks({ category: book.category, limit: 4 })
}

export async function getAllSubcategories(): Promise<{ slug: string; label: string }[]> {
  await delay()
  const seen = new Map<string, string>()
  for (const book of BOOKS) {
    if (!seen.has(book.subcategorySlug)) {
      seen.set(book.subcategorySlug, book.subcategory)
    }
  }
  return Array.from(seen.entries()).map(([slug, label]) => ({ slug, label }))
}
