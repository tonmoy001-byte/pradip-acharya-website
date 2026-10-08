import Link from "next/link"
import { getCachedFeatured, getCachedNewReleases, getCachedTrending, getCachedSiteSettings } from "@/lib/public-cache"
import Hero, { HeroBook } from "@/components/Hero"
import BookGrid from "@/components/BookGrid"
import BookExcerpt from "@/components/BookExcerpt"
import ScrollReveal from "@/components/ScrollReveal"
import type { Book } from "@/lib/data"
import { AUTHOR_OG_IMAGE, pageMetadata } from "@/lib/seo"
import { websiteGraph } from "@/lib/structured-data"
import JsonLd from "@/components/JsonLd"

// The root "/" page would otherwise inherit only the title template, leaving it
// with no canonical of its own. pageMetadata supplies the self-referencing
// canonical, og:url and og:image that the homepage needs to be linkable.
export const metadata = pageMetadata({
  title: "ছেঁড়া পুষ্প — প্রদীপ কুমার আচার্য্যের বাংলা সামাজিক উপন্যাস",
  description:
    "প্রদীপ কুমার আচার্য্যের বাংলা সামাজিক উপন্যাস “ছেঁড়া পুষ্প” ডিজিটাল ইবুক (PDF) আকারে পড়ুন। bKash, Nagad, Rocket ও কার্ডে পেমেন্ট করে সঙ্গে সঙ্গে ডাউনলোড করুন।",
  path: "/",
  image: AUTHOR_OG_IMAGE,
})

/** Featured + new + trending, de-duplicated, catalog order preserved. */
function mergeFeaturedBooks(...groups: Book[][]): Book[] {
  const seen = new Set<string>()
  const merged: Book[] = []
  for (const group of groups) {
    for (const book of group) {
      if (seen.has(book.id)) continue
      seen.add(book.id)
      merged.push(book)
    }
  }
  return merged
}

export default async function HomePage() {
  const [featured, newReleases, trending, settings] = await Promise.all([
    getCachedFeatured(),
    getCachedNewReleases(),
    getCachedTrending(),
    getCachedSiteSettings(),
  ])

  const heroBook = featured[0]
  const spotlightBooks = mergeFeaturedBooks(featured, newReleases, trending)

  return (
    <>
      <JsonLd data={websiteGraph({
        siteName: settings.site_name || "প্রদীপ কুমার আচার্য্য",
        tagline:
          settings.site_tagline ||
          "লেখক প্রদীপ কুমার আচার্য্যের বাংলা সামাজিক উপন্যাস “ছেঁড়া পুষ্প” — ডিজিটাল ইবুক।",
      })} />
      <Hero
        title={heroBook?.title}
        author={heroBook?.author}
        subtitle={
          settings.hero_subtitle ||
          "বাংলা সাহিত্যের একটি উল্লেখযোগ্য উপন্যাস। স্মৃতি ও বর্তমানের এক অনন্য মিলন।"
        }
      />

      {/* The book itself, directly below the video */}
      <HeroBook
        title={heroBook?.title}
        author={heroBook?.author}
        subtitle={
          settings.hero_subtitle ||
          "বাংলা সাহিত্যের একটি উল্লেখযোগ্য উপন্যাস। স্মৃতি ও বর্তমানের এক অনন্য মিলন।"
        }
        price={heroBook?.ebook.price}
        cover={heroBook?.images.primary}
        slug={heroBook?.id}
        available={heroBook?.ebook.available}
      />

      {/* A few lines from the book, directly beneath the book itself */}
      <BookExcerpt
        slug={heroBook?.id ?? "chhera-pushpo"}
        teaser={[
          "মানুষ সামাজিক জীব। প্রতিটি সমাজে, পরিবারে বিভিন্ন রীতিনীতি প্রচলিত। শিক্ষার প্রসারে মানুষের ন্যায়-অন্যায় বোঝার ক্ষমতা বাড়লেও খুন, ধর্ষণ, সন্ত্রাস, ধর্মান্ধতা আর ঘুষ-কেলেঙ্কারী থেকে আমরা এখনো মুক্ত নই।",
          "এত কিছুর মাঝেও মানুষের আশার আলো নিভে যায় না। বাবা-মায়েরা তাদের সন্তানকে প্রতিষ্ঠিত করতে সাধ্যমতো চেষ্টা করেন। কিন্তু সন্তান যখন মাঝপথে নষ্ট হয়ে যায়, তখন দুঃখের সীমা থাকে না।",
          "“ছেঁড়া পুষ্প” একটি সামাজিক উপন্যাস — বাস্তব ও কাল্পনিক কাহিনীর সমন্বয়ে রচিত। প্রধান নায়ক তুহিন মেধাবী ছাত্র। শিক্ষাজীবন শেষ হওয়ার আগেই তার জীবনে ভাঙন নেমে আসে...",
        ]}
      />

      {/* Author Intro */}
      <section className="section-padding">
        <div className="container">
          <ScrollReveal>
            <div style={{ textAlign: "center", maxWidth: 700, margin: "0 auto" }}>
              <h2 style={{ marginBottom: "var(--sp-4)" }}>লেখক পরিচিতি</h2>
              <p style={{ fontSize: "1.0625rem", lineHeight: 1.8 }}>
                প্রদীপ কুমার আচার্য্য — বাংলা সাহিত্যের এক অনন্য কণ্ঠ। তাঁর লেখায়
                জীবনের গভীরতা, মানবিক অনুভূতি এবং সমসাময়িক বাস্তবতার ছাপ ফুটে ওঠে।
                &ldquo;ছেঁড়া পুষ্প&rdquo; তাঁর উল্লেখযোগ্য সৃষ্টির একটি।
              </p>
              <Link href="/about" className="btn btn-secondary" style={{ marginTop: "var(--sp-6)" }}>
                আরও জানুন
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* বিশেষ ফিচার্ড বই — featured + new releases + trending, merged */}
      {spotlightBooks.length > 0 && (
        <section className="section-padding" style={{ background: "var(--bg-alt)" }}>
          <div className="container">
            <ScrollReveal>
              <h2 style={{ textAlign: "center", marginBottom: "var(--sp-8)" }}>বিশেষ ফিচার্ড বই</h2>
            </ScrollReveal>
            <BookGrid books={spotlightBooks} />
          </div>
        </section>
      )}

      {/* Promo strip and newsletter removed: promo_banner_text is free-form text
          with no discount logic behind it, and the newsletter form was never
          wired to a backend. Re-add only with a real offer / working handler. */}
    </>
  )
}
