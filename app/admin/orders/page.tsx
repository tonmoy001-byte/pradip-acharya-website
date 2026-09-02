"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
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
  subtotal: number
  delivery_charge: number
  total: number
  contact: { name?: string; email?: string; phone?: string }
  created_at: string
  paid_at: string | null
  order_items: OrderItem[]
}

export default function AdminOrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<string>("")
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/login")
      return
    }
    fetchOrders()
  }, [user, authLoading, router, filter])

  async function fetchOrders() {
    setLoading(true)
    setError("")
    try {
      const url = filter
        ? `/api/admin/orders?status=${filter}`
        : "/api/admin/orders"

      const res = await fetch(url)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to load orders")
        return
      }

      setOrders(data.data || [])
    } catch {
      setError("Failed to load orders")
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(orderId: string) {
    const ref = prompt("পেমেন্ট রেফারেন্স দিন:")
    if (!ref) return

    setActing(orderId)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentReference: ref }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Approval failed")
        return
      }

      fetchOrders()
    } catch {
      alert("Approval failed")
    } finally {
      setActing(null)
    }
  }

  async function handleReject(orderId: string) {
    const reason = prompt("প্রত্যাখ্যানের কারণ (ঐচ্ছিক):")
    if (reason === null) return

    setActing(orderId)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || null }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Rejection failed")
        return
      }

      fetchOrders()
    } catch {
      alert("Rejection failed")
    } finally {
      setActing(null)
    }
  }

  function paymentLabel(s: string) {
    const map: Record<string, string> = {
      pending_payment: "অপেক্ষমান",
      payment_review: "পর্যালোচনাধীন",
      paid: "পরিশোধিত",
      refunded: "ফেরত",
    }
    return map[s] || s
  }

  if (authLoading) {
    return (
      <div className="container section-padding">
        <div className="page-header"><h1>অর্ডার ব্যবস্থাপনা</h1></div>
        <p>লোড হচ্ছে...</p>
      </div>
    )
  }

  return (
    <div className="container section-padding">
      <div className="page-header">
        <h1>অর্ডার ব্যবস্থাপনা</h1>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: "var(--sp-2)", marginBottom: "var(--sp-6)", flexWrap: "wrap" }}>
        {[
          { value: "", label: "সব" },
          { value: "pending_payment", label: "অপেক্ষমান" },
          { value: "paid", label: "পরিশোধিত" },
          { value: "refunded", label: "ফেরত" },
        ].map((f) => (
          <button
            key={f.value}
            className={`filter-pill ${filter === f.value ? "active" : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" style={{ padding: "var(--sp-3) var(--sp-4)", marginBottom: "var(--sp-4)", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius)", color: "#991b1b", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <p>লোড হচ্ছে...</p>
      ) : orders.length === 0 ? (
        <p style={{ color: "var(--stone)" }}>কোনো অর্ডার নেই।</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          {orders.map((order) => (
            <div key={order.id} className="cart-item" style={{ flexDirection: "column", gap: "var(--sp-3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "var(--sp-2)" }}>
                <div>
                  <p style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.875rem" }}>
                    অর্ডার #{order.id.slice(0, 8)}...
                  </p>
                  <p style={{ fontSize: "0.8125rem", color: "var(--stone)" }}>
                    {new Date(order.created_at).toLocaleDateString("bn-BD")} • {order.contact?.name || "নাম নেই"}
                  </p>
                  <p style={{ fontSize: "0.8125rem", color: "var(--stone)" }}>
                    {order.contact?.email || ""} • {order.contact?.phone || ""}
                  </p>
                </div>
                <div style={{ textAlign: "end" }}>
                  <p style={{ fontFamily: "var(--font-body)", fontWeight: 600 }}>{money(order.total)}</p>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "var(--radius)",
                    background: order.payment_status === "paid" ? "#dcfce7" : "#fef3c7",
                    color: order.payment_status === "paid" ? "#166534" : "#92400e",
                    fontSize: "0.8125rem",
                  }}>
                    {paymentLabel(order.payment_status)}
                  </span>
                </div>
              </div>

              {/* Order items */}
              <div style={{ fontSize: "0.8125rem", borderTop: "1px solid var(--border)", paddingTop: "var(--sp-2)" }}>
                {order.order_items?.map((item) => (
                  <p key={item.id}>
                    {item.title_snapshot} ({item.format_snapshot}) × {item.quantity} = {money(item.line_total)}
                  </p>
                ))}
              </div>

              {/* Actions */}
              {order.payment_status !== "paid" && order.payment_status !== "refunded" && (
                <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleApprove(order.id)}
                    disabled={acting === order.id}
                    style={{ fontSize: "0.8125rem", padding: "var(--sp-2) var(--sp-4)" }}
                  >
                    অনুমোদন
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleReject(order.id)}
                    disabled={acting === order.id}
                    style={{ fontSize: "0.8125rem", padding: "var(--sp-2) var(--sp-4)" }}
                  >
                    প্রত্যাখ্যান
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
