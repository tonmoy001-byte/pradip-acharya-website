"use client"

import { useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth"
import { money } from "@/lib/format"

export interface DirectItem {
  bookId: string
  title: string
  price: number
  image: string
  quantity: number
}

interface CheckoutClientProps {
  /** Book bought via a buy-now link. Resolved on the server. */
  directItem: DirectItem | null
}

export default function CheckoutClient({ directItem }: CheckoutClientProps) {
  const { user } = useAuth()

  // There is no cart: the order is built from the book resolved on the server.
  const orderItems: DirectItem[] = directItem ? [directItem] : []
  const total = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0)

  const [form, setForm] = useState({ name: "", email: "", phone: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = "নাম আবশ্যক"
    if (!form.email.trim()) e.email = "ইমেইল আবশ্যক"
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "সঠিক ইমেইল দিন"
    if (!form.phone.trim()) e.phone = "ফোন নম্বর আবশ্যক"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || orderItems.length === 0) return

    setSubmitting(true)
    setServerError("")

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          // Ebook-only store: the server resolves the digital format itself.
          cartItems: orderItems.map((i) => ({
            book_id: i.bookId,
            quantity: i.quantity,
          })),
          contact: { name: form.name, email: form.email, phone: form.phone },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "অর্ডার তৈরি ব্যর্থ হয়েছে")

      const orderId = data.data.order_id || data.data.id

      const payRes = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ order_id: orderId }),
      })
      const payData = await payRes.json()
      if (!payRes.ok) throw new Error(payData.error || "পেমেন্ট তৈরি ব্যর্থ")

      // Validate payment URL to prevent open redirect
      const paymentUrl = payData.payment_url as string
      const allowedHosts = ["secure-pay.nagorikpay.com", "sandbox-api.nagorikpay.com"]
      try {
        const parsedUrl = new URL(paymentUrl)
        if (!allowedHosts.includes(parsedUrl.hostname)) {
          throw new Error("অনুমোদিত পেমেন্ট গেটওয়ে নয়")
        }
      } catch {
        throw new Error("অবৈধ পেমেন্ট URL")
      }

      window.location.href = paymentUrl    } catch (err: any) {
      setServerError(err.message || "একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।")
      setSubmitting(false)
    }
  }

  if (orderItems.length === 0) {
    return (
      <div className="container section-padding">
        <div className="cart-empty">
          <h1>চেকআউট</h1>
          <p style={{ marginBottom: "var(--sp-6)" }}>কোনো বই নির্বাচিত নেই।</p>
          <Link href="/books" className="btn btn-primary">সব বই দেখুন</Link>
        </div>
      </div>
    )
  }

  const inputStyle = { width: "100%" }

  return (
    <div className="container section-padding">
      <div className="page-header">
        <h1>চেকআউট</h1>
      </div>

      {!user && (
        <div style={{ padding: "var(--sp-3) var(--sp-4)", marginBottom: "var(--sp-6)", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius)", fontSize: "0.875rem" }}>
          <Link href="/login" style={{ fontWeight: 600 }}>লগ ইন করুন</Link> অর্ডার ট্র্যাক করতে এবং ডাউনলোড অ্যাক্সেস পেতে।
        </div>
      )}

      {serverError && (
        <div role="alert" style={{ padding: "var(--sp-3) var(--sp-4)", marginBottom: "var(--sp-4)", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius)", color: "#991b1b", fontSize: "0.875rem" }}>
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="checkout-page">
          <div>
            {/* Contact */}
            <div className="checkout-section">
              <h2>যোগাযোগের তথ্য</h2>
              <div className="checkout-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="name">নাম *</label>
                  <input id="name" name="name" required autoComplete="name" className="form-input" style={inputStyle} value={form.name} onChange={(e) => update("name", e.target.value)} />
                  {errors.name && <span className="form-error">{errors.name}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">ইমেইল *</label>
                  <input id="email" name="email" type="email" required autoComplete="email" className="form-input" style={inputStyle} value={form.email} onChange={(e) => update("email", e.target.value)} />
                  {errors.email && <span className="form-error">{errors.email}</span>}
                </div>
              </div>
              <div className="form-group" style={{ marginTop: "var(--sp-4)" }}>
                <label className="form-label" htmlFor="phone">ফোন *</label>
                <input id="phone" name="phone" type="tel" required autoComplete="tel" className="form-input" style={inputStyle} value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                {errors.phone && <span className="form-error">{errors.phone}</span>}
              </div>
            </div>

            {/* Payment */}
            <div className="checkout-section">
              <h2>পেমেন্ট পদ্ধতি</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
                <label style={{
                  display: "flex", alignItems: "flex-start", gap: "var(--sp-3)",
                  padding: "var(--sp-3) var(--sp-4)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)", cursor: "pointer",
                  background: "#fff7ed", borderColor: "var(--terracotta)",
                }}>
                  <input type="radio" name="payment-method" value="nagorikpay" checked readOnly style={{ marginTop: "2px" }} />
                  <div>
                    <span style={{ fontWeight: 600 }}>অনলাইন পেমেন্ট</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--stone)", marginLeft: "var(--sp-2)" }}>
                      bKash, Nagad, Rocket, কার্ড
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="cart-summary">
              <h2>অর্ডার সারসংক্ষেপ</h2>
              {orderItems.map((item) => (
                <div key={item.bookId} className="cart-summary-row">
                  <span>{item.title} (ইবুক)</span>
                  <span>{money(item.price * item.quantity)}</span>
                </div>
              ))}
              <div className="cart-summary-total">
                <span>মোট</span>
                <span>{money(total)}</span>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ width: "100%", marginTop: "var(--sp-4)" }}
              >
                {submitting ? "অর্ডার প্রক্রিয়াকরণ..." : "পেমেন্টে যান"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
