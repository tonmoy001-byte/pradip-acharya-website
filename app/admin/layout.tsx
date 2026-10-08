// app/admin/layout.tsx
// Admin panel layout — dark sidebar with full navigation.
//
// Auth failures (P1):
//   401 → redirect to /login
//   403 → forbidden state (session kept; not logged out)
//   500 → system error state (never shown as logged out)

import { redirect } from "next/navigation"
import Link from "next/link"
import { requireAdmin, type AuthUser } from "@/lib/auth-helpers"
import AdminGuard from "@/components/admin/AdminGuard"
import AdminAccessMessage from "@/components/admin/AdminAccessMessage"

export const metadata = {
  title: "অ্যাডমিন — প্রদীপ কুমার আচার্য্য",
  // Admin screens must never appear in search results.
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let user: AuthUser | null = null
  try {
    user = await requireAdmin()
  } catch (err) {
    if (err instanceof Response) {
      if (err.status === 401) {
        redirect("/login")
      }
      if (err.status === 403) {
        return <AdminAccessMessage kind="forbidden" />
      }
      return <AdminAccessMessage kind="system" />
    }
    // Unexpected non-Response failure → system error, not logged out
    return <AdminAccessMessage kind="system" />
  }
  if (!user) redirect("/login")

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <span className="admin-sidebar-logo">P</span>
          <span className="admin-sidebar-title">অ্যাডমিন</span>
        </div>
        <nav className="admin-sidebar-nav">
          <Link href="/admin/dashboard" className="admin-sidebar-link">
            ড্যাশবোর্ড
          </Link>
          <Link href="/admin/books" className="admin-sidebar-link">
            বই ম্যানেজমেন্ট
          </Link>
          <Link href="/admin/posts" className="admin-sidebar-link">
            পোস্ট ম্যানেজমেন্ট
          </Link>
          <Link href="/admin/orders" className="admin-sidebar-link">
            অর্ডার
          </Link>
          <Link href="/admin/customers" className="admin-sidebar-link">
            গ্রাহক
          </Link>
          <Link href="/admin/settings" className="admin-sidebar-link">
            সেটিংস
          </Link>
        </nav>
        <div className="admin-sidebar-footer">
          <Link href="/" className="admin-sidebar-link" target="_blank">
            সাইট দেখুন ↗
          </Link>
        </div>
      </aside>
      <main className="admin-main">
        <AdminGuard>{children}</AdminGuard>
      </main>
    </div>
  )
}
