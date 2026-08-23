"use client"

import { useState } from "react"
import Link from "next/link"
import { useCart } from "@/lib/store"
import { money, deliveryCharge } from "@/lib/format"
import { createDemoOrder, type OrderConfirmation } from "@/lib/orders"

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart()
  const delivery = deliveryCharge(subtotal)
  const total = subtotal + delivery

  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    address: "", city: "", zip: "", country: "Bangladesh",
    cardNumber: "", expiry: "", cvc: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [order, setOrder] = useState<OrderConfirmation | null>(null)
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
    if (!form.address.trim()) e.address = "ঠিকানা আবশ্যক"
    if (!form.city.trim()) e.city = "শহর আবশ্যক"
    if (!form.zip.trim()) e.zip = "পোস্ট কোড আবশ্যক"
    if (!form.cardNumber.trim()) e.cardNumber = "কার্ড নম্বর আবশ্যক"
    if (!form.expiry.trim()) e.expiry = "মেয়াদ আবশ্যক"
    if (!form.cvc.trim()) e.cvc = "CVC আবশ্যক"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || items.length === 0) return

    setSubmitting(true)
    try {
      const confirmation = await createDemoOrder({
        contact: { name: form.name, email: form.email, phone: form.phone },
        shipping: { address: form.address, city: form.city, zip: form.zip, country: form.country },
        items,
        total,
      })
      setOrder(confirmation)
      clearCart()
    } finally {
      setSubmitting(false)
    }
  }

  if (order) {
    return (
      <div className="container section-padding">
        <div className="order-confirm">
          <h1>অর্ডার সম্পন্ন!</h1>
          <p>আপনার অর্ডার সফলভাবে গৃহীত হয়েছে।</p>
          <p className="order-id">অর্ডার নম্বর: {order.orderId}</p>
          <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
            এটি একটি ডেমো অর্ডার। প্রকৃত অর্ডার প্রক্রিয়াকরণ এখনো সক্রিয় হয়নি।
          </p>
          <Link href="/books" className="btn btn-primary">আরও বই দেখুন</Link>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container section-padding">
        <div className="cart-empty">
          <h1>চেকআউট</h1>
          <p style={{ marginBottom: "var(--sp-6)" }}>কার্টে কোনো আইটেম নেই।</p>
          <Link href="/books" className="btn btn-primary">সকল বই দেখুন</Link>
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

      <form onSubmit={handleSubmit}>
        <div className="checkout-page">
          <div>
            {/* Contact */}
            <div className="checkout-section">
              <h2>যোগাযোগের তথ্য</h2>
              <div className="checkout-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="name">নাম *</label>
                  <input id="name" className="form-input" style={inputStyle} value={form.name} onChange={(e) => update("name", e.target.value)} />
                  {errors.name && <span className="form-error">{errors.name}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">ইমেইল *</label>
                  <input id="email" type="email" className="form-input" style={inputStyle} value={form.email} onChange={(e) => update("email", e.target.value)} />
                  {errors.email && <span className="form-error">{errors.email}</span>}
                </div>
              </div>
              <div className="form-group" style={{ marginTop: "var(--sp-4)" }}>
                <label className="form-label" htmlFor="phone">ফোন *</label>
                <input id="phone" className="form-input" style={inputStyle} value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                {errors.phone && <span className="form-error">{errors.phone}</span>}
              </div>
            </div>

            {/* Shipping */}
            <div className="checkout-section">
              <h2>ডেলিভারি ঠিকানা</h2>
              <div className="form-group">
                <label className="form-label" htmlFor="address">ঠিকানা *</label>
                <input id="address" className="form-input" style={inputStyle} value={form.address} onChange={(e) => update("address", e.target.value)} />
                {errors.address && <span className="form-error">{errors.address}</span>}
              </div>
              <div className="checkout-row" style={{ marginTop: "var(--sp-4)" }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="city">শহর *</label>
                  <input id="city" className="form-input" style={inputStyle} value={form.city} onChange={(e) => update("city", e.target.value)} />
                  {errors.city && <span className="form-error">{errors.city}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="zip">পোস্ট কোড *</label>
                  <input id="zip" className="form-input" style={inputStyle} value={form.zip} onChange={(e) => update("zip", e.target.value)} />
                  {errors.zip && <span className="form-error">{errors.zip}</span>}
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="checkout-section">
              <h2>পেমেন্ট</h2>
              <p className="checkout-note">এটি একটি ডেমো — কোনো প্রকৃত পেমেন্ট গ্রহণ করা হবে না।</p>
              <div className="form-group">
                <label className="form-label" htmlFor="cardNumber">কার্ড নম্বর *</label>
                <input id="cardNumber" className="form-input" style={inputStyle} placeholder="0000 0000 0000 0000" value={form.cardNumber} onChange={(e) => update("cardNumber", e.target.value)} />
                {errors.cardNumber && <span className="form-error">{errors.cardNumber}</span>}
              </div>
              <div className="checkout-row" style={{ marginTop: "var(--sp-4)" }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="expiry">মেয়াদ *</label>
                  <input id="expiry" className="form-input" style={inputStyle} placeholder="MM/YY" value={form.expiry} onChange={(e) => update("expiry", e.target.value)} />
                  {errors.expiry && <span className="form-error">{errors.expiry}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="cvc">CVC *</label>
                  <input id="cvc" className="form-input" style={inputStyle} placeholder="123" value={form.cvc} onChange={(e) => update("cvc", e.target.value)} />
                  {errors.cvc && <span className="form-error">{errors.cvc}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="cart-summary">
              <h2>অর্ডার সারসংক্ষেপ</h2>
              {items.map((item) => (
                <div key={`${item.bookId}-${item.format}`} className="cart-summary-row">
                  <span>{item.title} ({item.format}) × {item.quantity}</span>
                  <span>{money(item.price * item.quantity)}</span>
                </div>
              ))}
              <div className="cart-summary-row">
                <span>ডেলিভারি</span>
                <span>{delivery === 0 ? "বিনামূল্যে" : money(delivery)}</span>
              </div>
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
                {submitting ? "অর্ডার প্রক্রিয়াকরণ..." : "অর্ডার করুন"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
