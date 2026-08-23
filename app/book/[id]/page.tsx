import { notFound } from "next/navigation"
import { getBookById, getRelated } from "@/lib/api"
import { money } from "@/lib/format"
import BookDetailClient from "./BookDetailClient"
import BookGrid from "@/components/BookGrid"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const book = await getBookById(id)
  if (!book) return { title: "বই পাওয়া যায়নি" }
  return {
    title: `${book.title} | ${book.author}`,
    description: book.description,
    openGraph: {
      title: `${book.title} — ${book.author}`,
      description: book.description,
      siteName: "প্রদীপ কুমার আচার্য্য",
      locale: "bn_BD",
      type: "website",
    },
  }
}

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const book = await getBookById(id)

  if (!book) {
    notFound()
  }

  const related = await getRelated(id)
  const relatedFiltered = related.filter((b) => b.id !== book.id).slice(0, 4)

  return (
    <div className="container section-padding">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: book.title,
            description: book.description,
            author: { "@type": "Person", name: book.author },
            image: book.images.primary,
            offers: book.formats.map((f) => ({
              "@type": "Offer",
              price: f.price,
              priceCurrency: "BDT",
              availability: f.available
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            })),
          }),
        }}
      />

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
