// lib/data.ts
// Core types, store configuration, and seed book data.
// This is the single source of truth for the demo catalogue.

export type BookCategory = "novels" | "books"
export type BookFormatName = "Paperback" | "eBook"

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
  category: BookCategory
  subcategory: string
  subcategorySlug: string
  description: string
  synopsis?: string
  formats: BookFormat[]
  publicationDate?: string
  publisher?: string
  isbn?: string
  pages?: number
  language?: string
  images: { primary: string; hover?: string }
  featured: boolean
  isNew: boolean
  trending: boolean
  isDemo?: boolean
}

// Store configuration
export const STORE_LOCALE = "bn-BD"
export const STORE_CURRENCY = "BDT"
export const DELIVERY_CHARGE = 60
export const FREE_DELIVERY_THRESHOLD = 750

// Subcategory slug-to-label mapping
export const SUBCATEGORY_MAP: Record<string, string> = {
  novels: "উপন্যাস",
  poetry: "কবিতা",
  essays: "প্রবন্ধ",
}

// Category display names
export const CATEGORIES: { slug: string; label: string; category: BookCategory }[] = [
  { slug: "novels", label: "উপন্যাস", category: "novels" },
  { slug: "literary-books", label: "সাহিত্য বই", category: "books" },
]

// Seed data
export const BASE_BOOKS: Book[] = [
  {
    id: "chhera-pushpo",
    title: "ছেঁড়া পুষ্প",
    author: "প্রদীপ কুমার আচার্য্য",
    category: "novels",
    subcategory: "উপন্যাস",
    subcategorySlug: "novels",
    description: "একটি উপন্যাস যেখানে স্মৃতি ও বর্তমানের মিলন ঘটে।",
    synopsis:
      "ছেঁড়া পুষ্প প্রদীপ কুমার আচার্য্যের একটি উল্লেখযোগ্য উপন্যাস। এই গল্পে আমরা দেখতে পাই...",
    formats: [
      { name: "Paperback", price: 450, compareAtPrice: 550, available: true },
      { name: "eBook", price: 199, available: true },
    ],
    publicationDate: "2026-01-01",
    publisher: "সাহিত্য প্রকাশ",
    pages: 320,
    language: "বাংলা",
    images: {
      primary: "/images/books/chhera-pushpo-1.png",
      hover: "/images/books/chhera-pushpo-2.png",
    },
    featured: true,
    isNew: true,
    trending: true,
  },
  {
    id: "demo-poetry-1",
    title: "স্বপ্নের ডানায়",
    author: "ডেমো লেখক",
    category: "books",
    subcategory: "কবিতা",
    subcategorySlug: "poetry",
    description: "ডেমো কবিতা সংকলন।",
    formats: [{ name: "Paperback", price: 250, available: true }],
    images: {
      primary:
        "https://images.unsplash.com/photo-1524578271613-d550eacf6090?auto=format&fit=crop&w=900&q=80",
    },
    featured: false,
    isNew: true,
    trending: false,
    isDemo: true,
  },
  {
    id: "demo-novel-1",
    title: "নদীর স্বর",
    author: "ডেমো লেখক",
    category: "novels",
    subcategory: "উপন্যাস",
    subcategorySlug: "novels",
    description: "ডেমো উপন্যাস।",
    formats: [{ name: "Paperback", price: 350, available: true }],
    images: {
      primary:
        "https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&w=900&q=80",
    },
    featured: false,
    isNew: false,
    trending: true,
    isDemo: true,
  },
]

// Merge base + generated books
import { generatedBooks } from "./generated-books"
export const BOOKS: Book[] = [...BASE_BOOKS, ...generatedBooks]

// Helper: get subcategories for a category from active catalogue
export function subcategoriesFor(category?: BookCategory): { slug: string; label: string }[] {
  const books = category ? BOOKS.filter((b) => b.category === category) : BOOKS
  const seen = new Set<string>()
  return books
    .filter((b) => {
      if (seen.has(b.subcategorySlug)) return false
      seen.add(b.subcategorySlug)
      return true
    })
    .map((b) => ({ slug: b.subcategorySlug, label: b.subcategory }))
}
