import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {  try {
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

    // Download grants issued for this order's ebook lines (admin approval state)
    const { data: grants } = await client.database
      .from("download_grants")
      .select("id, order_item_id, max_downloads, download_count, expires_at, revoked_at")
      .eq("order_id", orderId)

    return NextResponse.json({ order: { ...order, profile, download_grants: grants || [] } })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}

// Digital-only store: orders are immutable from the admin API. Payment status
// changes only through the approve/reject RPCs (which also record payment
// history and issue ebook download grants), and there is no shipping
// fulfilment state to set.
