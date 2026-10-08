import { notFound } from "next/navigation"
import { getCachedBookById, getCachedRelated } from "@/lib/public-cache"
import { pageMetadata } from "@/lib/seo"
import { bookGraph } from "@/lib/structured-data"
import { possessive } from "@/lib/format"
import JsonLd from "@/components/JsonLd"
import BookDetailClient from "./BookDetailClient"
import BookGrid from "@/components/BookGrid"

const PAGE_DESCRIPTION =
  "“ছেঁড়া পুষ্প” প্রদীপ কুমার আচার্য্যের একটি সামাজিক বাংলা উপন্যাস। কাহিনি, লেখক পরিচিতি, ইবুকের তথ্য এবং ৳৫০ মূল্যে সংগ্রহের পদ্ধতি দেখুন।"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const book = await getCachedBookById(id)
  if (!book) notFound()

  return pageMetadata({
    title: `${book.title} — ${possessive(book.author)} বাংলা উপন্যাস`,
    description: PAGE_DESCRIPTION,
    path: `/book/${book.id}`,
    image: book.images.primary,
    imageAlt: `${book.title} বাংলা উপন্যাসের প্রচ্ছদ`,
    keywords: [
      book.title,
      `${book.title} উপন্যাস`,
      `${book.title} ইবুক`,
      `${book.title} PDF`,
      book.author,
      "বাংলা সামাজিক উপন্যাস",
      // English transliterations so Latin-script searches can find the book.
      "Chhera Pushpo",
      "Chera Pushpo",
      "ছেড়া পুষ্প",
    ],
    type: "book",
  })
}

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const book = await getCachedBookById(id)

  if (!book) {
    notFound()
  }

  const related = await getCachedRelated(id)
  const relatedFiltered = related.filter((b) => b.id !== book.id).slice(0, 4)

  return (
    <div className="container section-padding">
      <JsonLd data={bookGraph(book)} />

      <div className="book-detail">
        <BookDetailClient book={book} />
      </div>

      {relatedFiltered.length > 0 && (
        <section style={{ marginTop: "var(--sp-16)" }}>
          <h2 style={{ textAlign: "center", marginBottom: "var(--sp-8)" }}>সম্পর্কিত বই</h2>
          <BookGrid books={relatedFiltered} />
        </section>
      )}
    </div>
  )
}
