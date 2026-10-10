// app/payment/cancel/page.tsx
// Payment cancel redirect page. Shows retry option.

"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import SeoNoindex from "@/components/SeoNoindex"

export default function PaymentCancelPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("order_id")

  return (
    <div className="container section-padding">
      <SeoNoindex />
      <div className="order-confirm">
        <h1>পেমেন্ট বাতিল</h1>
        <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
          আপনি পেমেন্ট প্রক্রিয়া বাতিল করেছেন।
        </p>
        <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)", fontSize: "0.875rem" }}>
          চিন্তা করবেন না — আপনার অর্ডার সুরক্ষিত আছে। আপনি <Link href="/account/orders" style={{ fontWeight: 600 }}>আমার অর্ডার থেকে পেমেন্ট করুন</Link>।
        </p>
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          {orderId && (
            <Link href={`/account/orders`} className="btn btn-primary">আমার অর্ডার</Link>
          )}
          <Link href="/books" className="btn btn-secondary">আরও বই দেখুন</Link>
        </div>
      </div>
    </div>
  )
}
