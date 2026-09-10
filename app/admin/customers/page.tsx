"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { money } from "@/lib/format"

interface Customer {
  user_id: string
  display_name: string
  created_at: string
  orderCount: number
  totalSpent: number
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)

    fetch(`/api/admin/customers?${params}`)
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [search])

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("bn-BD", { year: "numeric", month: "short", day: "numeric" })

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">গ্রাহক</h1>
        <p className="admin-page-subtitle">{customers.length} জন গ্রাহক</p>
      </div>

      <div className="admin-filters">
        <input
          type="text"
          className="admin-input"
          placeholder="গ্রাহক খুঁজুন..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
      </div>

      {loading ? (
        <p style={{ color: "var(--ink-muted)" }}>লোড হচ্ছে...</p>
      ) : customers.length === 0 ? (
        <div className="admin-empty">
          <p>কোনো গ্রাহক পাওয়া যায়নি</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>নাম</th>
                <th>ইউজার আইডি</th>
                <th>অর্ডার</th>
                <th>মোট খরচ</th>
                <th>যোগদান</th>
                <th>কাজ</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.user_id}>
                  <td style={{ fontWeight: 500 }}>{c.display_name}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--ink-muted)" }}>
                    {c.user_id.slice(0, 8)}...
                  </td>
                  <td>{c.orderCount}</td>
                  <td>{c.totalSpent > 0 ? money(c.totalSpent) : "—"}</td>
                  <td style={{ fontSize: "0.8125rem" }}>{formatDate(c.created_at)}</td>
                  <td>
                    <Link href={`/admin/customers/${c.user_id}`} className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }}>
                      বিস্তারিত
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
