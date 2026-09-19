// app/payment/success/page.tsx
// Payment success redirect page. Verifies payment and shows confirmation.
// Clears cart after successful payment (moved from checkout to prevent data loss on payment failure).

"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { money } from "@/lib/format"
import { useCart } from "@/lib/store"

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const transactionId = searchParams.get("transaction_id")
  const orderId = searchParams.get("order_id")
  const { clearCart } = useCart()

  const [status, setStatus] = useState<"loading" | "paid" | "failed">("loading")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!transactionId) {
      setStatus("failed")
      setError("Transaction ID not found")
      return
    }

    fetch(`/api/payment/verify?transaction_id=${encodeURIComponent(transactionId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "paid") {
          setStatus("paid")
          clearCart()
        } else {
          setStatus("failed")
          setError("পেমেন্ট যাচাইকরণ ব্যর্থ হয়েছে")
        }
      })
      .catch(() => {
        setStatus("failed")
        setError("পেমেন্ট যাচাইকরণে ত্রুটি")
      })
  }, [transactionId, clearCart])

  if (status === "loading") {
    return (
      <div className="container section-padding">
        <div className="order-confirm">
          <h1>পেমেন্ট যাচাই হচ্ছে...</h1>
          <p>অনুগ্রহ করে অপেক্ষা করুন।</p>
        </div>
      </div>
    )
  }

  if (status === "failed") {
    return (
      <div className="container section-padding">
        <div className="order-confirm">
          <h1>পেমেন্ট ব্যর্থ</h1>
          <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
            {error || "পেমেন্ট প্রক্রিয়াকরণে সমস্যা হয়েছে।"}
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

  return (
    <div className="container section-padding">
      <div className="order-confirm">
        <h1>পেমেন্ট সম্পন্ন!</h1>
        <p>আপনার পেমেন্ট সফলভাবে সম্পন্ন হয়েছে।</p>
        <p style={{ color: "var(--stone)", marginBottom: "var(--sp-2)" }}>
          ট্রানজেকশন আইডি: {transactionId}
        </p>
        <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
          অর্ডার আইডি: {orderId}
        </p>
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", marginTop: "var(--sp-4)" }}>
          <Link href="/account/orders" className="btn btn-primary">আমার অর্ডার</Link>
          <Link href="/books" className="btn btn-secondary">আরও বই দেখুন</Link>
        </div>
      </div>
    </div>
  )
}
