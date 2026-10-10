"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth"
import { money } from "@/lib/format"
import SeoNoindex from "@/components/SeoNoindex"
import { isAllowedPaymentUrl } from "@/lib/payment-url"

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

interface DownloadGrant {
  id: string
  order_item_id: string
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
  items: OrderItem[]
  download_grants?: DownloadGrant[]
}

function paymentBadgeClass(status: string) {
  if (status === "paid") return "badge-green"
  return ""
}

function paymentBadgeBg(status: string) {
  if (status === "paid") return undefined
  if (status === "pending_payment") return "rgba(202, 138, 4, 0.1)"
  return "rgba(107, 114, 128, 0.08)"
}

function paymentBadgeColor(status: string) {
  if (status === "paid") return undefined
  if (status === "pending_payment") return "#92400e"
  return "#374151"
}

function paymentLabel(s: string) {
  const map: Record<string, string> = {
    pending_payment: "পেমেন্ট বাকি",
    pending_verification: "পর্যালোচনাধীন", // legacy: manual-verification era
    payment_review: "পেমেন্ট নিশ্চিত হচ্ছে",
    paid: "পরিশোধিত",
    refunded: "ফেরত দেওয়া হয়েছে",
  }
  return map[s] || s
}

function downloadLabel(order: Order) {
  const isPaid = order.payment_status === "paid"
  if (!isPaid) return { text: "পেমেন্ট বাকি", bg: "rgba(107, 114, 128, 0.08)", color: "#374151" }
  const hasGrant = (order.download_grants || []).some((g) => !g.revoked_at)
  if (hasGrant) {
    return { text: "ডাউনলোড উপলব্ধ", bg: "rgba(74, 103, 65, 0.1)", color: "var(--green)" }
  }
  return { text: "অনুমোদনের অপেক্ষায়", bg: "rgba(202, 138, 4, 0.1)", color: "#92400e" }
}

