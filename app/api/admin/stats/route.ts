// app/api/admin/stats/route.ts
// GET: Admin dashboard stats — total orders, pending, revenue, pending deliveries.

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export async function GET() {
  try {
    await requireAdmin()
    const client = await createServerClient()

    const { data: allOrders, error: allErr } = await client.database
      .from("orders")
      .select("id, payment_status, fulfillment_status, total")

    if (allErr) {
      return NextResponse.json({ error: allErr.message }, { status: 500 })
    }

    const orders = allOrders || []
    const totalOrders = orders.length
    const pendingVerification = orders.filter(
      (o) => o.payment_status === "pending_verification"
    ).length
    const totalRevenue = orders
      .filter((o) => o.payment_status === "paid")
      .reduce((sum, o) => sum + Number(o.total), 0)
    const pendingDeliveries = orders.filter(
      (o) => o.payment_status === "paid" && o.fulfillment_status !== "delivered"
    ).length

    return NextResponse.json({
      totalOrders,
      pendingVerification,
      totalRevenue,
      pendingDeliveries,
    })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
