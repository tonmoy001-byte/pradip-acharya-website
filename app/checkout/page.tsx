import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getCachedBookById } from "@/lib/public-cache"
import CheckoutClient, { type DirectItem } from "./CheckoutClient"

// Transactional page: reachable for the customer, never in search results.
export const metadata: Metadata = {
  title: "চেকআউট",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

interface CheckoutPageProps {
  searchParams: Promise<{ book?: string }>
}

/**
 * Checkout resolves what is being bought from the URL.
 *
 * A buy-now link arrives as `/checkout?book=<id>`. The book is fetched on the
 * server, so the order summary shows the real title, cover and price and a
 * tampered query string cannot invent either. Nothing is written to a cart:
 * the order is created straight from this reference.
 *
 * There is no quantity — one customer buys one copy of the single ebook.
 */
export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const { book: bookId } = await searchParams

  let directItem: DirectItem | null = null
  if (bookId) {
    const book = await getCachedBookById(bookId)
    if (!book) notFound()
    directItem = {
      bookId: book.id,
      title: book.title,
      price: book.ebook.price,
      image: book.images.primary,
      quantity: 1,
    }
  }

  return <CheckoutClient directItem={directItem} />
}
