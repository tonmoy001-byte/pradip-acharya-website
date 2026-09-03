"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { money } from "@/lib/format"

interface OrderItem {
  id: string
  title_snapshot: string
  author_snapshot: string
  format_snapshot: string
  cover_image_snapshot: string | null
  quantity: number
  unit_price_snapshot: number
  line_total: number
}

interface Order {
  id: string
  payment_status: string
  fulfillment_status: string
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
    address?: string
    city?: string
    zone?: string
  }
  payment_method: string | null
  payment_reference: string | null
  bkash_trx_id: string | null
  items: OrderItem[]
}

const TIMELINE_STEPS = [
  { key: "placed", label: "অর্ডার গৃহীত" },
  { key: "confirmed", label: "নিশ্চিত" },
  { key: "processing", label: "প্রক্রিয়াকরণ" },
  { key: "shipped", label: "পাঠানো হয়েছে" },
  { key: "delivered", label: "ডেলিভারি সম্পন্ন" },
]

function paymentLabel(s: string) {
  const map: Record<string, string> = {
    pending_payment: "অপেক্ষমান",
    pending_verification: "যাচাইকরণ অপেক্ষমান",
    payment_review: "পর্যালোচনাধীন",
    paid: "পরিশোধিত",
    refunded: "ফেরত দেওয়া হয়েছে",
  }
  return map[s] || s
}

function fulfillmentLabel(s: string) {
  const map: Record<string, string> = {
    not_applicable: "প্রযোজ্য নয়",
    pending: "অপেক্ষমান",
    processing: "প্রক্রিয়াকরণ",
    shipped: "পাঠানো হয়েছে",
    delivered: "ডেলিভারি সম্পন্ন",
    returned: "ফেরত",
  }
  return map[s] || s
}

function paymentBadgeStyle(status: string): React.CSSProperties {
  if (status === "paid") return { background: "rgba(74, 103, 65, 0.1)", color: "var(--green)" }
  if (status === "pending_payment" || status === "pending_verification") return { background: "rgba(202, 138, 4, 0.1)", color: "#92400e" }
  return { background: "rgba(107, 114, 128, 0.08)", color: "#374151" }
}

function fulfillmentBadgeStyle(status: string): React.CSSProperties {
  if (status === "delivered") return { background: "rgba(74, 103, 65, 0.1)", color: "var(--green)" }
  if (status === "shipped") return { background: "rgba(59, 130, 246, 0.1)", color: "#1d4ed8" }
  return { background: "rgba(107, 114, 128, 0.08)", color: "#374151" }
}

function getTimelineIndex(status: string): number {
  const map: Record<string, number> = {
    pending: 0,
    placed: 0,
    confirmed: 1,
    processing: 2,
    shipped: 3,
    delivered: 4,
  }
  return map[status] ?? 0
}

function paymentMethodLabel(method: string | null) {
  if (!method) return "নির্ধারিত হয়নি"
  const map: Record<string, string> = {
    bkash: "বিকাশ",
    nagad: "নগদ",
    rocket: "রকেট",
    card: "কার্ড",
    bank: "ব্যাংক ট্রান্সফার",
    cod: "ক্যাশ অন ডেলিভারি",
    manual: "ম্যানুয়াল",
  }
  return map[method] || method
}

export default function OrderDetailPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
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
        <div
          className="card"
          style={{
            padding: "var(--sp-8)",
            textAlign: "center",
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--stone)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: "var(--sp-4)", opacity: 0.5 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
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

  const timelineIdx = getTimelineIndex(order.fulfillment_status)
  const hasPhysicalItems = order.items?.some(
    (item) => item.format_snapshot !== "ই-বুক" && item.format_snapshot !== "e-book"
  )

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
            <span className="badge" style={fulfillmentBadgeStyle(order.fulfillment_status)}>
              {fulfillmentLabel(order.fulfillment_status)}
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
          অর্ডার ট্র্যাকিং
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
                    ফরম্যাট: <strong>{item.format_snapshot}</strong>
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
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9375rem" }}>
            <span style={{ color: "var(--ink-muted)" }}>ডেলিভারি চার্জ</span>
            <span>{order.delivery_charge === 0 ? "বিনামূল্যে" : money(order.delivery_charge)}</span>
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

      {/* Delivery Information */}
      {hasPhysicalItems && order.contact && (
        <div className="card" style={{ padding: "var(--sp-6)", marginBottom: "var(--sp-6)" }}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.125rem",
              fontWeight: "var(--font-weight-bold)",
              marginBottom: "var(--sp-4)",
            }}
          >
            ডেলিভারি তথ্য
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            {order.contact.name && (
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--stone)", marginBottom: "var(--sp-1)" }}>প্রাপকের নাম</p>
                <p style={{ fontSize: "0.9375rem", fontWeight: 500 }}>{order.contact.name}</p>
              </div>
            )}
            {order.contact.phone && (
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--stone)", marginBottom: "var(--sp-1)" }}>ফোন নম্বর</p>
                <p style={{ fontSize: "0.9375rem", fontWeight: 500 }}>{order.contact.phone}</p>
              </div>
            )}
            {(order.contact.address || order.contact.city || order.contact.zone) && (
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--stone)", marginBottom: "var(--sp-1)" }}>ঠিকানা</p>
                <p style={{ fontSize: "0.9375rem", fontWeight: 500 }}>
                  {[order.contact.address, order.contact.zone, order.contact.city].filter(Boolean).join(", ")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

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
          {order.payment_reference && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9375rem" }}>
              <span style={{ color: "var(--ink-muted)" }}>ট্রানজেকশন রেফারেন্স</span>
              <span style={{ fontWeight: 500, fontFamily: "var(--font-body)" }}>{order.payment_reference}</span>
            </div>
          )}
          {order.bkash_trx_id && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9375rem" }}>
              <span style={{ color: "var(--ink-muted)" }}>bKash TrxID</span>
              <span style={{ fontWeight: 500, fontFamily: "var(--font-body)" }}>{order.bkash_trx_id}</span>
            </div>
          )}
          {order.payment_status === "pending_verification" && (
            <div style={{
              marginTop: "var(--sp-3)", padding: "var(--sp-3)",
              background: "#fffbeb", border: "1px solid #fde68a",
              borderRadius: "var(--radius-md)", fontSize: "0.8125rem", color: "#92400e",
            }}>
              আপনার পেমেন্ট যাচাই করা হচ্ছে। এতে ১-২ ঘন্টা সময় লাগতে পারে।
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
