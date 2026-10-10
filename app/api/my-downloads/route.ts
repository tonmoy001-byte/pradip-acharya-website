// app/api/my-downloads/route.ts
// GET: List the current user's ebook download grants.
// Self-heals paid orders missing grants before listing.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const client = await createServerClient()

    // Self-heal: find paid orders for this user that are missing download grants.
    const { data: paidOrders, error: ordersError } = await client.database
      .from("orders")
      .select("id, payment_reference")
      .eq("user_id", user.id)
      .eq("payment_status", "paid")
      .order("created_at", { ascending: false })
      .limit(20)

    if (!ordersError && paidOrders && paidOrders.length > 0) {
      // Get digital order items for these orders
      const orderIds = paidOrders.map((o: any) => o.id)
      const { data: digitalItems, error: itemsError } = await client.database
        .from("order_items")
        .select("id, order_id")
        .eq("delivery_type_snapshot", "digital")
        .in("order_id", orderIds)

      if (!itemsError && digitalItems && digitalItems.length > 0) {
        const orderItemIds = digitalItems.map((i: any) => i.id)

        // Find which items already have grants for this user
        const { data: existingGrants, error: grantsError } = await client.database
          .from("download_grants")
          .select("order_item_id")
          .eq("user_id", user.id)
          .in("order_item_id", orderItemIds)

        if (!grantsError && existingGrants) {
          const grantedItemIds = new Set(existingGrants.map((g: any) => g.order_item_id))
          const missingGrants = digitalItems.filter((i: any) => !grantedItemIds.has(i.id))

          // Group by order_id for fulfill_paid_order calls
          const missingByOrder = new Map<string, string[]>()
          for (const item of missingGrants) {
            const arr = missingByOrder.get(item.order_id) || []
            arr.push(item.id)
            missingByOrder.set(item.order_id, arr)
          }

          const serviceClient = await createServerClient()
          for (const [orderId, itemIds] of missingByOrder.entries()) {
            const order = paidOrders.find((o: any) => o.id === orderId)
            const paymentRef = order?.payment_reference ?? ""
            try {
              await serviceClient.database.rpc("fulfill_paid_order", {
                p_order_id: orderId,
                p_payment_reference: paymentRef,
              })
            } catch (fulfillErr) {
              console.error("[downloads] self-heal failed", { order_id: orderId })
            }
          }
        }
      }
    }

    // List grants as before
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