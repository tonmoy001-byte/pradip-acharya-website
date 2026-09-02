// app/api/my-orders/[id]/route.ts
// GET: Fetch single order with items. Only if owned by user.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const user = await requireUser()
    const client = await createServerClient()
    const { id } = await params

    const { data: order, error: orderError } = await client.database
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404, headers: NO_STORE })
    }

    const { data: items, error: itemsError } = await client.database
      .from("order_items")
      .select("*")
      .eq("order_id", id)

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message || "Failed to fetch order items" }, { status: 500, headers: NO_STORE })
    }

    return NextResponse.json({ data: { ...order, items: items || [] } }, { headers: NO_STORE })
  } catch (err: any) {
    if (err instanceof Response) return new Response(err.body, { status: err.status, headers: { ...Object.fromEntries(err.headers), "Cache-Control": "no-store" } })
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500, headers: NO_STORE })
  }
}
