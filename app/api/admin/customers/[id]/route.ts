import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const client = await createServerClient()

    // Try to get profile; if missing, derive from most recent order
    const { data: profile } = await client.database
      .from("customer_profiles")
      .select("*")
      .eq("user_id", id)
      .single()

    const { data: orders } = await client.database
      .from("orders")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })

    if (!profile && (!orders || orders.length === 0)) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    // Build a customer object from profile or from latest order contact
    const latestOrder = orders?.[0]
    const contact = (latestOrder?.contact || {}) as { name?: string; email?: string; phone?: string }

    const customer = profile || {
      user_id: id,
      display_name: contact.name || "—",
      email: contact.email || "—",
      phone: contact.phone || "—",
      created_at: latestOrder?.created_at || new Date().toISOString(),
    }

    return NextResponse.json({
      customer,
      orders: orders || [],
    })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
