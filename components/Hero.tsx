"use client"

import Link from "next/link"

interface HeroProps {
  title?: string
  subtitle?: string
}

export default function Hero({ title, subtitle }: HeroProps) {
  return (
    <section className="hero" aria-label="হিরো ব্যানার">
      <div className="hero-slide active">
        <video
          className="hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/images/books/chhera-pushpo-1.png"
        >
          <source src="/videos/hero-video.mp4" type="video/mp4" />
        </video>
        <div className="hero-overlay" />
      </div>
      <div className="hero-content">
        <p className="hero-subtitle">{subtitle || "প্রদীপ কুমার আচার্য্যের"}</p>
        <h1 className="hero-title">{title || "ছেঁড়া পুষ্প"}</h1>
        <p className="hero-desc">
          বাংলা সাহিত্যের একটি উল্লেখযোগ্য উপন্যাস। স্মৃতি ও বর্তমানের এক অনন্য মিলন।
        </p>
        <div className="hero-actions">
          <Link href="/book/chhera-pushpo" className="btn btn-primary">
            এখনই কিনুন
          </Link>
          <Link
            href="/books"
            className="btn btn-secondary"
            style={{ background: "rgba(255,255,255,0.9)", color: "var(--ink)" }}
          >
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
