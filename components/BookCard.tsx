"use client"

import Link from "next/link"
import type { Book } from "@/lib/data"
import { money } from "@/lib/format"
import { useCart } from "@/lib/store"
import { useToast } from "./Toast"

interface BookCardProps {
  book: Book
}

export default function BookCard({ book }: BookCardProps) {
  const { addToCart } = useCart()
  const { showToast } = useToast()

  const lowestPrice = Math.min(...book.formats.map((f) => f.price))
  const hasMultipleFormats = book.formats.length > 1

  function handleQuickAdd() {
    const defaultFormat = book.formats[0]
    addToCart({
      bookId: book.id,
      title: book.title,
      author: book.author,
      price: defaultFormat.price,
      format: defaultFormat.name,
      image: book.images.primary,
    })
    showToast(`${book.title} কার্টে যোগ হয়েছে`)
  }

  return (
    <div className="book-card">
      <Link href={`/book/${book.id}`} className="book-card-link">
        <div className="book-card-image-wrap">
          <img
            src={book.images.primary}
            alt={book.title}
            className="book-card-image primary"
          />
          {book.images.hover && (
            <img
              src={book.images.hover}
              alt=""
              className="book-card-image hover"
              aria-hidden="true"
            />
          )}
          {book.isDemo && (
            <span className="badge badge-terracotta book-card-badge">ডেমো</span>
          )}
          {book.isNew && !book.isDemo && (
            <span className="badge badge-green book-card-badge">নতুন</span>
          )}
        </div>
        <div className="book-card-body">
          <span className="book-card-subcategory">{book.subcategory}</span>
          <h3 className="book-card-title">{book.title}</h3>
          <p className="book-card-author">{book.author}</p>
          <p className="book-card-price">{money(lowestPrice)}</p>
        </div>
      </Link>
      <div className="book-card-actions">
        <button
          className="quick-add-btn"
          onClick={handleQuickAdd}
          aria-label={`${book.title} কার্টে যোগ করুন`}
        >
          {hasMultipleFormats ? "বিকল্প নির্বাচন করুন" : "কার্টে যোগ করুন"}
        </button>
      </div>
    </div>
  )
}
