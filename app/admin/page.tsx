// app/admin/page.tsx
// Root admin page — redirects to dashboard.

import { redirect } from "next/navigation"

export default function AdminPage() {
  redirect("/admin/dashboard")
}
