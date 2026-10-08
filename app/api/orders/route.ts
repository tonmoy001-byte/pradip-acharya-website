// app/api/orders/route.ts
// POST: Create an ebook order from cart items.
// Uses requireUser() verified InsForge session for auth.
//
// EBOOK-ONLY ENFORCEMENT
// The client never selects a format. For every requested book the server
// resolves the book's own `delivery_type = 'digital'` format row and prices the
// line from that row. A book with no digital format — or a request that names
// a physical/paperbook format or a non-rupantor payment method — is rejected.
// There is therefore no client-controllable path to buy a paperbook.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { EBOOK_DELIVERY_TYPE } from "@/lib/data"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

const MAX_QUANTITY = 100

// Same house regex as lib/contact-form.ts, kept deliberately identical so the
// two public contact surfaces accept the same addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const NAME_MIN = 2
const NAME_MAX = 120
const PHONE_MIN = 6
const PHONE_MAX = 32

interface CartItem {
  book_id: string
  quantity: number
}

interface OrderContact {
  name: string
  email: string
  phone: string
}

/**
 * Authoritative server-side validation of the buyer contact block.
 *
 * The client is untrusted, so this must not rely on JavaScript truthiness:
 * `!contact.name` is false for `"   "`, `{}` and `[]`, all of which are truthy
 * and would otherwise be persisted into `orders.contact` as unusable customer
 * data. Every field is therefore type-checked before use.
 *
 * Returns only the three known keys, trimmed, so no extra client-supplied
 * properties are written to the database.
 */
function parseContact(value: unknown): OrderContact | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null

  const source = value as Record<string, unknown>
  const name = typeof source.name === "string" ? source.name.trim() : ""
  const email = typeof source.email === "string" ? source.email.trim() : ""
  const phone = typeof source.phone === "string" ? source.phone.trim() : ""

  // Length checks also reject whitespace-only values, which trim to "".
  if (name.length < NAME_MIN || name.length > NAME_MAX) return null
  if (phone.length < PHONE_MIN || phone.length > PHONE_MAX) return null
  if (!EMAIL_RE.test(email)) return null

  return { name, email, phone }
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
    const { cartItems, contact: rawContact } = body as {
      cartItems: CartItem[]
      contact: OrderContact
    }

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400, headers: NO_STORE })
    }

    const contact = parseContact(rawContact)
    if (!contact) {
      return NextResponse.json({ error: "Contact information required" }, { status: 400, headers: NO_STORE })
    }

    // Ebook-only store: cash on delivery does not exist.
    const paymentMethod = "rupantor"

    const resolvedItems: Array<{
      cart: CartItem
      format: FormatRow
      book: BookRow
      unitPrice: number
      lineTotal: number
    }> = []

    for (const cart of cartItems) {
      if (!cart || typeof cart.book_id !== "string" || cart.book_id.length === 0) {
        return NextResponse.json(
          { error: "Invalid cart item" },
          { status: 400, headers: NO_STORE },
        )
      }

      // R6: Validate quantity bounds
      if (!cart.quantity || cart.quantity < 1 || cart.quantity > MAX_QUANTITY || !Number.isInteger(cart.quantity)) {
        return NextResponse.json(
          { error: `Invalid quantity for ${cart.book_id}: must be 1-${MAX_QUANTITY}` },
          { status: 400, headers: NO_STORE },
        )
      }

      const bookResult = await client.database
        .from("books")
        .select("id, title, author")
        .eq("id", cart.book_id)
        .single()

      if (bookResult.error || !bookResult.data) {
        return NextResponse.json(
          { error: `Book not found: ${cart.book_id}` },
          { status: 400, headers: NO_STORE },
        )
      }

      const book = bookResult.data as BookRow

      // Resolve the digital (ebook) format server-side. Physical rows that may
      // still exist in the database are never selected.
      const fmtResult = await client.database
        .from("book_formats")
        .select("id, available, price, delivery_type, format_name")
        .eq("book_id", cart.book_id)
        .eq("delivery_type", EBOOK_DELIVERY_TYPE)
        .limit(1)

      if (fmtResult.error || !fmtResult.data || fmtResult.data.length === 0) {
        return NextResponse.json(
          { error: `Ebook not available for this title: ${book.title}` },
          { status: 400, headers: NO_STORE },
        )
      }

      const format = fmtResult.data[0] as FormatRow

      if (format.delivery_type !== EBOOK_DELIVERY_TYPE) {
        return NextResponse.json(
          { error: "Only digital ebooks can be purchased" },
          { status: 400, headers: NO_STORE },
        )
      }

      if (!format.available) {
        return NextResponse.json(
          { error: `Ebook currently unavailable: ${book.title}` },
          { status: 400, headers: NO_STORE },
        )
      }

      const unitPrice = Number(format.price)
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return NextResponse.json(
          { error: `Invalid ebook price for: ${book.title}` },
          { status: 400, headers: NO_STORE },
        )
      }

      resolvedItems.push({ cart, format, book, unitPrice, lineTotal: unitPrice * cart.quantity })
    }

    // Digital goods: no delivery charge, ever.
    const subtotal = resolvedItems.reduce((sum, i) => sum + i.lineTotal, 0)
    const deliveryCharge = 0
    const total = subtotal

    const orderResult = await client.database
      .from("orders")
      .insert({
        user_id: user.id,
        contact,
        shipping_address: null,
        currency: "BDT",
        payment_method: paymentMethod,
        payment_status: "pending_payment",
        subtotal,
        delivery_charge: deliveryCharge,
        total,
        fulfillment_status: "not_applicable",
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
      delivery_type_snapshot: EBOOK_DELIVERY_TYPE,
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
        digital_only: true,
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
