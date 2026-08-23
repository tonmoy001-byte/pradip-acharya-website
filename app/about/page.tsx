import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "লেখক পরিচিতি | প্রদীপ কুমার আচার্য্য",
  description: "প্রদীপ কুমার আচার্য্যের সম্পর্কে জানুন।",
}

export default function AboutPage() {
  return (
    <div className="container section-padding" style={{ maxWidth: 800, marginInline: "auto" }}>
      <div className="page-header">
        <h1>লেখক পরিচিতি</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "var(--sp-8)", alignItems: "start" }}>
        <div>
          <div style={{
            width: "100%",
            aspectRatio: "3/4",
            background: "var(--bg-alt)",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--stone)",
            fontSize: "0.875rem",
            border: "1px dashed var(--border-strong)",
          }}>
            [লেখকের ছবি]
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--stone)", textAlign: "center", marginTop: "var(--sp-2)" }}>
            প্রতিনিধি ছবি — আসল ছবি এখনো যোগ করা হয়নি
          </p>
        </div>

        <div>
          <h2 style={{ marginBottom: "var(--sp-4)" }}>প্রদীপ কুমার আচার্য্য</h2>
          <p style={{ marginBottom: "var(--sp-4)", lineHeight: 1.8 }}>
            প্রদীপ কুমার আচার্য্য বাংলা সাহিত্যের একজন উল্লেখযোগ্য লেখক। তাঁর
            লেখায় জীবনের গভীরতা, মানবিক অনুভূতি এবং সমসাময়িক বাস্তবতার ছাপ
            ফুটে ওঠে।
          </p>
          <p style={{ marginBottom: "var(--sp-4)", lineHeight: 1.8 }}>
            তাঁর উল্লেখযোগ্য সৃষ্টির মধ্যে &ldquo;ছেঁড়া পুষ্প&rdquo; একটি। এই
            উপন্যাসে স্মৃতি ও বর্তমানের এক অনন্য মিলন ঘটেছে।
          </p>
          <p style={{ lineHeight: 1.8, color: "var(--stone)" }}>
            [জীবনী যোগ করুন — লেখকের সম্পর্কে আরও তথ্য এখানে যোগ করুন]
          </p>
        </div>
      </div>
    </div>
  )
}
