// app/api/orders/route.ts
// POST: Create an order from cart items.
// Uses requireUser() with JWT fallback for auth (same as my-orders routes).

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

interface CartItem {
  book_id: string
  format_name: string
  quantity: number
}

interface OrderContact {
  name: string
  email: string
  phone: string
}

interface FormatRow {
  id: string
  available: boolean
  price: number
  delivery_type: string
  format_name: string
}

interface BookRow {
  title: string
  author: string
}

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const client = await createServerClient()

    const body = await req.json()
    const { cartItems, contact, shippingAddress, paymentMethod } = body as {
      cartItems: CartItem[]
      contact: OrderContact
      shippingAddress?: { address: string; city: string; postal_code: string }
      paymentMethod?: string
    }

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400, headers: NO_STORE })
    }

    if (!contact?.name || !contact?.email || !contact?.phone) {
      return NextResponse.json({ error: "Contact information required" }, { status: 400, headers: NO_STORE })
    }

    // Look up format + book for every cart item
    const resolvedItems: Array<{
      cart: CartItem
      format: FormatRow
      book: BookRow
      unitPrice: number
      lineTotal: number
    }> = []

    let hasPhysical = false

    for (const cart of cartItems) {
      // R6: Validate quantity bounds
      if (!cart.quantity || cart.quantity < 1 || cart.quantity > 100 || !Number.isInteger(cart.quantity)) {
        return NextResponse.json(
          { error: `Invalid quantity for ${cart.format_name}: must be 1-100` },
          { status: 400, headers: NO_STORE },
        )
      }

      const fmtResult = await client.database
        .from("book_formats")
        .select("id, available, price, delivery_type, format_name")
        .eq("book_id", cart.book_id)
        .eq("format_name", cart.format_name)
        .single()

      if (fmtResult.error || !fmtResult.data) {
        return NextResponse.json(
          { error: `Format not found: ${cart.book_id} (${cart.format_name})` },
          { status: 400, headers: NO_STORE },
        )
      }

      const format = fmtResult.data as FormatRow
      if (!format.available) {
        return NextResponse.json(
          { error: `Format currently unavailable: ${cart.format_name}` },
          { status: 400, headers: NO_STORE },
        )
      }

      const bookResult = await client.database
        .from("books")
        .select("title, author")
        .eq("id", cart.book_id)
        .single()

      if (bookResult.error || !bookResult.data) {
        return NextResponse.json(
          { error: `Book not found: ${cart.book_id}` },
          { status: 400, headers: NO_STORE },
        )
      }

      const book = bookResult.data as BookRow
      const unitPrice = Number(format.price)
      const lineTotal = unitPrice * cart.quantity
      if (format.delivery_type === "physical") hasPhysical = true

      resolvedItems.push({ cart, format, book, unitPrice, lineTotal })
    }

    // Aggregate totals across all items
    const subtotal = resolvedItems.reduce((sum, i) => sum + i.lineTotal, 0)

    // Read delivery settings from site_settings (fallback to defaults)
    let deliveryChargeAmount = 60
    let freeThreshold = 750
    try {
      const { data: dcSetting } = await client.database
        .from("site_settings")
        .select("value")
        .eq("key", "delivery_charge")
        .single()
      if (dcSetting?.value != null) deliveryChargeAmount = Number(dcSetting.value)
    } catch {}
    try {
      const { data: fdSetting } = await client.database
        .from("site_settings")
        .select("value")
        .eq("key", "free_delivery_threshold")
        .single()
      if (fdSetting?.value != null) freeThreshold = Number(fdSetting.value)
    } catch {}

    const deliveryCharge = hasPhysical && subtotal >= freeThreshold ? 0 : hasPhysical ? deliveryChargeAmount : 0
    const total = subtotal + deliveryCharge

    const orderResult = await client.database
      .from("orders")
      .insert({
        user_id: user.id,
        contact,
        shipping_address: shippingAddress || null,
        currency: "BDT",
        payment_method: paymentMethod || "cod",
        payment_status: "pending_payment",
        subtotal,
        delivery_charge: deliveryCharge,
        total,
        fulfillment_status: hasPhysical ? "pending" : "not_applicable",
      })
      .select("id")
      .single()

    if (orderResult.error || !orderResult.data) {
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500, headers: NO_STORE },
      )
    }

    const orderId = (orderResult.data as { id: string }).id

    // Insert all order items
    const orderItems = resolvedItems.map((i) => ({
      order_id: orderId,
      book_id: i.cart.book_id,
      format_id: i.format.id,
      title_snapshot: i.book.title,
      author_snapshot: i.book.author,
      format_snapshot: i.format.format_name,
      delivery_type_snapshot: i.format.delivery_type,
      quantity: i.cart.quantity,
      unit_price_snapshot: i.unitPrice,
      line_total: i.lineTotal,
    }))

    const { error: itemsError } = await client.database
      .from("order_items")
      .insert(orderItems)

    if (itemsError) {
      return NextResponse.json(
        { error: "Failed to create order items" },
        { status: 500, headers: NO_STORE },
      )
    }

    return NextResponse.json({
      data: {
        order_id: orderId,
        subtotal,
        delivery_charge: deliveryCharge,
        total,
        item_count: resolvedItems.length,
        has_physical: hasPhysical,
      },
    }, { headers: NO_STORE })
  } catch (err: unknown) {
    if (err instanceof Response) {
      return new Response(err.body, {
        status: err.status,
        headers: { ...Object.fromEntries(err.headers), ...NO_STORE },
      })
    }
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE })
  }
}
