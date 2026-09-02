// app/api/admin/orders/[orderId]/reject/route.ts
// POST: Admin rejects payment for an order.

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

type RouteParams = { params: Promise<{ orderId: string }> }

export async function POST(req: Request, { params }: RouteParams) {
  try {
    await requireAdmin()

    const client = await createServerClient()
    const { orderId } = await params
    const body = await req.json()
    const { reason } = body

    const { data, error } = await client.database.rpc("reject_order_payment", {
      p_order_id: orderId,
      p_reason: reason || null,
    })

    if (error) {
      return NextResponse.json({ error: error.message || "Rejection failed" }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
