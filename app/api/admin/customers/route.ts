import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export async function GET(req: Request) {
  try {
    await requireAdmin()
    const client = await createServerClient()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""

    const { data: profiles, error: profErr } = await client.database
      .from("customer_profiles")
      .select("user_id, display_name, email, created_at")

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 })
    }

    const customers = profiles || []

    const customersWithOrders = await Promise.all(
      customers.map(async (c: any) => {
        const { data: orders } = await client.database
          .from("orders")
          .select("id, total, payment_status, created_at")
          .eq("user_id", c.user_id)

        const orderCount = orders?.length || 0
        const totalSpent = (orders || [])
          .filter((o: any) => o.payment_status === "paid")
          .reduce((sum: number, o: any) => sum + Number(o.total), 0)

        return {
          user_id: c.user_id,
          display_name: c.display_name || "—",
          email: c.email || "—",
          created_at: c.created_at,
          orderCount,
          totalSpent,
        }
      })
    )

    let filtered = customersWithOrders
    if (search) {
      const q = search.toLowerCase()
      filtered = customersWithOrders.filter(
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
