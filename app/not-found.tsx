import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "পাওয়া যায়নি",
  description: "আপনি যে পৃষ্ঠাটি খুঁজছেন তা বিদ্যমান নেই বা সরিয়ে ফেলা হয়েছে।",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  // Omit social preview tags: a missing URL should not advertise the homepage
  // or any book as its preview.
  openGraph: null,
  twitter: null,
}

export default function NotFound() {
  return (
    <div className="not-found-page">
      <p className="code">৪০৪</p>
      <h1>পাওয়া যায়নি</h1>
      <p style={{ marginBottom: "var(--sp-6)", maxWidth: 400 }}>
        আপনি যে পৃষ্ঠাটি খুঁজছেন তা বিদ্যমান নেই বা সরিয়ে ফেলা হয়েছে।
      </p>
      <Link href="/" className="btn btn-primary">হোমে ফিরে যান</Link>
    </div>
  )
}
