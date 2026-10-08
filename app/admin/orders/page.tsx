// app/admin/orders/page.tsx
// Admin orders page — stats, filters, table with approve/reject modals.

"use client"

import { useEffect, useState, useCallback } from "react"
import OrderRow, { AdminOrder } from "@/components/admin/OrderRow"
import ToastContainer, { showToast } from "@/components/admin/Toast"

interface Stats {
  totalOrders: number
  pendingVerification: number
  totalRevenue: number
  pendingDownloads: number
}

const FILTERS = [
  { value: "", label: "সব" },
  { value: "pending_verification", label: "যাচাই বাকি" },
  { value: "paid", label: "পেইড" },
  { value: "refunded", label: "ফেরত" },
]

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState("")

  const fetchOrders = useCallback(async () => {
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
  }, [filter])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats")
      if (res.ok) {
        setStats(await res.json())
      }
    } catch {
      // Stats are non-critical
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    fetchStats()
    function handleUpdate() {
      fetchOrders()
      fetchStats()
    }
    window.addEventListener("admin-order-updated", handleUpdate)
    return () => window.removeEventListener("admin-order-updated", handleUpdate)
  }, [fetchStats, fetchOrders])

  return (
    <div>
      <ToastContainer />

      <div className="admin-page-header">
        <h1 className="admin-page-title">অর্ডার</h1>
        <p className="admin-page-subtitle">সকল অর্ডার দেখুন এবং পরিচালনা করুন</p>
      </div>

      {stats && (
        <div className="admin-stats">
          <div className="admin-stat-card">
            <p className="admin-stat-label">মোট অর্ডার</p>
            <p className="admin-stat-value">{stats.totalOrders}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">যাচাই বাকি</p>
            <p className="admin-stat-value">{stats.pendingVerification}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">মোট আয়</p>
            <p className="admin-stat-value">৳ {stats.totalRevenue.toLocaleString("bn-BD")}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">ডাউনলোড অনুমোদন বাকি</p>
            <p className="admin-stat-value">{stats.pendingDownloads}</p>
          </div>
        </div>
      )}

      <div className="admin-filter-bar">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={`admin-filter-btn ${filter === f.value ? "admin-filter-btn-active" : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="checkout-error" style={{ marginBottom: "var(--sp-4)" }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--stone)" }}>লোড হচ্ছে...</p>
      ) : orders.length === 0 ? (
        <p style={{ color: "var(--stone)" }}>কোনো অর্ডার নেই।</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>অর্ডার</th>
              <th>গ্রাহক</th>
              <th>মোট</th>
              <th>পেমেন্ট</th>
              <th>তারিখ</th>
              <th>অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
