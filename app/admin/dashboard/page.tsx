"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { money } from "@/lib/format"

interface DashboardData {
  totalOrders: number
  paidOrders: number
  totalRevenue: number
  pendingDeliveries: number
  totalBooks: number
  totalPosts: number
  totalCustomers: number
  recentOrders: any[]
  recentPosts: any[]
}

const PAYMENT_LABELS: Record<string, string> = {
  pending_payment: "অপেক্ষমান",
  pending_verification: "যাচাই বাকি",
  paid: "পেইড",
  refunded: "ফেরত",
  failed: "ব্যর্থ",
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">ড্যাশবোর্ড</h1>
        </div>
        <p style={{ color: "var(--ink-muted)" }}>লোড হচ্ছে...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">ড্যাশবোর্ড</h1>
        </div>
        <p style={{ color: "var(--error)" }}>ডেটা লোড করা যায়নি</p>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">ড্যাশবোর্ড</h1>
        <p className="admin-page-subtitle">সাইটের সারসংক্ষেপ</p>
      </div>

      <div className="admin-stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="admin-stat-card">
          <div className="admin-stat-label">মোট অর্ডার</div>
          <div className="admin-stat-value">{data.totalOrders}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">মোট আয়</div>
          <div className="admin-stat-value">{money(data.totalRevenue)}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">পেইড অর্ডার</div>
          <div className="admin-stat-value">{data.paidOrders}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">মোট বই</div>
          <div className="admin-stat-value">{data.totalBooks}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">মোট পোস্ট</div>
          <div className="admin-stat-value">{data.totalPosts}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">মোট গ্রাহক</div>
          <div className="admin-stat-value">{data.totalCustomers}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-6)", marginTop: "var(--sp-6)" }}>
        {/* Recent Orders */}
        <div style={{ background: "var(--white)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", padding: "var(--sp-5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>সাম্প্রতিক অর্ডার</h2>
            <Link href="/admin/orders" style={{ fontSize: "0.8125rem", color: "var(--terracotta)" }}>সব দেখুন</Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.875rem" }}>কোনো অর্ডার নেই</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              {data.recentOrders.map((order: any) => (
                <div key={order.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--sp-2) 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <span style={{ fontFamily: "monospace", fontSize: "0.8125rem", color: "var(--ink-muted)" }}>#{order.id.slice(0, 8)}</span>
                    <span style={{ marginLeft: "var(--sp-2)", fontSize: "0.8125rem" }}>{money(order.total)}</span>
                  </div>
                  <span className={`admin-badge ${order.payment_status === "paid" ? "admin-badge-published" : "admin-badge-admin"}`}>
                    {PAYMENT_LABELS[order.payment_status] || order.payment_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions + Recent Posts */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <div style={{ background: "var(--white)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", padding: "var(--sp-5)" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--sp-4)" }}>দ্রুত কাজ</h2>
            <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
              <Link href="/admin/books/new" className="btn btn-primary" style={{ fontSize: "0.8125rem" }}>বই যোগ করুন</Link>
              <Link href="/admin/posts/new" className="btn btn-primary" style={{ fontSize: "0.8125rem" }}>পোস্ট যোগ করুন</Link>
              <Link href="/admin/orders" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>অর্ডার দেখুন</Link>
            </div>
          </div>

          <div style={{ background: "var(--white)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", padding: "var(--sp-5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>সাম্প্রতিক পোস্ট</h2>
              <Link href="/admin/posts" style={{ fontSize: "0.8125rem", color: "var(--terracotta)" }}>সব দেখুন</Link>
            </div>
            {data.recentPosts.length === 0 ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "0.875rem" }}>কোনো পোস্ট নেই</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                {data.recentPosts.map((post: any) => (
                  <div key={post.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--sp-2) 0", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <span style={{ fontSize: "0.875rem" }}>{post.title}</span>
                      <span className={`admin-badge ${post.post_type === "blog" ? "admin-badge-published" : "admin-badge-draft"}`} style={{ marginLeft: "var(--sp-2)", fontSize: "0.6875rem" }}>
                        {post.post_type === "blog" ? "ব্লগ" : "পেজ"}
                      </span>
                    </div>
                    <span className={`admin-badge ${post.status === "published" ? "admin-badge-published" : "admin-badge-draft"}`} style={{ fontSize: "0.6875rem" }}>
                      {post.status === "published" ? "প্রকাশিত" : "ড্রাফট"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
