"use client"

import { useState } from "react"
import type { Book, BookFormatName } from "@/lib/data"
import { money } from "@/lib/format"
import { useCart } from "@/lib/store"
import { useToast } from "@/components/Toast"
import Gallery from "@/components/Gallery"
import FormatSelector from "@/components/FormatSelector"
import QtyStepper from "@/components/QtyStepper"

interface BookDetailClientProps {
  book: Book
}

export default function BookDetailClient({ book }: BookDetailClientProps) {
  const [selectedFormat, setSelectedFormat] = useState<BookFormatName>(book.formats[0].name)
  const [quantity, setQuantity] = useState(1)
  const { addToCart } = useCart()
  const { showToast } = useToast()

  const currentFormat = book.formats.find((f) => f.name === selectedFormat) || book.formats[0]

  function handleAddToCart() {
    addToCart({
      bookId: book.id,
      title: book.title,
      author: book.author,
      price: currentFormat.price,
      format: selectedFormat,
      quantity,
      image: book.images.primary,
    })
    showToast(`${book.title} কার্টে যোগ হয়েছে`)
  }

  return (
    <>
      <Gallery images={book.images} alt={book.title} />

      <div className="book-detail-info">
        <span className="badge badge-terracotta" style={{ marginBottom: "var(--sp-3)" }}>
          {book.subcategory}
        </span>
        <h1>{book.title}</h1>
        <p className="book-detail-author">{book.author}</p>

        <div className="book-detail-price">
          {money(currentFormat.price)}
          {currentFormat.compareAtPrice && (
            <span className="compare-at">{money(currentFormat.compareAtPrice)}</span>
          )}
        </div>

        <div className="book-detail-description">
          <p>{book.description}</p>
          {book.synopsis && <p style={{ marginTop: "var(--sp-3)" }}>{book.synopsis}</p>}
        </div>

        {(book.publisher || book.pages || book.isbn || book.language || book.publicationDate) && (
          <dl className="book-detail-meta">
            {book.publisher && (
              <>
                <dt>প্রকাশক</dt>
                <dd>{book.publisher}</dd>
              </>
            )}
            {book.pages && (
              <>
                <dt>পৃষ্ঠা</dt>
                <dd>{book.pages}</dd>
              </>
            )}
            {book.language && (
              <>
                <dt>ভাষা</dt>
                <dd>{book.language}</dd>
              </>
            )}
            {book.isbn && (
              <>
                <dt>ISBN</dt>
                <dd>{book.isbn}</dd>
              </>
            )}
            {book.publicationDate && (
              <>
                <dt>প্রকাশকাল</dt>
                <dd>{book.publicationDate}</dd>
              </>
            )}
          </dl>
        )}

        <FormatSelector
          formats={book.formats}
          selected={selectedFormat}
          onSelect={setSelectedFormat}
        />

        <QtyStepper value={quantity} onChange={setQuantity} />

        <div className="add-to-cart-row">
          <button className="btn btn-primary" onClick={handleAddToCart} style={{ flex: 1 }}>
            কার্টে যোগ করুন
          </button>
        </div>

        <div className="delivery-info">
          <p>ডেলিভারি: ৬০ টাকা। ৭৫০ টাকার বেশি অর্ডারে বিনামূল্যে ডেলিভারি।</p>
        </div>
      </div>
    </>
  )
}
