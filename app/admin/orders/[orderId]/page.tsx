"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { money } from "@/lib/format"

interface OrderItem {
  id: string
  title_snapshot: string
  author_snapshot: string
  format_snapshot: string
  delivery_type_snapshot: string
  quantity: number
  unit_price_snapshot: number
  line_total: number
}

interface Order {
  id: string
  user_id: string | null
  payment_status: string
  fulfillment_status: string
  currency: string
  subtotal: number
  delivery_charge: number
  total: number
  contact: { name?: string; email?: string; phone?: string }
  payment_method: string | null
  payment_reference: string | null
  created_at: string
  paid_at: string | null
  cancelled_at: string | null
  order_items: OrderItem[]
  profile?: { display_name: string | null } | null
  /** Download grants issued for this order's ebook lines. */
  download_grants?: Array<{
    id: string
    order_item_id: string
    max_downloads: number
    download_count: number
    expires_at: string
    revoked_at: string | null
  }>
}

const PAYMENT_LABELS: Record<string, string> = {
  pending_payment: "অপেক্ষমান",
  pending_verification: "যাচাই বাকি", // legacy: manual-verification era
  payment_review: "পেমেন্ট নিশ্চিত হচ্ছে",
  paid: "পেইড",
  refunded: "ফেরত",
  failed: "ব্যর্থ",
}

export default function AdminOrderDetailPage() {
  const { orderId } = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/admin/orders/${orderId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found")
        return r.json()
      })
      .then((d) => setOrder(d.order))
      .catch(() => setError("অর্ডার খুঁজে পাওয়া যায়নি"))
      .finally(() => setLoading(false))
  }, [orderId])

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">লোড হচ্ছে...</h1>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">ত্রুটি</h1>
        </div>
        <p style={{ color: "var(--error)" }}>{error || "অর্ডার পাওয়া যায়নি"}</p>
        <button className="btn btn-secondary" style={{ marginTop: "var(--sp-4)" }} onClick={() => router.back()}>ফিরে যান</button>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">অর্ডার #{order.id.slice(0, 8)}</h1>
          <p className="admin-page-subtitle">{new Date(order.created_at).toLocaleString("bn-BD")}</p>
        </div>
        <div style={{ display: "flex", gap: "var(--sp-3)" }}>
          <Link href="/admin/orders" className="btn btn-secondary">সব অর্ডার</Link>
        </div>
      </div>

      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-6)" }}>
        {/* Status & Payment */}
        <div style={{ background: "var(--white)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", padding: "var(--sp-5)" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--sp-4)" }}>অবস্থা ও পেমেন্ট</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-muted)" }}>পেমেন্ট</span>
              <span className={`admin-badge ${order.payment_status === "paid" ? "admin-badge-published" : "admin-badge-admin"}`}>
                {PAYMENT_LABELS[order.payment_status] || order.payment_status}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-muted)" }}>ফুলফিলমেন্ট</span>
              <span className="admin-badge admin-badge-published">ডিজিটাল — কোনো শিপিং নেই</span>
            </div>
            {order.payment_method && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--ink-muted)" }}>পেমেন্ট পদ্ধতি</span>
                <span>{order.payment_method}</span>
              </div>
            )}
            {order.payment_reference && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--ink-muted)" }}>পেমেন্ট রেফারেন্স</span>
                <span style={{ fontFamily: "monospace", fontSize: "0.8125rem" }}>{order.payment_reference}</span>
              </div>
            )}
            {order.paid_at && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--ink-muted)" }}>পেইড হয়েছে</span>
                <span>{new Date(order.paid_at).toLocaleString("bn-BD")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Contact */}
        <div style={{ background: "var(--white)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", padding: "var(--sp-5)" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--sp-4)" }}>যোগাযোগের তথ্য</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            {order.profile?.display_name && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--ink-muted)" }}>গ্রাহক</span>
                <span>{order.profile.display_name}</span>
              </div>
            )}
            {order.contact?.name && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--ink-muted)" }}>নাম</span>
                <span>{order.contact.name}</span>
              </div>
            )}
            {order.contact?.phone && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--ink-muted)" }}>ফোন</span>
                <span>{order.contact.phone}</span>
              </div>
            )}
            {order.contact?.email && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--ink-muted)" }}>ইমেইল</span>
                <span>{order.contact.email}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div style={{ background: "var(--white)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", padding: "var(--sp-5)", marginTop: "var(--sp-6)" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--sp-4)" }}>অর্ডার আইটেম</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>বই</th>
              <th>ফরম্যাট</th>
              <th>পরিমাণ</th>
              <th>একক মূল্য</th>
              <th>মোট</th>
              <th>ডাউনলোড</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map((item) => {
              const grant = order.download_grants?.find(
                (g) => g.order_item_id === item.id && !g.revoked_at,
              )
              return (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{item.title_snapshot}</div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--ink-muted)" }}>{item.author_snapshot}</div>
                  </td>
                  <td>ডিজিটাল ইবুক (PDF)</td>
                  <td>{item.quantity}</td>
                  <td>{money(item.unit_price_snapshot)}</td>
                  <td style={{ fontWeight: 600 }}>{money(item.line_total)}</td>
                  <td>
                    {item.delivery_type_snapshot === "digital" ? (
                      grant ? (
                        <span className="admin-badge admin-badge-published" style={{ fontSize: "0.6875rem" }}>
                          অনুমোদিত · {grant.download_count}/{grant.max_downloads}
                        </span>
                      ) : (
                        <span className="admin-badge admin-badge-draft" style={{ fontSize: "0.6875rem" }}>
                          অনুমোদনের অপেক্ষায়
                        </span>
                      )
                    ) : (
                      <span className="admin-badge admin-badge-draft" style={{ fontSize: "0.6875rem" }}>
                        পুরনো ফিজিক্যাল অর্ডার
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ marginTop: "var(--sp-4)", borderTop: "1px solid var(--border)", paddingTop: "var(--sp-4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--sp-2)" }}>
            <span style={{ color: "var(--ink-muted)" }}>সাবটোটাল</span>
            <span>{money(order.subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "1.125rem", borderTop: "2px solid var(--border)", paddingTop: "var(--sp-3)", marginTop: "var(--sp-3)" }}>
            <span>মোট</span>
            <span>{money(order.total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/*
Orders are immutable from the admin API. Payment status changes only when
NagorikPay confirms a transaction (lib/payment-settlement.ts, via
/api/payment/verify and /api/payment/webhook).
*/