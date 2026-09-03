// app/admin/layout.tsx
// Admin panel layout — dark sidebar with Orders nav link.

import Link from "next/link"

export const metadata = {
  title: "অ্যাডমিন — প্রদীপ কুমার আচার্য্য",
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <span className="admin-sidebar-logo">P</span>
          <span className="admin-sidebar-title">অ্যাডমিন</span>
        </div>
        <nav className="admin-sidebar-nav">
          <Link href="/admin/orders" className="admin-sidebar-link">
            অর্ডার
          </Link>
        </nav>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  )
}
