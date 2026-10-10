// app/payment/success/page.tsx
// Payment success redirect page. Verifies payment and shows confirmation.

"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { money } from "@/lib/format"
import SeoNoindex from "@/components/SeoNoindex"

type PaymentStatus = "loading" | "paid" | "pending" | "error" | "failed"

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  // NagorikPay redirects with `transactionId`; keep snake_case for older links.
  const transactionId = searchParams.get("transactionId") || searchParams.get("transaction_id")
  const [orderId, setOrderId] = useState(() => searchParams.get("order_id"))

  const [status, setStatus] = useState<PaymentStatus>("loading")
  const [error, setError] = useState("")
  const [downloadReady, setDownloadReady] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!transactionId) {
      setStatus("failed")
      setError("Transaction ID not found")
      return
    }

    abortRef.current = new AbortController()
    const signal = abortRef.current.signal

    let pollCount = 0
    const maxPolls = 24 // 24 * 5s = 2 minutes

    async function verify() {
      try {
        if (!transactionId) return
        const res = await fetch(`/api/payment/verify?transactionId=${encodeURIComponent(transactionId)}`, { signal })
        const data = await res.json()

        if (data.status === "paid") {
          setStatus("paid")
          setDownloadReady(data.download_ready === true)
          if (data.order_id) setOrderId((prev) => prev || data.order_id)
          return
        }

        if (data.status === "pending") {
          setStatus("pending")
          if (data.order_id) setOrderId((prev) => prev || data.order_id)
          // Poll every 5s for up to 2 minutes
          if (pollCount < maxPolls) {
            pollCount++
            setTimeout(verify, 5000)
          } else {
            setStatus("pending") // keep showing pending after timeout
          }
          return
        }

        if (data.status === "error" || data.status === "verification_unavailable") {
          setStatus("error")
          setError(data.error || "Verification unavailable")
          return
        }

        // failed
        setStatus("failed")
        setError("পেমেন্ট যাচাইকরণ ব্যর্থ হয়েছে")
      } catch {
        if (!signal.aborted) {
          setStatus("error")
          setError("পেমেন্ট যাচাইকরণে ত্রুটি")
        }
      }
    }

    verify()

    return () => {
      abortRef.current?.abort()
    }
  }, [transactionId])

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

  if (status === "pending") {
    return (
      <div className="container section-padding">
        <SeoNoindex />
        <div className="order-confirm">
          <h1>পেমেন্ট যাচাই চলছে</h1>
          <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
            ব্যাংক/QR পেমেন্ট নিশ্চিত হতে কিছু সময় লাগতে পারে। নিশ্চিত হলেই আপনার ডাউনলোড চালু হবে।
          </p>
          <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", marginTop: "var(--sp-4)" }}>
            <Link href="/account/orders" className="btn btn-primary">আমার অর্ডার</Link>
            <Link href="/my-downloads" className="btn btn-secondary">আমার ডাউনলোড</Link>
          </div>
        </div>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="container section-padding">
        <SeoNoindex />
        <div className="order-confirm">
          <h1>যাচাইকরণে সমস্যা</h1>
          <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
            {error || "এখন যাচাই করা যাচ্ছে না। টাকা কেটে থাকলে চিন্তা করবেন না, কিছুক্ষণ পরে আমার অর্ডার দেখুন।"}
          </p>
          <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
              style={{ marginRight: "var(--sp-3)" }}
            >
              আবার চেষ্টা করুন
            </button>
            <Link href="/account/orders" className="btn btn-secondary">আমার অর্ডার</Link>
            <Link href="/contact" className="btn btn-secondary">সহায়তা</Link>
          </div>
        </div>
      </div>
    )
  }

  if (status === "failed") {
    return (
      <div className="container section-padding">
        <SeoNoindex />
        <div className="order-confirm">
          <h1>পেমেন্ট সম্পন্ন হয়নি</h1>
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
      <SeoNoindex />
      <div className="order-confirm">
        <h1>পেমেন্ট সম্পন্ন!</h1>
        <p>আপনার পেমেন্ট সফলভাবে সম্পন্ন হয়েছে।</p>
        <p style={{ color: "var(--stone)", marginBottom: "var(--sp-2)" }}>
          ট্রানজেকশন আইডি: {transactionId}
        </p>
        <p style={{ color: "var(--stone)", marginBottom: "var(--sp-2)" }}>
          অর্ডার আইডি: {orderId}
        </p>
        {!downloadReady ? (
          <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
            ডাউনলোড প্রস্তুত হচ্ছে, কিছুক্ষণ পরে আমার ডাউনলোড দেখুন।
          </p>
        ) : (
          <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
            আপনার ইবুকটি প্রস্তুত — নিচের &ldquo;আমার ডাউনলোড&rdquo; থেকে এখনই PDF নামিয়ে নিতে পারবেন।
          </p>
        )}
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", marginTop: "var(--sp-4)" }}>
          <Link href="/account/orders" className="btn btn-primary">আমার অর্ডার</Link>
          <Link href="/my-downloads" className="btn btn-secondary">আমার ডাউনলোড</Link>
          <Link href="/books" className="btn btn-secondary">আরও বই দেখুন</Link>
        </div>
      </div>
    </div>
  )
}