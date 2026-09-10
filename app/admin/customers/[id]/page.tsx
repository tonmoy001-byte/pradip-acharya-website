"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { money } from "@/lib/format"

interface Order {
  id: string
  payment_status: string
  fulfillment_status: string
  total: number
  created_at: string
}

interface Customer {
  user_id: string
  display_name: string
  email: string
  created_at: string
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
  pending: "অপেক্ষমান",
  shipped: "পাঠানো হয়েছে",
  delivered: "ডেলিভারি সম্পন্ন",
  returned: "ফেরত",
}

export default function AdminCustomerDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/admin/customers/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found")
        return r.json()
      })
      .then((d) => {
        setCustomer(d.customer)
        setOrders(d.orders || [])
      })
      .catch(() => setError("গ্রাহক খুঁজে পাওয়া যায়নি"))
      .finally(() => setLoading(false))
  }, [id])

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" })

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">লোড হচ্ছে...</h1>
        </div>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">ত্রুটি</h1>
        </div>
        <p style={{ color: "var(--error)" }}>{error || "গ্রাহক পাওয়া যায়নি"}</p>
        <button className="btn btn-secondary" style={{ marginTop: "var(--sp-4)" }} onClick={() => router.back()}>ফিরে যান</button>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">{customer.display_name}</h1>
        <p className="admin-page-subtitle">ইউজার আইডি: {customer.user_id}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-6)" }}>
        <div style={{ background: "var(--white)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", padding: "var(--sp-5)" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--sp-4)" }}>গ্রাহক তথ্য</h2>
          <dl style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "var(--sp-3)", fontSize: "0.875rem" }}>
            <dt style={{ color: "var(--ink-muted)" }}>নাম</dt>
            <dd>{customer.display_name}</dd>
            <dt style={{ color: "var(--ink-muted)" }}>ইমেইল</dt>
            <dd>{customer.email || "—"}</dd>
            <dt style={{ color: "var(--ink-muted)" }}>ইউজার আইডি</dt>
            <dd style={{ fontFamily: "monospace", fontSize: "0.8125rem" }}>{customer.user_id}</dd>
            <dt style={{ color: "var(--ink-muted)" }}>যোগদান</dt>
            <dd>{formatDate(customer.created_at)}</dd>
            <dt style={{ color: "var(--ink-muted)" }}>মোট অর্ডার</dt>
            <dd>{orders.length}</dd>
            <dt style={{ color: "var(--ink-muted)" }}>মোট খরচ</dt>
            <dd>{money(orders.filter((o) => o.payment_status === "paid").reduce((s, o) => s + Number(o.total), 0))}</dd>
          </dl>
        </div>

        <div style={{ background: "var(--white)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", padding: "var(--sp-5)" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--sp-4)" }}>অর্ডার ({orders.length})</h2>
          {orders.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.875rem" }}>কোনো অর্ডার নেই</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              {orders.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--sp-2)", borderRadius: 4, border: "1px solid var(--border)", textDecoration: "none", color: "inherit", fontSize: "0.875rem" }}
                >
                  <div>
                    <span style={{ fontFamily: "monospace" }}>#{o.id.slice(0, 8)}</span>
                    <span style={{ marginLeft: "var(--sp-2)" }}>{money(o.total)}</span>
                  </div>
                  <span className={`admin-badge ${o.payment_status === "paid" ? "admin-badge-published" : "admin-badge-admin"}`} style={{ fontSize: "0.6875rem" }}>
                    {PAYMENT_LABELS[o.payment_status] || o.payment_status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: "var(--sp-6)" }}>
        <button className="btn btn-secondary" onClick={() => router.back()}>ফিরে যান</button>
      </div>
    </div>
  )
}
