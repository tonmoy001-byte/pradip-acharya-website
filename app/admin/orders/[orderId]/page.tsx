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
  shipping_address: { line1?: string; line2?: string; city?: string; district?: string; postal_code?: string } | null
  payment_method: string | null
  payment_reference: string | null
  receipt_storage_key: string | null
  bkash_trx_id: string | null
  created_at: string
  paid_at: string | null
  cancelled_at: string | null
  order_items: OrderItem[]
  profile?: { display_name: string | null } | null
}

const PAYMENT_LABELS: Record<string, string> = {
  pending_payment: "অপেক্ষমান",
  pending_verification: "যাচাই বাকি",
  paid: "পেইড",
  refunded: "ফেরত",
  failed: "ব্যর্থ",
}

const FULFILLMENT_LABELS: Record<string, string> = {
  not_applicable: "প্রযোজ্য নয়",
  pending: "বাকি",
  shipped: "পাঠানো হয়েছে",
  delivered: "ডেলিভারি হয়েছে",
  returned: "ফেরত",
}

export default function AdminOrderDetailPage() {
  const { orderId } = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [updatingFulfillment, setUpdatingFulfillment] = useState(false)

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

  const handleApprove = async () => {
    if (!confirm("এই অর্ডার অনুমোদন করতে চান?")) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/approve`, { method: "POST" })
      if (!res.ok) throw new Error("অনুমোদন করা যায়নি")
      setOrder((prev) => prev ? { ...prev, payment_status: "paid", paid_at: new Date().toISOString() } : prev)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!confirm("এই অর্ডার প্রত্যাখ্যান করতে চান?")) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/reject`, { method: "POST" })
      if (!res.ok) throw new Error("প্রত্যাখ্যান করা যায়নি")
      setOrder((prev) => prev ? { ...prev, payment_status: "failed" } : prev)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleFulfillmentChange = async (newStatus: string) => {
    setUpdatingFulfillment(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fulfillment_status: newStatus }),
      })
      if (!res.ok) throw new Error("আপডেট করা যায়নি")
      setOrder((prev) => prev ? { ...prev, fulfillment_status: newStatus } : prev)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUpdatingFulfillment(false)
    }
  }

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
          {order.payment_status === "pending_verification" && (
            <>
              <button className="btn btn-primary" onClick={handleApprove} disabled={actionLoading}>অনুমোদন</button>
              <button className="btn btn-danger" onClick={handleReject} disabled={actionLoading}>প্রত্যাখ্যান</button>
            </>
          )}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--ink-muted)" }}>ডেলিভারি</span>
              <select
                className="admin-input"
                style={{ width: "auto", padding: "4px 8px", fontSize: "0.8125rem" }}
                value={order.fulfillment_status}
                disabled={updatingFulfillment}
                onChange={(e) => handleFulfillmentChange(e.target.value)}
              >
                {Object.entries(FULFILLMENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
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

        {/* Contact & Shipping */}
        <div style={{ background: "var(--white)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", padding: "var(--sp-5)" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--sp-4)" }}>যোগাযোগ ও শিপিং</h2>
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
            {order.shipping_address && (
              <div style={{ marginTop: "var(--sp-2)" }}>
                <span style={{ color: "var(--ink-muted)", fontSize: "0.8125rem" }}>ঠিকানা:</span>
                <p style={{ marginTop: "var(--sp-1)", fontSize: "0.875rem", lineHeight: 1.6 }}>
                  {order.shipping_address.line1}
                  {order.shipping_address.line2 && <>, {order.shipping_address.line2}</>}
                  <br />
                  {order.shipping_address.city && `${order.shipping_address.city}, `}
                  {order.shipping_address.district}
                  {order.shipping_address.postal_code && ` - ${order.shipping_address.postal_code}`}
                </p>
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
              <th>ডেলিভারি</th>
              <th>পরিমাণ</th>
              <th>একক মূল্য</th>
              <th>মোট</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{item.title_snapshot}</div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--ink-muted)" }}>{item.author_snapshot}</div>
                </td>
                <td>{item.format_snapshot}</td>
                <td>{item.delivery_type_snapshot === "digital" ? "ডিজিটাল" : "ফিজিক্যাল"}</td>
                <td>{item.quantity}</td>
                <td>{money(item.unit_price_snapshot)}</td>
                <td style={{ fontWeight: 600 }}>{money(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ marginTop: "var(--sp-4)", borderTop: "1px solid var(--border)", paddingTop: "var(--sp-4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--sp-2)" }}>
            <span style={{ color: "var(--ink-muted)" }}>সাবটোটাল</span>
            <span>{money(order.subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--sp-2)" }}>
            <span style={{ color: "var(--ink-muted)" }}>ডেলিভারি</span>
            <span>{order.delivery_charge === 0 ? "বিনামূল্যে" : money(order.delivery_charge)}</span>
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
