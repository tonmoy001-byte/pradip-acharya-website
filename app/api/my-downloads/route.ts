// app/api/my-downloads/route.ts
// GET: List the current user's ebook download grants.
//
// Only grants the caller owns AND whose backing order is paid are returned, so
// the list can never advertise a download the server would refuse to serve.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const client = await createServerClient()

    const { data, error } = await client.database
      .from("download_grants")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE })
    }

    const grants = data || []
    if (grants.length === 0) {
      return NextResponse.json({ data: [] }, { headers: NO_STORE })
    }

    // Resolve the owning, paid orders for these grants and attach the book title.
    const orderItemIds = [...new Set(grants.map((g: any) => g.order_item_id).filter(Boolean))]

    const { data: orderItems } = await client.database
      .from("order_items")
      .select("id, order_id, title_snapshot, format_snapshot, delivery_type_snapshot")
      .in("id", orderItemIds)

    const items = orderItems || []
    const itemById = new Map(items.map((i: any) => [i.id, i]))
    const orderIds = [...new Set(items.map((i: any) => i.order_id).filter(Boolean))]

    const { data: orders } = await client.database
      .from("orders")
      .select("id, payment_status")
      .eq("user_id", user.id)
      .in("id", orderIds)

    const paidOrderIds = new Set(
      (orders || []).filter((o: any) => o.payment_status === "paid").map((o: any) => o.id),
    )

    const enriched = grants
      .map((g: any) => {
        const item = itemById.get(g.order_item_id) as any
        return {
          ...g,
          book_title: item?.title_snapshot ?? null,
          format_snapshot: item?.format_snapshot ?? null,
        }
      })
      .filter((g: any) => {
        const item = itemById.get(g.order_item_id) as any
        return item && paidOrderIds.has(item.order_id)
      })

    return NextResponse.json({ data: enriched }, { headers: NO_STORE })
  } catch (err: any) {
    if (err instanceof Response) {
      return new Response(err.body, {
        status: err.status,
        headers: { ...Object.fromEntries(err.headers), ...NO_STORE },
      })
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500, headers: NO_STORE })
  }
}
