import { notFound } from "next/navigation"
import { getCachedBookById, getCachedRelated } from "@/lib/public-cache"
import { pageMetadata } from "@/lib/seo"
import { bookMetaDescription } from "@/lib/book-meta"
import { bookGraph } from "@/lib/structured-data"
import { possessive } from "@/lib/format"
import JsonLd from "@/components/JsonLd"
import BookDetailClient from "./BookDetailClient"
import BookGrid from "@/components/BookGrid"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const book = await getCachedBookById(id)
  if (!book) notFound()

  return pageMetadata({
    title: `${book.title} — ${possessive(book.author)} বাংলা উপন্যাস`,
    description: bookMetaDescription(book),
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

  // Visible FAQ and FAQPage markup share this array so they can never drift.
  // Every answer states only what the code supports: PDF format
  // (encodingFormat in structured-data), per-grant max_downloads limits
  // (my-downloads route), and the /contact ~24h support note.
  const faq = [
    {
      q: "ইবুকের ফরম্যাট কী?",
      a: "ডিজিটাল ইবুক (PDF)। কেনার পর “আমার ডাউনলোড” থেকে PDF ফাইলটি নামিয়ে নিতে পারবেন।",
    },
    {
      q: "কোন ডিভাইসে পড়া যাবে?",
      a: "যেকোনো মোবাইল, ট্যাব, কম্পিউটার বা ই-রিডারে — যেখানে PDF পড়া যায়।",
    },
    {
      q: "ডাউনলোড কতবার করা যাবে?",
      a: "প্রতিটি অর্ডারে নির্দিষ্ট সংখ্যক ডাউনলোডের সুযোগ থাকে। সীমা শেষ হয়ে গেলে যোগাযোগ ফর্মে বার্তা পাঠান।",
    },
    {
      q: "পেমেন্টের পর লিংক না পেলে কী করব?",
      a: "প্রথমে “আমার ডাউনলোড” পাতাটি দেখুন। লিংক না পেলে পেমেন্টের ট্রানজেকশন আইডিসহ যোগাযোগ করুন — সাধারণত ২৪ ঘণ্টার মধ্যে সমাধান দেওয়া হয়।",
    },
  ]

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }

  return (
    <div className="container section-padding">
      <JsonLd data={[bookGraph(book), faqLd]} />

      <div className="book-detail">
        <BookDetailClient book={book} />
      </div>

      <section style={{ marginTop: "var(--sp-16)", maxWidth: 700, marginInline: "auto" }}>
        <h2 style={{ textAlign: "center", marginBottom: "var(--sp-8)" }}>সাধারণ জিজ্ঞাসা</h2>
        {faq.map((f) => (
          <details key={f.q} style={{ marginBottom: "var(--sp-3)" }}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

      {relatedFiltered.length > 0 && (
        <section style={{ marginTop: "var(--sp-16)" }}>
          <h2 style={{ textAlign: "center", marginBottom: "var(--sp-8)" }}>সম্পর্কিত বই</h2>
          <BookGrid books={relatedFiltered} />
        </section>
      )}
    </div>
  )
}
