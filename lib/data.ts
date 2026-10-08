// lib/data.ts
// Core types and store configuration.
//
// This store is EBOOK-ONLY. A book is sold exclusively as a digital ebook
// (PDF) that is delivered through an admin-approved download grant. There is
// no paperbook / physical format, no shipping and no courier.

/**
 * The store carries exactly one book category: উপন্যাস.
 *
 * There is no multi-category taxonomy and no subcategory tree. The
 * `books.category`, `books.subcategory` and `books.subcategory_slug` columns
 * still exist in the database, but the application no longer maintains a
 * category system the single-title catalog cannot use: `novels` is the only
 * legal value and `subcategory_slug` is held equal to it.
 */
export const BOOK_CATEGORY = "novels" as const
export type BookCategory = typeof BOOK_CATEGORY

/**
 * Bengali display label for {@link BOOK_CATEGORY}. Render this in the UI —
 * never the raw `novels` key, which is for logic and filtering only.
 */
export const BOOK_CATEGORY_LABEL = "উপন্যাস" as const

/** The single purchasable product format. */
export const EBOOK_FORMAT_NAME = "eBook" as const
export type BookFormatName = typeof EBOOK_FORMAT_NAME

/** Digital delivery type used by `book_formats.delivery_type` / order snapshots. */
export const EBOOK_DELIVERY_TYPE = "digital" as const

export interface BookFormat {
  name: BookFormatName
  price: number
  compareAtPrice?: number
  available: boolean
}

export interface Book {
  id: string
  title: string
  author: string
  /** Always {@link BOOK_CATEGORY}. Kept because `books.category` is a real column. */
  category: BookCategory
  /** Bengali label for {@link BookCategory}. Use this for display, not `category`. */
  categoryLabel: string
  description: string
  synopsis?: string
  /** The one and only product: the ebook. */
  ebook: BookFormat
  publicationDate?: string
  publisher?: string
  isbn?: string
  pages?: number
  language?: string
  /**
   * `hover` is an optional secondary cover. It stays absent when the book has
   * no distinct second image — never substitute a placeholder, that would stack
   * a second image on top of the real cover.
   */
  images: { primary: string; hover?: string }
  featured: boolean
  isNew: boolean
  trending: boolean
  isDemo?: boolean
}

// Store configuration
export const STORE_LOCALE = "bn-BD"
export const STORE_CURRENCY = "BDT"
