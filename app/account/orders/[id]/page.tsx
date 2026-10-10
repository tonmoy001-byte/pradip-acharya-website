"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { money } from "@/lib/format"
import { isAllowedPaymentUrl } from "@/lib/payment-url"

interface OrderItem {
  id: string
  title_snapshot: string
  author_snapshot: string
  format_snapshot: string
  cover_image_snapshot: string | null
  delivery_type_snapshot?: string
  quantity: number
  unit_price_snapshot: number
  line_total: number
}

interface DownloadGrant {
  id: string
  order_item_id: string
  max_downloads: number
  download_count: number
  expires_at: string
  revoked_at: string | null
}

interface Order {
  id: string
  payment_status: string
  subtotal: number
  delivery_charge: number
  total: number
  currency: string
  created_at: string
  paid_at: string | null
  contact: {
    name?: string
    email?: string
    phone?: string
  }
  payment_method: string | null
  payment_reference: string | null
  items: OrderItem[]
  download_grants?: DownloadGrant[]
}

// Digital purchase lifecycle — no shipping steps.
const TIMELINE_STEPS = [
  { key: "placed", label: "অর্ডার গৃহীত" },
  { key: "paid", label: "পেমেন্ট যাচাই" },
  { key: "approved", label: "ডাউনলোড অনুমোদন" },
  { key: "available", label: "ডাউনলোড উপলব্ধ" },
]

function paymentLabel(s: string) {
  const map: Record<string, string> = {
    pending_payment: "পেমেন্ট বাকি",
    pending_verification: "যাচাইকরণ অপেক্ষমান",
    payment_review: "পর্যালোচনাধীন",
    paid: "পরিশোধিত",
    refunded: "ফেরত দেওয়া হয়েছে",
  }
  return map[s] || s
}

function paymentBadgeStyle(status: string): React.CSSProperties {
  if (status === "paid") return { background: "rgba(74, 103, 65, 0.1)", color: "var(--green)" }
  if (status === "pending_payment" || status === "pending_verification") return { background: "rgba(202, 138, 4, 0.1)", color: "#92400e" }
  return { background: "rgba(107, 114, 128, 0.08)", color: "#374151" }
}

function getTimelineIndex(order: Order): number {
  if (order.payment_status !== "paid") return 0
  const grants = order.download_grants || []
  if (grants.length === 0) return 1
  const active = grants.filter((g) => !g.revoked_at)
  if (active.length === 0) return 1
  const usable = active.some(
    (g) => new Date(g.expires_at) > new Date() && g.download_count < g.max_downloads,
  )
  return usable ? 3 : 2
}

function paymentMethodLabel(method: string | null) {
  if (!method) return "নির্ধারিত হয়নি"
  const map: Record<string, string> = {
    nagorikpay: "অনলাইন পেমেন্ট (bKash/Nagad/Rocket)",
    nagad: "নগদ",
    rocket: "রকেট",
    card: "কার্ড",
    bank: "ব্যাংক ট্রান্সফার",
    manual: "ম্যানুয়াল",
  }
  return map[method] || method
}

