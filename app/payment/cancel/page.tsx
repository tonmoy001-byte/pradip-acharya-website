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
          পেমেন্ট বাতিল হয়েছে, আপনার টাকা কাটা হয়নি
        </p>
        <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)", fontSize: "0.875rem" }}>
          আপনার অর্ডার সুরক্ষিত আছে। নিচের বাটনে ক্লিক করে আবার পেমেন্ট চেষ্টা করুন।
        </p>
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          <Link href="/checkout" className="btn btn-primary">
            আবার চেষ্টা করুন
          </Link>
          {orderId && (
            <Link href="/account/orders" className="btn btn-secondary">
              আমার অর্ডার
            </Link>
          )}
          <Link href="/books" className="btn btn-secondary">
            আরও বই দেখুন
          </Link>
        </div>
      </div>
    </div>
  )
}
