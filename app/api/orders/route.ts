// app/api/orders/route.ts
// POST: Create a new order from cart items.
// Looks up format_ids from database, then calls create_order_from_cart RPC.

import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/insforge-server"

export async function POST(req: Request) {
  try {
    const client = await createServerClient()
    const { data: userData, error: authError } = await client.auth.getCurrentUser()

    if (authError || !userData?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const body = await req.json()
    const { cartItems, contact, shippingAddress, paymentMethod, bkashTrxId } = body

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 })
    }

    if (!contact?.name || !contact?.email || !contact?.phone) {
      return NextResponse.json({ error: "Contact information required" }, { status: 400 })
    }

    // Look up format_ids from database
    const resolvedItems = []
    for (const item of cartItems) {
      const { data: format, error: fmtError } = await client.database
        .from("book_formats")
        .select("id, available")
        .eq("book_id", item.book_id)
        .eq("format_name", item.format_name)
        .single()

      if (fmtError || !format) {
        return NextResponse.json(
          { error: `Format not found: ${item.book_id} / ${item.format_name}` },
          { status: 400 },
        )
      }

      if (!format.available) {
        return NextResponse.json(
          { error: `Format unavailable: ${item.format_name}` },
          { status: 400 },
        )
      }

      resolvedItems.push({
        book_id: item.book_id,
        format_id: format.id,
        quantity: item.quantity,
      })
    }

    // Call the server-owned RPC
    const { data, error } = await client.database.rpc("create_order_from_cart", {
      p_cart_items: JSON.stringify(resolvedItems),
      p_contact: JSON.stringify(contact),
      p_shipping_address: shippingAddress ? JSON.stringify(shippingAddress) : null,
    })

    if (error) {
      return NextResponse.json({ error: error.message || "Order creation failed" }, { status: 500 })
    }

    // Update order with payment method and bKash TrxID if provided
    const orderId = data?.order_id || data?.id
    if (orderId && paymentMethod) {
      const updateData: Record<string, any> = {
        payment_method: paymentMethod,
      }
      if (paymentMethod === "bkash" && bkashTrxId) {
        updateData.bkash_trx_id = bkashTrxId
        updateData.payment_status = "pending_verification"
      }
      await client.database
        .from("orders")
        .update(updateData)
        .eq("id", orderId)
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
