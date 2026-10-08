"use client"

import type { Book } from "@/lib/data"
import { money } from "@/lib/format"
import { possessive } from "@/lib/format"
import Gallery from "@/components/Gallery"
import PaymentBadges from "@/components/PaymentBadges"
import BuyNowButton from "@/components/BuyNowButton"
import Link from "next/link"

interface BookDetailClientProps {
  book: Book
}

export default function BookDetailClient({ book }: BookDetailClientProps) {
  const { ebook } = book

  function formatPublicationDate(value?: string): string | undefined {
    if (!value) return undefined
    const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"]
    const bnMonths = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"]
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    const year = String(d.getFullYear()).split("").map((c) => bnDigits[Number(c)] ?? c).join("")
    return `${bnMonths[d.getMonth()]} ${year}`
  }

  const publicationDateLabel = formatPublicationDate(book.publicationDate)

  return (
    <>
      <Gallery images={book.images} alt={`${book.title} বাংলা উপন্যাসের প্রচ্ছদ`} />

      <div className="book-detail-info">
        <span className="badge badge-terracotta" style={{ marginBottom: "var(--sp-3)" }}>
          {book.categoryLabel}
        </span>
        <h1>{book.title}</h1>
        <p className="book-detail-author">{book.author}</p>

        <div className="book-detail-price">
          {money(ebook.price)}
          {ebook.compareAtPrice && (
            <span className="compare-at">{money(ebook.compareAtPrice)}</span>
          )}
        </div>

        <div className="book-detail-description">
          <p>{book.description}</p>
          {book.synopsis && <p style={{ marginTop: "var(--sp-3)" }}>{book.synopsis}</p>}
        </div>

        {(book.publisher || book.pages || book.isbn || book.language || publicationDateLabel) && (
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
            {publicationDateLabel && (
              <>
                <dt>প্রকাশকাল</dt>
                <dd>{publicationDateLabel}</dd>
              </>
            )}
          </dl>
        )}

        <div className="add-to-cart-row">
          <BuyNowButton
            bookId={book.id}
            title={book.title}
            available={ebook.available}
            label="ইবুক কিনুন"
            style={{ flex: 1 }}
          />
        </div>

        <PaymentBadges />

        {/* Short, factual summary plus the practical "how do I get this"
            information a buyer needs. Every fact here is already shown
            elsewhere on the page or stored with the book. */}
        <section className="book-detail-facts" style={{ marginTop: "var(--sp-6)" }}>
          <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--sp-3)" }}>
            {book.title} — বাংলা সামাজিক উপন্যাস
          </h2>
          <p style={{ marginBottom: "var(--sp-3)" }}>
            “{book.title}” হলো {possessive(book.author)} একটি বাংলা সামাজিক উপন্যাস, যা বাস্তব ও
            কাল্পনিক কাহিনির সমন্বয়ে রচিত। উপন্যাসটি ডিজিটাল ইবুক (PDF) আকারে পাওয়া যায়।
          </p>

          <h2 style={{ fontSize: "1.125rem", marginTop: "var(--sp-5)", marginBottom: "var(--sp-3)" }}>
            ইবুক কীভাবে পাবেন
          </h2>
          <ol style={{ paddingLeft: "1.25rem", marginBottom: "var(--sp-3)" }}>
            <li style={{ marginBottom: "var(--sp-2)" }}>
              উপরের “ইবুক কিনুন” বোতামে ক্লিক করে অর্ডার সম্পন্ন করুন।
            </li>
            <li style={{ marginBottom: "var(--sp-2)" }}>
              bKash, Nagad, Rocket বা কার্ড দিয়ে পেমেন্ট করুন।
            </li>
            <li>পেমেন্ট সফল হলেই “আমার ডাউনলোড” থেকে PDF ফাইল নামিয়ে নিন।</li>
          </ol>

          <p style={{ display: "flex", gap: "var(--sp-4)", flexWrap: "wrap", marginTop: "var(--sp-4)" }}>
            <Link href="/about" style={{ color: "var(--terracotta)", fontWeight: 500 }}>
              {book.author}র লেখক পরিচিতি পড়ুন
            </Link>
            <Link href="/contact" style={{ color: "var(--terracotta)", fontWeight: 500 }}>
              ইবুক সংগ্রহে সহায়তা প্রয়োজন? যোগাযোগ করুন
            </Link>
          </p>
        </section>
      </div>
    </>
  )
}
