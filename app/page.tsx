import Link from "next/link"
import { getFeatured, getNewReleases, getTrending } from "@/lib/api"
import { CATEGORIES } from "@/lib/data"
import Hero from "@/components/Hero"
import BookGrid from "@/components/BookGrid"
import ScrollReveal from "@/components/ScrollReveal"

export default async function HomePage() {
  const [featured, newReleases, trending] = await Promise.all([
    getFeatured(),
    getNewReleases(),
    getTrending(),
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "প্রদীপ কুমার আচার্য্য",
            description: "বাংলা সাহিত্যের একটি উল্লেখযোগ্য উপন্যাস।",
            url: "/",
          }),
        }}
      />
      <Hero />

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

      {/* Featured Highlight */}
      <section className="section-padding" style={{ background: "var(--bg-alt)" }}>
        <div className="container">
          <ScrollReveal>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-12)", alignItems: "center" }}>
              <div>
                <span className="badge badge-terracotta" style={{ marginBottom: "var(--sp-4)" }}>বিশেষ প্রকাশনা</span>
                <h1 style={{ marginBottom: "var(--sp-4)" }}>ছেঁড়া পুষ্প</h1>
                <p style={{ fontSize: "1.0625rem", marginBottom: "var(--sp-4)" }}>
                  প্রদীপ কুমার আচার্য্যের এই উপন্যাসে স্মৃতি ও বর্তমানের এক অনন্য
                  মিলন ঘটেছে। একটি মানুষের জীবনের ছেঁড়া পুষ্পগুলো কীভাবে নতুন
                  করে ফোটে — তারই গল্প।
                </p>
                <div style={{ display: "flex", gap: "var(--sp-4)" }}>
                  <Link href="/book/chhera-pushpo" className="btn btn-primary">
                    এখনই কিনুন
                  </Link>
                  <Link href="/novels" className="btn btn-secondary">
                    সকল উপন্যাস
                  </Link>
                </div>
              </div>
              <div>
                <img
                  src="https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=900&q=80"
                  alt="ছেঁড়া পুষ্প"
                  style={{ width: "100%", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)" }}
                />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Category Cards */}
      <section className="section-padding">
        <div className="container">
          <ScrollReveal>
            <h2 style={{ textAlign: "center", marginBottom: "var(--sp-8)" }}>বইয়ের ধরন</h2>
          </ScrollReveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "var(--sp-6)" }}>
            {CATEGORIES.map((cat) => (
              <ScrollReveal key={cat.slug}>
                <Link
                  href={`/${cat.slug === "novels" ? "novels" : "books"}`}
                  className="card"
                  style={{ padding: "var(--sp-8)", textAlign: "center" }}
                >
                  <h3 style={{ marginBottom: "var(--sp-2)" }}>{cat.label}</h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--stone)" }}>
                    {cat.category === "novels" ? "উপন্যাস সংকলন" : "সাহিত্য বই সংকলন"}
                  </p>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Books */}
      {featured.length > 0 && (
        <section className="section-padding" style={{ background: "var(--bg-alt)" }}>
          <div className="container">
            <ScrollReveal>
              <h2 style={{ textAlign: "center", marginBottom: "var(--sp-8)" }}>বিশেষ সংকলন</h2>
            </ScrollReveal>
            <BookGrid books={featured} />
          </div>
        </section>
      )}

      {/* New Releases */}
      {newReleases.length > 0 && (
        <section className="section-padding">
          <div className="container">
            <ScrollReveal>
              <h2 style={{ textAlign: "center", marginBottom: "var(--sp-8)" }}>নতুন প্রকাশনা</h2>
            </ScrollReveal>
            <BookGrid books={newReleases} />
          </div>
        </section>
      )}

      {/* Trending */}
      {trending.length > 0 && (
        <section className="section-padding" style={{ background: "var(--bg-alt)" }}>
          <div className="container">
            <ScrollReveal>
              <h2 style={{ textAlign: "center", marginBottom: "var(--sp-8)" }}>জনপ্রিয়</h2>
            </ScrollReveal>
            <BookGrid books={trending} />
          </div>
        </section>
      )}

      {/* Promo Strip */}
      <section className="section-padding">
        <div className="container" style={{ textAlign: "center" }}>
          <ScrollReveal>
            <h2 style={{ marginBottom: "var(--sp-4)" }}>বিশেষ অফার</h2>
            <p style={{ fontSize: "1.0625rem", marginBottom: "var(--sp-6)", maxWidth: 500, marginInline: "auto" }}>
              ৭৫০ টাকার বেশি অর্ডারে বিনামূল্যে ডেলিভারি। এখনই অর্ডার করুন।
            </p>
            <Link href="/books" className="btn btn-primary">সকল বই দেখুন</Link>
          </ScrollReveal>
        </div>
      </section>

      {/* Newsletter */}
      <section className="section-padding" style={{ background: "var(--ink)", color: "var(--white)" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <ScrollReveal>
            <h2 style={{ color: "var(--white)", marginBottom: "var(--sp-4)" }}>নতুন প্রকাশনা সম্পর্কে জানুন</h2>
            <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: "var(--sp-6)", maxWidth: 500, marginInline: "auto" }}>
              আমাদের নতুন বই ও অফার সম্পর্কে সরাসরি জানুন।
            </p>
            <div style={{ display: "flex", gap: "var(--sp-3)", justifyContent: "center", maxWidth: 400, marginInline: "auto" }}>
              <input
                type="email"
                placeholder="আপনার ইমেইল"
                aria-label="ইমেইল ঠিকানা"
                style={{
                  flex: 1,
                  padding: "var(--sp-3) var(--sp-4)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(255,255,255,0.1)",
                  color: "var(--white)",
                  fontFamily: "var(--font-body)",
                }}
              />
              <button className="btn btn-primary">সাবস্ক্রাইব</button>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  )
}
