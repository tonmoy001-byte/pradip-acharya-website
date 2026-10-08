// app/api/admin/stats/route.ts
// GET: Admin dashboard stats — total orders, pending verification, revenue,
// and paid ebook orders still awaiting download approval.
// There is no shipping/delivery metric: the store is digital-only.

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { EBOOK_DELIVERY_TYPE } from "@/lib/data"

export async function GET() {
  try {
    await requireAdmin()
    const client = await createServerClient()

    const { data: allOrders, error: allErr } = await client.database
      .from("orders")
      .select("id, payment_status, total")

    if (allErr) {
      return NextResponse.json({ error: allErr.message }, { status: 500 })
    }

    const orders = allOrders || []
    const totalOrders = orders.length
    const pendingVerification = orders.filter(
      (o: any) => o.payment_status === "pending_verification"
    ).length
    const totalRevenue = orders
      .filter((o: any) => o.payment_status === "paid")
      .reduce((sum, o: any) => sum + Number(o.total), 0)

    // Paid ebook order lines that have not been granted a download yet.
    const paidOrderIds = new Set(
      orders.filter((o: any) => o.payment_status === "paid").map((o: any) => o.id),
    )

    let pendingDownloads = 0
    if (paidOrderIds.size > 0) {
      const { data: digitalItems } = await client.database
        .from("order_items")
        .select("id, order_id")
        .eq("delivery_type_snapshot", EBOOK_DELIVERY_TYPE)
        .in("order_id", [...paidOrderIds])

      const digitalItemIds = (digitalItems || []).map((i: any) => i.id)
      if (digitalItemIds.length > 0) {
        const { data: grants } = await client.database
          .from("download_grants")
          .select("order_item_id")
          .in("order_item_id", digitalItemIds)

        const granted = new Set((grants || []).map((g: any) => g.order_item_id))
        pendingDownloads = digitalItemIds.filter((id) => !granted.has(id)).length
      }
    }

    return NextResponse.json({
      totalOrders,
      pendingVerification,
      totalRevenue,
      pendingDownloads,
    })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