export default function OrderDetailPage() {
  const { user, loading: authLoading } = useAuth()
  const params = useParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (authLoading || !user) return

    async function fetchOrder() {
      try {
        const res = await fetch(`/api/my-orders/${orderId}`, { credentials: "include" })
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || "অর্ডার লোড করা যায়নি")
          return
        }

        setOrder(data.data)
      } catch {
        setError("অর্ডার লোড করা যায়নি")
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [user, authLoading, orderId])

  if (authLoading || loading) {
    return (
      <div>
        <div className="page-header">
          <h1>অর্ডার বিবরণ</h1>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <div className="skeleton" style={{ height: 80, borderRadius: "var(--radius-lg)" }} />
          <div className="skeleton" style={{ height: 200, borderRadius: "var(--radius-lg)" }} />
          <div className="skeleton" style={{ height: 120, borderRadius: "var(--radius-lg)" }} />
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div>
        <div className="page-header">
          <h1>অর্ডার বিবরণ</h1>
        </div>
        <div className="card" style={{ padding: "var(--sp-8)", textAlign: "center" }}>
          <p style={{ color: "var(--ink-muted)", marginBottom: "var(--sp-4)" }}>
            {error || "অর্ডার পাওয়া যায়নি"}
          </p>
          <Link href="/account/orders" className="btn btn-primary">
            ← অর্ডার তালিকায় ফিরুন
          </Link>
        </div>
      </div>
    )
  }

  const timelineIdx = getTimelineIndex(order)
  const grants = (order.download_grants || []).filter((g) => !g.revoked_at)
  const hasDownload = grants.some(
    (g) => new Date(g.expires_at) > new Date() && g.download_count < g.max_downloads,
  )
  const isPaid = order.payment_status === "paid"

  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState("")

  async function handlePay() {
    if (!order) return
    setPayLoading(true)
    setPayError("")
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ order_id: order.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "পেমেন্ট তৈরি ব্যর্থ")

      if (!isAllowedPaymentUrl(data.payment_url)) {
        throw new Error("অবৈধ পেমেন্ট URL")
      }

      window.location.href = data.payment_url
    } catch (err: any) {
      setPayError(err.message || "একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।")
      setPayLoading(false)
    }
  }

  return (
    <div>
      {/* Back Link */}
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <Link
          href="/account/orders"
          style={{
            fontSize: "0.875rem",
            color: "var(--terracotta)",
            textDecoration: "none",
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--sp-1)",
          }}
        >
          ← অর্ডার তালিকায় ফিরুন
        </Link>
      </div>

      {/* Order Header */}
      <div className="page-header" style={{ paddingBottom: "var(--sp-4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--sp-3)" }}>
          <div>
            <h1 style={{ fontSize: "1.5rem" }}>অর্ডার #{order.id.slice(0, 8)}</h1>
            <p style={{ color: "var(--stone)", marginTop: "var(--sp-1)", fontSize: "0.875rem" }}>
              {new Date(order.created_at).toLocaleDateString("bn-BD", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
            <span className="badge" style={paymentBadgeStyle(order.payment_status)}>
              {paymentLabel(order.payment_status)}
            </span>
            <span
              className="badge"
              style={
                hasDownload
                  ? { background: "rgba(74, 103, 65, 0.1)", color: "var(--green)" }
                  : { background: "rgba(202, 138, 4, 0.1)", color: "#92400e" }
              }
            >
              {hasDownload ? "ডাউনলোড উপলব্ধ" : "অনুমোদনের অপেক্ষায়"}
            </span>
          </div>
        </div>
      </div>

      {/* Order Timeline */}
      <div className="card" style={{ padding: "var(--sp-6)", marginBottom: "var(--sp-6)" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.125rem",
            fontWeight: "var(--font-weight-bold)",
            marginBottom: "var(--sp-5)",
          }}
        >
          ডাউনলোড অবস্থা
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: "var(--sp-2)" }}>
          {TIMELINE_STEPS.map((step, idx) => {
            const isActive = idx <= timelineIdx
            const isCurrent = idx === timelineIdx
            return (
              <div
                key={step.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: idx < TIMELINE_STEPS.length - 1 ? 1 : undefined,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 72 }}>
                  {/* Circle */}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: isActive ? "var(--terracotta)" : "var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "var(--sp-2)",
                      border: isCurrent ? "3px solid rgba(196, 112, 75, 0.25)" : "none",
                      transition: "all 0.2s",
                    }}
                  >
                    {isActive ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--white)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--stone)", opacity: 0.4 }} />
                    )}
                  </div>
                  {/* Label */}
                  <p
                    style={{
                      fontSize: "0.6875rem",
                      textAlign: "center",
                      fontWeight: isCurrent ? 600 : 400,
                      color: isActive ? "var(--ink)" : "var(--stone)",
                      lineHeight: 1.3,
                    }}
                  >
                    {step.label}
                  </p>
                </div>
                {/* Connector line */}
                {idx < TIMELINE_STEPS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: idx < timelineIdx ? "var(--terracotta)" : "var(--border)",
                      marginBottom: 20,
                      minWidth: 20,
                      transition: "background 0.2s",
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {!isPaid && (
          <p style={{ marginTop: "var(--sp-4)", fontSize: "0.8125rem", color: "#92400e" }}>
            পেমেন্ট সম্পন্ন হলে ডাউনলোড অনুরোধটি যাচাই করা হবে।
          </p>
        )}
        {isPaid && !hasDownload && (
          <p style={{ marginTop: "var(--sp-4)", fontSize: "0.8125rem", color: "#92400e" }}>
            আপনার ডাউনলোড অনুরোধটি অ্যাডমিন অনুমোদনের অপেক্ষায় আছে। অনুমোদনের পর এখানে ডাউনলোড লিংক দেখা যাবে।
          </p>
        )}
        {hasDownload && (
          <div style={{ marginTop: "var(--sp-4)" }}>
            <Link href="/my-downloads" className="btn btn-primary">
              ইবুক ডাউনলোড করুন
            </Link>
          </div>
        )}
      </div>

      {/* Products */}
      <div className="card" style={{ padding: "var(--sp-6)", marginBottom: "var(--sp-6)" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.125rem",
            fontWeight: "var(--font-weight-bold)",
            marginBottom: "var(--sp-4)",
          }}
        >
          পণ্যসমূহ
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          {order.items?.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                gap: "var(--sp-4)",
                paddingBottom: "var(--sp-4)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {item.cover_image_snapshot ? (
                <img
                  src={item.cover_image_snapshot}
                  alt={item.title_snapshot}
                  style={{
                    width: 64,
                    height: 90,
                    objectFit: "cover",
                    borderRadius: "var(--radius-sm)",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 64,
                    height: 90,
                    borderRadius: "var(--radius-sm)",
                    background: "var(--stone)",
                    opacity: 0.15,
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "var(--sp-1)" }}>
                  {item.title_snapshot}
                </p>
                <p style={{ fontSize: "0.8125rem", color: "var(--stone)", marginBottom: "var(--sp-2)" }}>
                  {item.author_snapshot}
                </p>
                <div style={{ display: "flex", gap: "var(--sp-4)", flexWrap: "wrap", fontSize: "0.8125rem" }}>
                  <span style={{ color: "var(--ink-muted)" }}>
                    ফরম্যাট: <strong>ডিজিটাল ইবুক (PDF)</strong>
                  </span>
                  <span style={{ color: "var(--ink-muted)" }}>
                    পরিমাণ: <strong>{item.quantity}</strong>
                  </span>
                  <span style={{ color: "var(--ink-muted)" }}>
                    একক মূল্য: <strong>{money(item.unit_price_snapshot)}</strong>
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{money(item.line_total)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing Breakdown */}
      <div className="card" style={{ padding: "var(--sp-6)", marginBottom: "var(--sp-6)" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.125rem",
            fontWeight: "var(--font-weight-bold)",
            marginBottom: "var(--sp-4)",
          }}
        >
          মূল্য বিবরণ
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9375rem" }}>
            <span style={{ color: "var(--ink-muted)" }}>সাবটোটাল</span>
            <span>{money(order.subtotal)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "1.125rem",
              fontWeight: 700,
              borderTop: "2px solid var(--border)",
              paddingTop: "var(--sp-3)",
              marginTop: "var(--sp-1)",
            }}
          >
            <span>মোট</span>
            <span style={{ color: "var(--terracotta)" }}>{money(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="card" style={{ padding: "var(--sp-6)", marginBottom: "var(--sp-6)" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.125rem",
            fontWeight: "var(--font-weight-bold)",
            marginBottom: "var(--sp-4)",
          }}
        >
          যোগাযোগের তথ্য
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {order.contact?.name && (
            <div>
              <p style={{ fontSize: "0.75rem", color: "var(--stone)", marginBottom: "var(--sp-1)" }}>নাম</p>
              <p style={{ fontSize: "0.9375rem", fontWeight: 500 }}>{order.contact.name}</p>
            </div>
          )}
          {order.contact?.email && (
            <div>
              <p style={{ fontSize: "0.75rem", color: "var(--stone)", marginBottom: "var(--sp-1)" }}>ইমেইল</p>
              <p style={{ fontSize: "0.9375rem", fontWeight: 500 }}>{order.contact.email}</p>
            </div>
          )}
          {order.contact?.phone && (
            <div>
              <p style={{ fontSize: "0.75rem", color: "var(--stone)", marginBottom: "var(--sp-1)" }}>ফোন নম্বর</p>
              <p style={{ fontSize: "0.9375rem", fontWeight: 500 }}>{order.contact.phone}</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Information */}
      <div className="card" style={{ padding: "var(--sp-6)" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.125rem",
            fontWeight: "var(--font-weight-bold)",
            marginBottom: "var(--sp-4)",
          }}
        >
          পেমেন্ট তথ্য
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9375rem" }}>
            <span style={{ color: "var(--ink-muted)" }}>পেমেন্ট পদ্ধতি</span>
            <span style={{ fontWeight: 500 }}>{paymentMethodLabel(order.payment_method)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9375rem" }}>
            <span style={{ color: "var(--ink-muted)" }}>পেমেন্ট স্ট্যাটাস</span>
            <span className="badge" style={paymentBadgeStyle(order.payment_status)}>
              {paymentLabel(order.payment_status)}
            </span>
          </div>
          {order.payment_status === "pending_payment" && !payLoading && (
            <button
              onClick={handlePay}
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "var(--sp-3)" }}
            >
              এখনই পেমেন্ট করুন
            </button>
          )}
          {order.payment_status === "pending_payment" && payLoading && (
            <button className="btn btn-primary" style={{ width: "100%", marginTop: "var(--sp-3)" }} disabled>
              লোড হচ্ছে...
            </button>
          )}
          {payError && order.payment_status === "pending_payment" && (
            <div style={{ marginTop: "var(--sp-3)", padding: "var(--sp-3)", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-md)", fontSize: "0.8125rem", color: "#991b1b" }}>
              {payError}
            </div>
          )}
          {order.payment_reference && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9375rem" }}>
              <span style={{ color: "var(--ink-muted)" }}>ট্রানজেকশন রেফারেন্স</span>
              <span style={{ fontWeight: 500, fontFamily: "var(--font-body)" }}>{order.payment_reference}</span>
            </div>
          )}
          {order.payment_status === "payment_review" && (
            <div style={{
              marginTop: "var(--sp-3)", padding: "var(--sp-3)",
              background: "#fef3c7", border: "1px solid #fde68a",
              borderRadius: "var(--radius-md)", fontSize: "0.8125rem", color: "#92400e",
            }}>
              আপনার পেমেন্ট নিশ্চিত হচ্ছে। নিশ্চিত হলেই ডাউনলোড নিজে থেকেই চালু হবে। কোনো অনুমোদনের প্রয়োজন নেই।
            </div>
          )}
          {order.payment_status === "pending_verification" && (
            <div style={{
              marginTop: "var(--sp-3)", padding: "var(--sp-3)",
              background: "#fffbeb", border: "1px solid #fde68a",
              borderRadius: "var(--radius-md)", fontSize: "0.8125rem", color: "#92400e",
            }}>
              এই অর্ডারটি আগের পদ্ধতিতে করা হয়েছিল। সহায়তার জন্য যোগাযোগ করুন।
            </div>
          )}
          {order.paid_at && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9375rem" }}>
              <span style={{ color: "var(--ink-muted)" }}>পরিশোধের তারিখ</span>
              <span>
                {new Date(order.paid_at).toLocaleDateString("bn-BD", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .order-timeline {
            overflow-x: auto;
          }
        }
      `}</style>
    </div>
  )
}
