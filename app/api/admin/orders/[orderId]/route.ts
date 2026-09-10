import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    await requireAdmin()
    const { orderId } = await params
    const client = await createServerClient()

    const { data: order, error: orderErr } = await client.database
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: "অর্ডার পাওয়া যায়নি" }, { status: 404 })
    }

    // Fetch profile if user_id exists
    let profile = null
    if (order.user_id) {
      const { data } = await client.database
        .from("profiles")
        .select("display_name")
        .eq("user_id", order.user_id)
        .single()
      profile = data
    }

    return NextResponse.json({ order: { ...order, profile } })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
