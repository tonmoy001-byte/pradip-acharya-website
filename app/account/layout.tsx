"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth"
import SeoNoindex from "@/components/SeoNoindex"

const menuItems = [
  {
    label: "ড্যাশবোর্ড",
    href: "/account",
    exact: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    label: "প্রোফাইল",
    href: "/account/profile",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    label: "আমার অর্ডার",
    href: "/account/orders",
    countKey: "orders" as const,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    label: "আমার ইবুক",
    href: "/my-downloads",
    countKey: "downloads" as const,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    label: "পছন্দের তালিকা",
    href: "/account/wishlist",
    countKey: "wishlist" as const,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    label: "পাসওয়ার্ড পরিবর্তন",
    href: "/account/change-password",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
]

type CountKey = "orders" | "downloads" | "wishlist"

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [counts, setCounts] = useState<Record<CountKey, number>>({
    orders: 0,
    downloads: 0,
    wishlist: 0,
  })

  useEffect(() => {
    if (loading || !user) return

    async function fetchCounts() {
      const endpoints: [CountKey, string][] = [
        ["orders", "/api/my-orders"],
        ["downloads", "/api/my-downloads"],
        ["wishlist", "/api/wishlist"],
      ]

      const results = await Promise.allSettled(
        endpoints.map(async ([key, url]) => {
          const res = await fetch(url)
          if (!res.ok) return [key, 0] as const
          const json = await res.json()
          return [key, Array.isArray(json.data) ? json.data.length : 0] as const
        })
      )

      const newCounts: Record<CountKey, number> = { orders: 0, downloads: 0, wishlist: 0 }
      for (const r of results) {
        if (r.status === "fulfilled") {
          const [key, count] = r.value
          newCounts[key] = count
        }
      }
      setCounts(newCounts)
    }

    fetchCounts()
  }, [user, loading])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + "/")
  }

  function handleLogout() {
    signOut()
    router.push("/")
  }

  if (loading) {
    return (
      <div className="container section-padding">
        <div className="account-layout">
          <div className="account-sidebar">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 44, borderRadius: "var(--radius-md)" }} />
            ))}
          </div>
          <div className="account-content">
            <div className="skeleton" style={{ height: 320, borderRadius: "var(--radius-lg)" }} />
          </div>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <>
      <SeoNoindex />
      <div className="container section-padding">
      <div className="account-layout">
        <aside className="account-sidebar">
          {menuItems.map((item) => {
            const active = isActive(item.href, item.exact)
            const count = item.countKey ? counts[item.countKey] : 0
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`account-sidebar-link${active ? " active" : ""}`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.countKey && count > 0 && (
                  <span className="account-sidebar-badge">{count}</span>
                )}
              </Link>
            )
          })}

          <div className="account-sidebar-divider" />

          <button
            onClick={handleLogout}
            className="account-sidebar-link"
            style={{
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "start",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>লগ আউট</span>
          </button>
        </aside>

        <main className="account-content">{children}</main>
      </div>
    </div>
    </>
  )
}
