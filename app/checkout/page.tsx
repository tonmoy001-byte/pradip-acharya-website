"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCart } from "@/lib/store"
import { useAuth } from "@/lib/auth"
import { money, deliveryCharge } from "@/lib/format"

// bKash SDK global type
declare global {
  interface Window {
    bKash?: {
      config: (options: BkashConfig) => void
      create: () => { onSuccess: (data: any) => void; onError: () => void }
      execute: () => { onSuccess: (data: any) => void; onError: () => void }
    }
  }
}

interface BkashConfig {
  paymentMode: string
  paymentRequest: {
    amount: string
    intent: string
    currency?: string
    merchantInvoiceNumber?: string
  }
  createRequest: (request: any) => void
  executeRequestOnAuthorization: () => void
  onClose: () => void
}

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

type PaymentMethod = "bkash" | "cod"

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

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bkash")
  const [bkashReady, setBkashReady] = useState(false)
  const [bkashProcessing, setBkashProcessing] = useState(false)
  const bkashInitialized = useRef(false)

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

  // Load bKash SDK script and init
  useEffect(() => {
    if (bkashInitialized.current) return

    async function initBkash() {
      try {
        const res = await fetch("/api/bkash/config")
        const config = await res.json()
        if (!config.appKey) return

        // Load the bKash SDK script
        const script = document.createElement("script")
        script.src = config.scriptUrl
        script.async = true
        script.onload = () => {
          bkashInitialized.current = true
          setBkashReady(true)
        }
        script.onerror = () => {
          console.warn("bKash SDK script failed to load")
        }
        document.head.appendChild(script)
      } catch {
        console.warn("Failed to load bKash config")
      }
    }

    initBkash()
  }, [])

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

  // Create order (returns order data)
  async function createOrder(): Promise<any> {
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
    if (!res.ok) throw new Error(data.error || "অর্ডার তৈরি ব্যর্থ হয়েছে")
    return data.data
  }

  // Execute bKash payment after PIN verification
  const executeBkashPayment = useCallback(async (paymentID: string, orderId: string) => {
    try {
      const res = await fetch("/api/bkash/execute-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paymentID, orderId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data
    } catch (err: any) {
      console.error("bKash execute error:", err)
      throw err
    }
  }, [])

  // bKash payment flow
  async function handleBkashPayment(orderData: any) {
    if (!window.bKash) {
      setServerError("bKash পেমেন্ট সিস্টেম লোড হয়নি। আবার চেষ্টা করুন।")
      setBkashProcessing(false)
      return
    }

    const orderId = orderData.order_id
    let currentPaymentID = ""

    try {
      // Configure bKash SDK
      window.bKash.config({
        paymentMode: "checkout",
        paymentRequest: {
          amount: String(total),
          intent: "sale",
          currency: "BDT",
          merchantInvoiceNumber: orderData.invoice_no || `INV-${orderId}`,
        },
        createRequest: async (request: any) => {
          try {
            // Create payment on backend
            const res = await fetch("/api/bkash/create-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                amount: String(total),
                order_id: orderId,
              }),
            })
            const data = await res.json()

            if (data.paymentID) {
              currentPaymentID = data.paymentID
              window.bKash!.create().onSuccess(data)
            } else {
              window.bKash!.create().onError()
              setServerError("bKash পেমেন্ট তৈরি ব্যর্থ: " + (data.error || "অজ্ঞাত ত্রুটি"))
              setBkashProcessing(false)
            }
          } catch (err: any) {
            window.bKash!.create().onError()
            setServerError("bKash পেমেন্ট তৈরি ব্যর্থ: " + err.message)
            setBkashProcessing(false)
          }
        },
        executeRequestOnAuthorization: async () => {
          try {
            const result = await executeBkashPayment(currentPaymentID, orderId)

            if (result.status === "Completed") {
              // Payment successful — clear cart and show success
              clearCart()
              setOrderResult({
                order_id: orderId,
                total: total,
                payment_status: "paid",
                bkash_trx_id: result.trxID,
              })
              setBkashProcessing(false)
            } else {
              setServerError("bKash পেমেন্ট ব্যর্থ। অবস্থা: " + result.status)
              setBkashProcessing(false)
            }
          } catch (err: any) {
            window.bKash!.execute().onError()
            setServerError("bKash পেমেন্ট এক্সিকিউট ব্যর্থ: " + err.message)
            setBkashProcessing(false)
          }
        },
        onClose: () => {
          setBkashProcessing(false)
        },
      })

      // Trigger the bKash popup
      window.bKash.create().onSuccess({
        paymentID: "", // Will be set by createRequest
      })
    } catch (err: any) {
      setServerError("bKash পেমেন্ট ত্রুটি: " + err.message)
      setBkashProcessing(false)
    }
  }

  // Handle form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || items.length === 0) return

    setSubmitting(true)
    setServerError("")
    setBkashProcessing(true)

    try {
      // Step 1: Create the order
      const orderData = await createOrder()

      // Step 2: Process payment based on method
      if (paymentMethod === "bkash") {
        await handleBkashPayment(orderData)
      } else {
        // Cash on Delivery — order is already "pending_payment"
        clearCart()
        setOrderResult({
          ...orderData,
          payment_status: "pending_payment",
        })
        setBkashProcessing(false)
      }
    } catch (err: any) {
      setServerError(err.message || "একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।")
      setBkashProcessing(false)
    } finally {
      setSubmitting(false)
    }
  }

  // Success view
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
          {orderResult.payment_status === "paid" && (
            <p style={{ color: "#16a34a", marginBottom: "var(--sp-2)" }}>
              পেমেন্ট সম্পন্ন (bKash)
              {orderResult.bkash_trx_id && <span style={{ display: "block", fontSize: "0.875rem" }}>ট্রানজেকশন আইডি: {orderResult.bkash_trx_id}</span>}
            </p>
          )}
          {orderResult.payment_status === "pending_payment" && (
            <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
              পেমেন্ট স্ট্যাটাস: ক্যাশ অন ডেলিভারি
            </p>
          )}
          <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
            <Link href="/account/orders" className="btn btn-primary">আমার অর্ডার</Link>
            <Link href="/books" className="btn btn-secondary">আরও বই দেখুন</Link>
          </div>
        </div>
      </div>
    )
  }

  // Empty cart
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
  const isProcessing = submitting || bkashProcessing

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

            {/* Payment Method */}
            <div className="checkout-section">
              <h2>পেমেন্ট পদ্ধতি</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
                <label
                  style={{
                    display: "flex", alignItems: "center", gap: "var(--sp-3)",
                    padding: "var(--sp-3) var(--sp-4)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)", cursor: "pointer",
                    background: paymentMethod === "bkash" ? "#fff7ed" : "var(--white)",
                    borderColor: paymentMethod === "bkash" ? "var(--terracotta)" : "var(--border)",
                    opacity: bkashReady ? 1 : 0.5,
                  }}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    checked={paymentMethod === "bkash"}
                    onChange={() => setPaymentMethod("bkash")}
                    disabled={!bkashReady}
                  />
                  <div>
                    <span style={{ fontWeight: 600 }}>bKash</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--stone)", marginLeft: "var(--sp-2)" }}>
                      {!bkashReady ? "লোড হচ্ছে..." : "অনলাইন পেমেন্ট"}
                    </span>
                  </div>
                </label>
                <label
                  style={{
                    display: "flex", alignItems: "center", gap: "var(--sp-3)",
                    padding: "var(--sp-3) var(--sp-4)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)", cursor: "pointer",
                    background: paymentMethod === "cod" ? "#fff7ed" : "var(--white)",
                    borderColor: paymentMethod === "cod" ? "var(--terracotta)" : "var(--border)",
                  }}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                  />
                  <div>
                    <span style={{ fontWeight: 600 }}>ক্যাশ অন ডেলিভারি</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--stone)", marginLeft: "var(--sp-2)" }}>
                      ডেলিভারির সময় পেমেন্ট
                    </span>
                  </div>
                </label>
              </div>
              {paymentMethod === "bkash" && !bkashReady && (
                <p style={{ fontSize: "0.8125rem", color: "var(--stone)", marginTop: "var(--sp-2)" }}>
                  bKash পেমেন্ট সিস্টেম লোড হচ্ছে...
                </p>
              )}
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
                disabled={isProcessing}
                style={{ width: "100%", marginTop: "var(--sp-4)" }}
              >
                {isProcessing
                  ? (bkashProcessing ? "bKash পেমেন্ট প্রক্রিয়াকরণ..." : "অর্ডার প্রক্রিয়াকরণ...")
                  : (paymentMethod === "bkash" ? "bKash দিয়ে পেমেন্ট করুন" : "অর্ডার করুন")}
              </button>
              {paymentMethod === "bkash" && (
                <p style={{ fontSize: "0.75rem", color: "var(--stone)", textAlign: "center", marginTop: "var(--sp-2)" }}>
                  bKash পপআপে আপনার PIN দিয়ে পেমেন্ট সম্পন্ন করুন
                </p>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
