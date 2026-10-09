// lib/book-meta.ts
// Per-book SEO description, derived from the book record — never hardcoded.
//
// The old PAGE_DESCRIPTION named one title, one author and one price, so every
// future book would have inherited stale text. This builds the description from
// the book's own description (first ~150 chars, cut at a word boundary) plus
// the live ebook price via money().

import type { Book } from "./data"
import { money } from "./format"

const MAX_SNIPPET_CHARS = 150

type BookMetaSource = Pick<Book, "title" | "author" | "description"> & {
  ebook: Pick<Book["ebook"], "price">
}

/** Collapse whitespace so DB text with newlines becomes one flowing sentence. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

/** Cut at the last space within the limit so words are never split. */
function truncateAtWord(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const cut = text.lastIndexOf(" ", maxChars)
  return cut > 0 ? text.slice(0, cut) : text.slice(0, maxChars)
}

export function bookMetaDescription(book: BookMetaSource): string {
  const snippet = truncateAtWord(collapseWhitespace(book.description || ""), MAX_SNIPPET_CHARS)
  const priceLine = `ডিজিটাল ইবুক (PDF), মূল্য ${money(book.ebook.price)}।`

  if (!snippet) {
    return `${book.title} — ${book.author}-এর বাংলা বই। ${priceLine}`
  }
  return `${snippet} ${priceLine}`
}
