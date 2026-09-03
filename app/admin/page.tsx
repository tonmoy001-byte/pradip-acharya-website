// app/admin/page.tsx
// Root admin page — redirects to orders.

import { redirect } from "next/navigation"

export default function AdminPage() {
  redirect("/admin/orders")
}
