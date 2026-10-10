// app/api/my-orders/route.ts
// GET: List the current user's orders with order_items (book titles, thumbnails).

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { serverError } from "@/lib/http-errors"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const client = await createServerClient()

    const { data: orders, error: ordersError } = await client.database
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (ordersError) {
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500, headers: NO_STORE })
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ data: [] }, { headers: NO_STORE })
    }

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const { data: items } = await client.database
          .from("order_items")
          .select("*, books(title, cover_primary)")
          .eq("order_id", order.id)

        return { ...order, items: items || [] }
      }),
    )

    return NextResponse.json({ data: ordersWithItems }, { headers: NO_STORE })
  } catch (err: unknown) {
    if (err instanceof Response) return new Response(err.body, { status: err.status, headers: { ...Object.fromEntries(err.headers), "Cache-Control": "no-store" } })
    return serverError("my-orders", err, { headers: NO_STORE })
  }
}
