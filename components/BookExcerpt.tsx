import Link from "next/link"
import ScrollReveal from "@/components/ScrollReveal"

interface BookExcerptProps {
  slug: string
  /**
   * The full excerpt lives in `books.synopsis` and is edited from the admin
   * book form. The homepage shows a shorter pull-quote, which is a curated
   * marketing moment rather than a prefix of the full text — so it stays here
   * instead of in the database.
   */
  teaser: string[]
}

/**
 * "উপন্যাস থেকে এক ঝলক" — a few lines from the book, immediately after the
 * book itself. Homepage visitors read four to eight lines before deciding, so
 * this is deliberately short: the emotional core lands early and the longer
 * commentary stays with the full text.
 */
export default function BookExcerpt({ slug, teaser }: BookExcerptProps) {
  if (teaser.length === 0) return null

  return (
    <section className="section-padding book-excerpt" aria-labelledby="book-excerpt-title">
      <div className="container">
        <ScrollReveal>
          <div className="book-excerpt__inner">
            <p className="book-excerpt__eyebrow">উপন্যাস থেকে এক ঝলক</p>
            <h2 id="book-excerpt-title" className="book-excerpt__heading">
              একটি সামাজিক উপন্যাস — বাস্তব ও কাল্পনিক কাহিনীর মিশেলে রচিত
            </h2>

            <blockquote className="book-excerpt__quote">
              {teaser.map((paragraph, i) => (
                <p key={i} className="book-excerpt__para">
                  {paragraph}
                </p>
              ))}
            </blockquote>

            <Link href={`/book/${slug}`} className="btn btn-secondary book-excerpt__cta">
              নমুনা পড়ুন
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
