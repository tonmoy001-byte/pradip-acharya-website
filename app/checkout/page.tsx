"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCart } from "@/lib/store"
import { useAuth } from "@/lib/auth"
import { money, deliveryCharge } from "@/lib/format"

interface SavedAddress {
  id: string
  label: string
  recipient_name: string
  phone: string
  address_line: string
  district: string
  upazila: string
  postal_code: string
  is_default: boolean
}

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart()
  const { user } = useAuth()
  const router = useRouter()
  const delivery = deliveryCharge(subtotal)
  const total = subtotal + delivery

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>("new")
  const [loadingAddresses, setLoadingAddresses] = useState(false)

  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    address: "", city: "", zip: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState("")
  const [orderResult, setOrderResult] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)

  // Fetch saved addresses when logged in
  useEffect(() => {
    if (!user) return
    setLoadingAddresses(true)
    fetch("/api/addresses", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.data) {
          setSavedAddresses(data.data)
          const defaultAddr = data.data.find((a: SavedAddress) => a.is_default)
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr.id)
            setForm((prev) => ({
              ...prev,
              name: defaultAddr.recipient_name,
              phone: defaultAddr.phone,
              address: defaultAddr.address_line,
              city: defaultAddr.district,
              zip: defaultAddr.postal_code,
            }))
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingAddresses(false))
  }, [user])

  function selectAddress(addr: SavedAddress | null) {
    if (!addr) {
      setSelectedAddressId("new")
      setForm((prev) => ({ ...prev, name: "", phone: "", address: "", city: "", zip: "" }))
    } else {
      setSelectedAddressId(addr.id)
      setForm((prev) => ({
        ...prev,
        name: addr.recipient_name,
        phone: addr.phone,
        address: addr.address_line,
        city: addr.district,
        zip: addr.postal_code,
      }))
    }
  }

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

    const hasPhysical = items.some((i) => i.format === "Paperback")
    if (hasPhysical) {
      if (!form.address.trim()) e.address = "ঠিকানা আবশ্যক"
      if (!form.city.trim()) e.city = "শহর আবশ্যক"
      if (!form.zip.trim()) e.zip = "পোস্ট কোড আবশ্যক"
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || items.length === 0) return

    setSubmitting(true)
    setServerError("")

    try {
      const hasPhysical = items.some((i) => i.format === "Paperback")

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cartItems: items.map((i) => ({
            book_id: i.bookId,
            format_name: i.format,
            quantity: i.quantity,
          })),
          contact: { name: form.name, email: form.email, phone: form.phone },
          shippingAddress: hasPhysical ? {
            address: form.address,
            city: form.city,
            postal_code: form.zip,
          } : null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setServerError(data.error || "অর্ডার তৈরি ব্যর্থ হয়েছে")
        return
      }

      setOrderResult(data.data)
      clearCart()
    } catch {
      setServerError("একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।")
    } finally {
      setSubmitting(false)
    }
  }

  if (orderResult) {
    return (
      <div className="container section-padding">
        <div className="order-confirm">
          <h1>অর্ডার সম্পন্ন!</h1>
          <p>আপনার অর্ডার সফলভাবে গৃহীত হয়েছে।</p>
          <p className="order-id">অর্ডার আইডি: {orderResult.order_id}</p>
          <p style={{ color: "var(--stone)", marginBottom: "var(--sp-2)" }}>
            মোট: {money(orderResult.total)}
          </p>
          <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
            পেমেন্ট স্ট্যাটাস: {orderResult.payment_status === "pending_payment" ? "অপেক্ষমান" : orderResult.payment_status}
          </p>
          <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
            <Link href="/account/orders" className="btn btn-primary">আমার অর্ডার</Link>
            <Link href="/books" className="btn btn-secondary">আরও বই দেখুন</Link>
          </div>
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

            {/* Shipping — only show if physical items */}
            {items.some((i) => i.format === "Paperback") && (
              <div className="checkout-section">
                <h2>ডেলিভারি ঠিকানা</h2>

                {/* Saved addresses */}
                {user && loadingAddresses && (
                  <div style={{ marginBottom: "var(--sp-4)" }}>
                    <p style={{ fontSize: "0.875rem", color: "var(--ink-muted)", marginBottom: "var(--sp-3)" }}>ঠিকানা লোড হচ্ছে...</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                      {[...Array(2)].map((_, i) => (
                        <div key={i} className="skeleton" style={{ height: 80, borderRadius: "var(--radius-md)" }} />
                      ))}
                    </div>
                  </div>
                )}
                {user && !loadingAddresses && savedAddresses.length > 0 && (
                  <div style={{ marginBottom: "var(--sp-4)" }}>
                    <p style={{ fontSize: "0.875rem", color: "var(--ink-muted)", marginBottom: "var(--sp-3)" }}>সংরক্ষিত ঠিকানা থেকে নির্বাচন করুন:</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                      {savedAddresses.map((addr) => (
                        <label
                          key={addr.id}
                          style={{
                            display: "flex", alignItems: "flex-start", gap: "var(--sp-3)",
                            padding: "var(--sp-3) var(--sp-4)", border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)", cursor: "pointer",
                            background: selectedAddressId === addr.id ? "#fff7ed" : "var(--white)",
                            borderColor: selectedAddressId === addr.id ? "var(--terracotta)" : "var(--border)",
                          }}
                        >
                          <input
                            type="radio"
                            name="saved-address"
                            checked={selectedAddressId === addr.id}
                            onChange={() => selectAddress(addr)}
                            style={{ marginTop: "2px" }}
                          />
                          <div style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
                            <span style={{ fontWeight: 600 }}>{addr.label}</span>
                            {addr.is_default && <span style={{ marginLeft: "var(--sp-2)", fontSize: "0.75rem", color: "var(--terracotta)" }}>(ডিফল্ট)</span>}
                            <br />
                            {addr.recipient_name} — {addr.phone}
                            <br />
                            <span style={{ color: "var(--ink-muted)" }}>{addr.address_line}, {addr.upazila ? addr.upazila + ", " : ""}{addr.district}{addr.postal_code ? " - " + addr.postal_code : ""}</span>
                          </div>
                        </label>
                      ))}
                      <label
                        style={{
                          display: "flex", alignItems: "flex-start", gap: "var(--sp-3)",
                          padding: "var(--sp-3) var(--sp-4)", border: "1px solid var(--border)",
                          borderRadius: "var(--radius-md)", cursor: "pointer",
                          background: selectedAddressId === "new" ? "#fff7ed" : "var(--white)",
                          borderColor: selectedAddressId === "new" ? "var(--terracotta)" : "var(--border)",
                        }}
                      >
                        <input
                          type="radio"
                          name="saved-address"
                          checked={selectedAddressId === "new"}
                          onChange={() => selectAddress(null)}
                          style={{ marginTop: "2px" }}
                        />
                        <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>নতুন ঠিকানা ব্যবহার করুন</div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Address form */}
                <div className="form-group">
                  <label className="form-label" htmlFor="address">ঠিকানা *</label>
                  <input id="address" className="form-input" style={inputStyle} value={form.address} onChange={(e) => update("address", e.target.value)} />
                  {errors.address && <span className="form-error">{errors.address}</span>}
                </div>
                <div className="checkout-row" style={{ marginTop: "var(--sp-4)" }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="city">শহর / জেলা *</label>
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
            )}

            {/* Payment notice */}
            <div className="checkout-section">
              <h2>পেমেন্ট</h2>
              <p style={{ color: "var(--stone)", fontSize: "0.875rem" }}>
                অর্ডার সম্পন্ন হলে পেমেন্ট বিবরণ প্রদান করা হবে।
              </p>
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