export default function AccountOrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (authLoading || !user) return

    async function fetchOrders() {
      try {
        const [ordersRes, downloadsRes] = await Promise.allSettled([
          fetch("/api/my-orders", { credentials: "include" }),
          fetch("/api/my-downloads", { credentials: "include" }),
        ])

        if (ordersRes.status !== "fulfilled" || !ordersRes.value.ok) {
          setError("অর্ডার লোড করা যায়নি")
          return
        }

        const { data } = await ordersRes.value.json()
        const list: Order[] = data || []

        // Attach grant state so the list can show download availability.
        if (downloadsRes.status === "fulfilled" && downloadsRes.value.ok) {
          const downloads = await downloadsRes.value.json()
          const grantOrderIds = new Set<string>(
            (downloads.data || []).map((g: any) => g.order_id as string),
          )
          for (const order of list) {
            if (grantOrderIds.has(order.id)) {
              order.download_grants = [{ id: "x", order_item_id: "x", revoked_at: null }]
            }
          }
        }

        setOrders(list)
      } catch {
        setError("অর্ডার লোড করা যায়নি")
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [user, authLoading])

  if (authLoading || loading) {
    return (
      <div>
        <SeoNoindex />
        <div className="page-header">
          <h1>আমার অর্ডার</h1>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 160, borderRadius: "var(--radius-lg)" }} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <SeoNoindex />
        <div className="page-header">
          <h1>আমার অর্ডার</h1>
        </div>
        <div
          role="alert"
          style={{
            padding: "var(--sp-3) var(--sp-4)",
            background: "rgba(192, 57, 43, 0.06)",
            border: "1px solid rgba(192, 57, 43, 0.25)",
            borderRadius: "var(--radius-md)",
            color: "#991b1b",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      </div>
    )
  }

  return (
    <div>
      <SeoNoindex />
      <div className="page-header" style={{ paddingBottom: "var(--sp-4)" }}>
        <h1>আমার অর্ডার</h1>
        <p style={{ color: "var(--ink-muted)", marginTop: "var(--sp-2)" }}>
          আপনার অর্ডারের তালিকা
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="cart-empty">
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
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <p style={{ color: "var(--ink-muted)", marginBottom: "var(--sp-4)", fontSize: "1rem" }}>
            আপনার কোনো অর্ডার নেই
          </p>
          <Link href="/books" className="btn btn-primary">
            সকল বই দেখুন
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          {orders.map((order) => {
            const download = downloadLabel(order)
            return (
              <div
                key={order.id}
                className="card"
                style={{ padding: "var(--sp-5)", display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}
              >
                {/* Order Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "var(--sp-3)",
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 600, fontSize: "0.9375rem", fontFamily: "var(--font-body)" }}>
                      অর্ডার #{order.id.slice(0, 8)}
                    </p>
                    <p style={{ fontSize: "0.8125rem", color: "var(--stone)", marginTop: "var(--sp-1)" }}>
                      {new Date(order.created_at).toLocaleDateString("bn-BD", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
                    <span
                      className={`badge ${paymentBadgeClass(order.payment_status)}`}
                      style={{
                        background: paymentBadgeBg(order.payment_status),
                        color: paymentBadgeColor(order.payment_status),
                      }}
                    >
                      {paymentLabel(order.payment_status)}
                    </span>
                    <span className="badge" style={{ background: download.bg, color: download.color }}>
                      {download.text}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--sp-3)" }}>
                  {order.items && order.items.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
                      {order.items.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}
                        >
                          {item.cover_image_snapshot ? (
                            <img
                              src={item.cover_image_snapshot}
                              alt={item.title_snapshot}
                              style={{
                                width: 40,
                                height: 56,
                                objectFit: "cover",
                                borderRadius: "var(--radius-sm)",
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 40,
                                height: 56,
                                borderRadius: "var(--radius-sm)",
                                background: "var(--stone)",
                                opacity: 0.15,
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                fontSize: "0.875rem",
                                fontWeight: 500,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {item.title_snapshot}
                            </p>
                            <p style={{ fontSize: "0.75rem", color: "var(--stone)" }}>
                              ডিজিটাল ইবুক (PDF) × {item.quantity}
                            </p>
                          </div>
                          <p style={{ fontSize: "0.875rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                            {money(item.line_total)}
                          </p>
                        </div>
                      ))}
                      {order.items.length > 3 && (
                        <p style={{ fontSize: "0.75rem", color: "var(--stone)" }}>
                          এবং আরো {order.items.length - 3}টি আইটেম...
                        </p>
                      )}
                    </div>
                  ) : (
                    <p style={{ fontSize: "0.8125rem", color: "var(--stone)" }}>
                      আইটেম তথ্য পাওয়া যায়নি
                    </p>
                  )}
                </div>

                {/* Footer: Total + Link */}
                <div
                  style={{
                    borderTop: "1px solid var(--border)",
                    paddingTop: "var(--sp-3)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "var(--sp-2)",
                  }}
                >
                  <p style={{ fontSize: "0.9375rem", fontWeight: 600 }}>
                    মোট: {money(order.total)}
                  </p>
                  <div style={{ display: "flex", gap: "var(--sp-4)", alignItems: "center", flexWrap: "wrap" }}>
                    {order.download_grants && order.download_grants.length > 0 && (
                      <Link
                        href="/my-downloads"
                        style={{
                          fontSize: "0.875rem",
                          color: "var(--terracotta)",
                          fontWeight: 500,
                          textDecoration: "none",
                        }}
                      >
                        ডাউনলোড →
                      </Link>
                    )}
                    {order.payment_status === "pending_payment" && (
                      <button
                        onClick={async () => {
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
                            alert(err.message || "একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।")
                          }
                        }}
                        className="btn btn-primary"
                        style={{ fontSize: "0.875rem" }}
                      >
                        এখনই পেমেন্ট করুন
                      </button>
                    )}
                    <Link
                      href={`/account/orders/${order.id}`}
                      style={{
                        fontSize: "0.875rem",
                        color: "var(--terracotta)",
                        fontWeight: 500,
                        textDecoration: "none",
                      }}
                    >
                      বিস্তারিত দেখুন →
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
