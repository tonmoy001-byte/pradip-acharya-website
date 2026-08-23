"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

const SLIDES = [
  {
    image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=1920&q=80",
    subtitle: "প্রদীপ কুমার আচার্য্যের",
    title: "ছেঁড়া পুষ্প",
    desc: "বাংলা সাহিত্যের একটি উল্লেখযোগ্য উপন্যাস। স্মৃতি ও বর্তমানের এক অনন্য মিলন।",
  },
  {
    image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1920&q=80",
    subtitle: "নতুন প্রকাশনা",
    title: "সাহিত্যের নতুন অধ্যায়",
    desc: "আমাদের সংকলন থেকে আপনার পছন্দের বই খুঁজে নিন।",
  },
  {
    image: "https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&w=1920&q=80",
    subtitle: "বিশেষ অফার",
    title: "৭৫০ টাকার বেশি অর্ডারে ফ্রি ডেলিভারি",
    desc: "এখনই অর্ডার করুন এবং বিশেষ ছাড় উপভোগ করুন।",
  },
]

const INTERVAL = 6000

export default function Hero() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) return

    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % SLIDES.length)
    }, INTERVAL)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="hero" aria-label="হিরো ব্যানার">
      {SLIDES.map((slide, i) => (
        <div key={i} className={`hero-slide ${i === active ? "active" : ""}`}>
          <img src={slide.image} alt="" className="hero-image" />
          <div className="hero-overlay" />
        </div>
      ))}
      <div className="hero-content">
        <p className="hero-subtitle">{SLIDES[active].subtitle}</p>
        <h1 className="hero-title">{SLIDES[active].title}</h1>
        <p className="hero-desc">{SLIDES[active].desc}</p>
        <div className="hero-actions">
          <Link href="/book/chhera-pushpo" className="btn btn-primary">
            এখনই কিনুন
          </Link>
          <Link href="/books" className="btn btn-secondary" style={{ background: "rgba(255,255,255,0.9)", color: "var(--ink)" }}>
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
