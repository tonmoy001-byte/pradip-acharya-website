import Image from "next/image"
import Link from "next/link"
import BuyNowButton from "@/components/BuyNowButton"
import HeroVideo from "@/components/HeroVideo"
import { possessive } from "@/lib/format"

interface HeroProps {
  /** Book title shown as the headline, e.g. ছেঁড়া পুষ্প */
  title?: string
  /**
   * Author line above the headline, already in the possessive form
   * (e.g. "প্রদীপ কুমার আচার্য্যের"). It is a separate prop because Bengali
   * genitive suffixes cannot be appended safely to a dynamic name.
   */
  eyebrow?: string
  /** Plain author name, used for the book section's author line. */
  author?: string
  /** Supporting line under the headline. */
  subtitle?: string
  /** Ebook price in BDT. Hidden when undefined. */
  price?: number
  /** Cover image URL (InsForge bucket URL or local path). */
  cover?: string
  /** Slug the primary CTA links to. */
  slug?: string
  /** Whether the book can be purchased right now. */
  available?: boolean
}

const FALLBACK_COVER = "/images/books/chhera-pushpo-cover.jpg"

export default function Hero({
  title = "ছেঁড়া পুষ্প",
  eyebrow = "প্রদীপ কুমার আচার্য্যের",
  author = "প্রদীপ কুমার আচার্য্য",
  subtitle,
  price,
  cover,
  slug = "chhera-pushpo",
  available = false,
}: HeroProps) {
  const canBuy = available && typeof price === "number" && Number.isFinite(price)

  return (
    <section className="hero" aria-label="হিরো ব্যানার">
      <div className="hero-slide active">
        <HeroVideo
          className="hero-video"
          src="/videos/hero-video.mp4"
          poster="/images/books/chhera-pushpo-1.png"
        />
        <div className="hero-overlay" />
      </div>

      <div className="hero-content">
        <p className="hero-subtitle">{eyebrow}</p>
        <h1 className="hero-title">
          {title}
          {/* Extends the H1 for crawlers and screen readers with the
              author + genre context, without changing the visual design. */}
          {author ? (
            <span className="sr-only">
              {" "}
              — {possessive(author)} বাংলা সামাজিক উপন্যাস
            </span>
          ) : null}
        </h1>
        <p className="hero-desc">
          {subtitle || "বাংলা সাহিত্যের একটি উল্লেখযোগ্য উপন্যাস। স্মৃতি ও বর্তমানের এক অনন্য মিলন।"}
        </p>
        <div className="hero-actions">
          {canBuy ? (
            <BuyNowButton bookId={slug} title={title} available={available} className="btn btn-primary" />
          ) : (
            <Link href={`/book/${slug}`} className="btn btn-primary">
              বিস্তারিত দেখুন
            </Link>
          )}
          <Link href="/books" className="btn btn-secondary hero-btn-secondary">
            সকল বই দেখুন
          </Link>
        </div>
      </div>

      <div className="hero-scroll" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </section>
  )
}

/**
 * The book itself, in its own section directly below the video hero.
 *
 * Split out of the hero so the video keeps the full viewport for the film
 * while the title, cover, price and buy action stay legible on the page's
 * own background rather than fighting the video's overlay.
 */
export function HeroBook({
  title = "ছেঁড়া পুষ্প",
  author = "প্রদীপ কুমার আচার্য্য",
  subtitle,
  price,
  cover,
  slug = "chhera-pushpo",
  available = false,
}: HeroProps) {
  const canBuy = available && typeof price === "number" && Number.isFinite(price)

  return (
    <section className="hero-book section-padding" aria-label="বইয়ের পরিচিতি">
      <div className="container hero-book-layout">
        <div className="hero-book-media">
          <Image
            src={cover || FALLBACK_COVER}
            alt={`${title} — বইয়ের প্রচ্ছদ`}
            width={900}
            height={1350}
            priority
            sizes="(max-width: 900px) 62vw, 380px"
            className="hero-book-cover"
          />
        </div>

        <div className="hero-book-content">
          <p className="hero-book-eyebrow">{possessive(author)}</p>
          <h2 className="hero-book-title">{title}</h2>
          <p className="hero-book-desc">
            {subtitle || "বাংলা সাহিত্যের একটি উল্লেখযোগ্য উপন্যাস। স্মৃতি ও বর্তমানের এক অনন্য মিলন।"}
          </p>

          <div className="hero-actions">
            {canBuy ? (
              <BuyNowButton
                bookId={slug}
                title={title}
                available={available}
                label="ইবুক কিনুন"
                className="btn btn-primary"
              />
            ) : (
              <span className="btn btn-primary" aria-disabled="true" style={{ cursor: "not-allowed", opacity: 0.6 }}>
                স্টকে নেই
              </span>
            )}
            <Link href={`/book/${slug}`} className="btn btn-secondary">
              বিস্তারিত দেখুন
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
