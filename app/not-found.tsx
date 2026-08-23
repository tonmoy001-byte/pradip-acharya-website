import Link from "next/link"

export default function NotFound() {
  return (
    <div className="not-found-page">
      <p className="code">৪০৪</p>
      <h1>পাওয়া যায়নি</h1>
      <p style={{ marginBottom: "var(--sp-6)", maxWidth: 400 }}>
        আপনি যে পৃষ্ঠাটি খুঁজছেন তা বিদ্যমান নেই বা সরিয়ে ফেলা হয়েছে।
      </p>
      <Link href="/" className="btn btn-primary">হোমে ফিরুন</Link>
    </div>
  )
}
