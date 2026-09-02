"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth"
import { money } from "@/lib/format"

interface Order {
  id: string
  payment_status: string
  fulfillment_status: string
  total: number
  created_at: string
  items: Array<{
    books: { title: string; cover_image: string } | null
  }>
}

export default function AccountDashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [activeOrders, setActiveOrders] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [wishlistCount, setWishlistCount] = useState(0)
  const [addressCount, setAddressCount] = useState(0)
  const [recentOrder, setRecentOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading || !user) return

    async function fetchDashboard() {
      try {
        const [ordersRes, wishlistRes, addressesRes] = await Promise.allSettled([
          fetch("/api/my-orders", { credentials: "include" }),
          fetch("/api/wishlist", { credentials: "include" }),
          fetch("/api/addresses", { credentials: "include" }),
        ])

        if (ordersRes.status === "fulfilled" && ordersRes.value.ok) {
          const { data } = await ordersRes.value.json()
          const orders: Order[] = data || []
          setTotalOrders(orders.length)
          setActiveOrders(
            orders.filter(
              (o) => o.fulfillment_status !== "delivered" && o.fulfillment_status !== "returned"
            ).length
          )
          if (orders.length > 0) {
            setRecentOrder(orders[0])
          }
        }

        if (wishlistRes.status === "fulfilled" && wishlistRes.value.ok) {
          const { data } = await wishlistRes.value.json()
          setWishlistCount(Array.isArray(data) ? data.length : 0)
        }

        if (addressesRes.status === "fulfilled" && addressesRes.value.ok) {
          const { data } = await addressesRes.value.json()
          setAddressCount(Array.isArray(data) ? data.length : 0)
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [user, authLoading])

  if (authLoading || loading) {
    return (
      <div>
        <div className="page-header">
          <h1>ড্যাশবোর্ড</h1>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--sp-4)" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 100, borderRadius: "var(--radius-lg)" }} />
          ))}
        </div>
      </div>
    )
  }

  const displayName = user?.name || user?.email || "ব্যবহারকারী"

  return (
    <div>
      {/* Welcome */}
      <div className="page-header" style={{ paddingBottom: "var(--sp-4)" }}>
        <h1>{displayName}, আপনাকে স্বাগতম!</h1>
        <p style={{ color: "var(--ink-muted)", marginTop: "var(--sp-2)" }}>
          আপনার অ্যাকাউন্ট পরিচালনা করুন
        </p>
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "var(--sp-4)",
          marginBottom: "var(--sp-8)",
        }}
      >
        <div
          className="card"
          style={{ padding: "var(--sp-5)", cursor: "pointer", textDecoration: "none" }}
        >
          <Link href="/account/orders" style={{ textDecoration: "none", color: "inherit" }}>
            <p style={{ fontSize: "0.8125rem", color: "var(--stone)", marginBottom: "var(--sp-1)" }}>
              চলমান অর্ডার
            </p>
            <p
              style={{
                fontSize: "1.75rem",
                fontFamily: "var(--font-display)",
                fontWeight: "var(--font-weight-bold)",
                color: "var(--terracotta)",
              }}
            >
              {activeOrders}
            </p>
          </Link>
        </div>

        <div
          className="card"
          style={{ padding: "var(--sp-5)", cursor: "pointer", textDecoration: "none" }}
        >
          <Link href="/account/orders" style={{ textDecoration: "none", color: "inherit" }}>
            <p style={{ fontSize: "0.8125rem", color: "var(--stone)", marginBottom: "var(--sp-1)" }}>
              মোট অর্ডার
            </p>
            <p
              style={{
                fontSize: "1.75rem",
                fontFamily: "var(--font-display)",
                fontWeight: "var(--font-weight-bold)",
                color: "var(--ink)",
              }}
            >
              {totalOrders}
            </p>
          </Link>
        </div>

        <div
          className="card"
          style={{ padding: "var(--sp-5)", cursor: "pointer", textDecoration: "none" }}
        >
          <Link href="/account/wishlist" style={{ textDecoration: "none", color: "inherit" }}>
            <p style={{ fontSize: "0.8125rem", color: "var(--stone)", marginBottom: "var(--sp-1)" }}>
              পছন্দের তালিকা
            </p>
            <p
              style={{
                fontSize: "1.75rem",
                fontFamily: "var(--font-display)",
                fontWeight: "var(--font-weight-bold)",
                color: "var(--terracotta)",
              }}
            >
              {wishlistCount}
            </p>
          </Link>
        </div>

        <div
          className="card"
          style={{ padding: "var(--sp-5)", cursor: "pointer", textDecoration: "none" }}
        >
          <Link href="/account/addresses" style={{ textDecoration: "none", color: "inherit" }}>
            <p style={{ fontSize: "0.8125rem", color: "var(--stone)", marginBottom: "var(--sp-1)" }}>
              সংরক্ষিত ঠিকানা
            </p>
            <p
              style={{
                fontSize: "1.75rem",
                fontFamily: "var(--font-display)",
                fontWeight: "var(--font-weight-bold)",
                color: "var(--ink)",
              }}
            >
              {addressCount}
            </p>
          </Link>
        </div>
      </div>

      {/* Recent Order */}
      <div style={{ marginBottom: "var(--sp-8)" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.25rem",
            fontWeight: "var(--font-weight-bold)",
            marginBottom: "var(--sp-4)",
          }}
        >
          সাম্প্রতিক অর্ডার
        </h2>

        {recentOrder ? (
          <Link
            href={`/account/orders`}
            className="card"
            style={{
              padding: "var(--sp-4) var(--sp-5)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--sp-3)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div>
              <p style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
                অর্ডার #{recentOrder.id.slice(0, 8)}...
              </p>
              <p style={{ fontSize: "0.8125rem", color: "var(--stone)", marginTop: "var(--sp-1)" }}>
                {new Date(recentOrder.created_at).toLocaleDateString("bn-BD", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
              <span
                className={`badge ${recentOrder.fulfillment_status === "delivered" ? "badge-green" : "badge-terracotta"}`}
              >
                {recentOrder.fulfillment_status === "delivered"
                  ? "ডেলিভারি সম্পন্ন"
                  : recentOrder.fulfillment_status === "shipped"
                    ? "পাঠানো হয়েছে"
                    : "অপেক্ষমান"}
              </span>
              <span style={{ fontWeight: 600 }}>{money(recentOrder.total)}</span>
            </div>
          </Link>
        ) : (
          <div
            className="card"
            style={{
              padding: "var(--sp-8)",
              textAlign: "center",
            }}
          >
            <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
              আপনার কোনো অর্ডার নেই।
            </p>
            <Link href="/books" className="btn btn-primary">
              সকল বই দেখুন
            </Link>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.25rem",
            fontWeight: "var(--font-weight-bold)",
            marginBottom: "var(--sp-4)",
          }}
        >
          দ্রুত লিংক
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-3)" }}>
          <Link
            href="/account/profile"
            className="btn btn-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--sp-2)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            প্রোফাইল
          </Link>
          <Link
            href="/account/wishlist"
            className="btn btn-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--sp-2)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            পছন্দের তালিকা
          </Link>
          <Link
            href="/account/addresses"
            className="btn btn-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--sp-2)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            ঠিকানা
          </Link>
        </div>
      </div>
    </div>
  )
}
