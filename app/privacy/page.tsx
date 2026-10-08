import type { Metadata } from "next"
import { pageMetadata } from "@/lib/seo"
import { breadcrumbList } from "@/lib/structured-data"
import JsonLd from "@/components/JsonLd"

export const metadata: Metadata = pageMetadata({
  title: "গোপনীয়তা নীতি",
  description:
    "প্রদীপ কুমার আচার্য্যের ওয়েবসাইটে অর্ডার ও অ্যাকাউন্টের সময় কোন তথ্য সংগ্রহ ও সংরক্ষণ করা হয়, এবং তা কীভাবে ব্যবহার করা হয়, তা বিস্তারিত জানুন।",
  path: "/privacy",
  keywords: ["গোপনীয়তা নীতি", "প্রাইভেসি পলিসি", "ব্যক্তিগত তথ্য"],
})

export default function PrivacyPage() {
  return (
    <div className="container section-padding" style={{ maxWidth: 700, marginInline: "auto" }}>
      <JsonLd
        data={breadcrumbList([
          { name: "হোম", path: "/" },
          { name: "গোপনীয়তা নীতি", path: "/privacy" },
        ])}
      />
      <div className="page-header">
        <h1>গোপনীয়তা নীতি</h1>
      </div>

      <div style={{ lineHeight: 1.8, color: "var(--ink-muted)" }}>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          আমরা আপনার গোপনীয়তাকে সম্মান করি। এই নীতিতে বর্ণনা করা হয়েছে আমরা
          কীভাবে আপনার তথ্য সংগ্রহ ও ব্যবহার করি।
        </p>

        <h3 style={{ marginBottom: "var(--sp-3)" }}>তথ্য সংগ্রহ</h3>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          আমরা শুধুমাত্র অর্ডার প্রক্রিয়াকরণের জন্য প্রয়োজনীয় তথ্য সংগ্রহ করি।
        </p>

        <h3 style={{ marginBottom: "var(--sp-3)" }}>তথ্য ব্যবহার</h3>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          আপনার তথ্য শুধুমাত্র অর্ডার প্রক্রিয়াকরণে ব্যবহৃত হয়।
        </p>

        <p style={{ fontSize: "0.875rem", color: "var(--stone)" }}>
          [সম্পূর্ণ গোপনীয়তা নীতি এখানে যোগ করুন]
        </p>
      </div>
    </div>
  )
}
