import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export async function GET(req: Request) {
  try {
    await requireAdmin()
    const client = await createServerClient()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""

    // Get admin user IDs to exclude from customer list
    const { data: adminRows } = await client.database
      .from("admin_memberships")
      .select("user_id")
    const adminIds = new Set((adminRows || []).map((r: any) => r.user_id))

    // Get all customer profiles
    const { data: profiles } = await client.database
      .from("customer_profiles")
      .select("user_id, display_name, email, created_at")

    const profileMap = new Map<string, any>()
    for (const p of profiles || []) {
      if (!adminIds.has(p.user_id)) {
        profileMap.set(p.user_id, p)
      }
    }

    // Get all orders with user_id and contact info
    const { data: orders } = await client.database
      .from("orders")
      .select("user_id, contact, total, payment_status, created_at")
      .order("created_at", { ascending: false })

    // Build customer list from orders, excluding admins
    const customerMap = new Map<string, {
      user_id: string
      display_name: string
      email: string
      created_at: string
      orderCount: number
      totalSpent: number
    }>()

    for (const o of orders || []) {
      const uid = o.user_id
      if (!uid || adminIds.has(uid)) continue

      if (!customerMap.has(uid)) {
        const profile = profileMap.get(uid)
        const contact = (o.contact || {}) as { name?: string; email?: string }
        customerMap.set(uid, {
          user_id: uid,
          display_name: profile?.display_name || contact.name || "—",
          email: profile?.email || contact.email || "—",
          created_at: profile?.created_at || o.created_at,
          orderCount: 0,
          totalSpent: 0,
        })
      }

      const c = customerMap.get(uid)!
      c.orderCount++
      if (o.payment_status === "paid") {
        c.totalSpent += Number(o.total)
      }
    }

    // Also add profiles that have no orders yet
    for (const [uid, profile] of profileMap) {
      if (!customerMap.has(uid)) {
        customerMap.set(uid, {
          user_id: uid,
          display_name: profile.display_name || "—",
          email: profile.email || "—",
          created_at: profile.created_at,
          orderCount: 0,
          totalSpent: 0,
        })
      }
    }

    let filtered = Array.from(customerMap.values())

    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          (c.display_name && c.display_name.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          c.user_id.includes(q)
      )
    }

    return NextResponse.json({ customers: filtered })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
