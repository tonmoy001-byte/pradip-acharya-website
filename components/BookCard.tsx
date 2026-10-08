"use client"

import Image from "next/image"
import Link from "next/link"
import type { Book } from "@/lib/data"
import { money } from "@/lib/format"
import BuyNowButton from "./BuyNowButton"

interface BookCardProps {
  book: Book
}

export default function BookCard({ book }: BookCardProps) {
  const { ebook } = book

  // "বাংলা উপন্যাস". Falls back to whichever part exists so a book missing a
  // language still reads as a heading rather than a dangling dash.
  const qualifier = [book.language, book.categoryLabel].filter(Boolean).join(" ").trim()

  return (
    <div className="book-card">
      <Link href={`/book/${book.id}`} className="book-card-link">
        <div className="book-card-image-wrap">
          <Image
            src={book.images.primary}
            alt={book.title}
            className="book-card-image primary"
            width={300}
            height={400}
            sizes="(max-width: 560px) 50vw, (max-width: 900px) 33vw, 240px"
          />
          <div className="book-card-badges">
            {book.isDemo ? (
              <span className="badge badge-terracotta book-card-badge">ডেমো</span>
            ) : (
              book.isNew && <span className="badge badge-green book-card-badge">নতুন</span>
            )}
            <span className="badge badge-neutral book-card-badge">ইবুক</span>
          </div>
        </div>
        <div className="book-card-body">
          {/* The bare title repeated the page's H1/H2 word for word. Qualifying
              it with the language and category keeps the heading
              self-describing and adds the searchable terms a card grid should
              carry. Both values come from the database, never a literal. */}
          <h3 className="book-card-title">
            {book.title}
            {qualifier ? <span className="book-card-title-sub"> — {qualifier}</span> : null}
          </h3>
          <p className="book-card-author">{book.author}</p>
          <p className="book-card-price">{money(ebook.price)}</p>
        </div>
      </Link>
      <div className="book-card-actions">
        <BuyNowButton
          bookId={book.id}
          title={book.title}
          available={ebook.available}
          className="card-buy-btn"
        />
      </div>
    </div>
  )
}
