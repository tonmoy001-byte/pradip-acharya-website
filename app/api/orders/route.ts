// app/api/orders/route.ts
// POST: Create an ebook order from cart items.
// Signed-in buyers use the authenticated create_ebook_order() RPC.
// Anonymous buyers (guest checkout) use create_guest_ebook_order() with a
// server-minted checkout token stored in an httpOnly `go_<orderId>` cookie.
//
// Order creation happens inside the create_ebook_order() database
// function (db/migrations/018): one atomic transaction that prices
// every line from book_formats (server-owned), merges duplicate cart
// lines, blocks buying a book the customer can still download, and
// settles free (0-price) carts immediately. This route only validates
// the shape of the request and maps the function's error messages
// to HTTP responses.
//
// EBOOK-ONLY ENFORCEMENT
// The client never selects a format and cannot influence the price:
// the function resolves each book's own delivery_type = 'digital'
// format row. There is no client-controllable path to buy a
// paperbook or to pay less than the listed price.

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getOptionalUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { createServiceClient } from "@/lib/insforge-service"
import { assertSameOrigin } from "@/lib/origin-check"
import { revalidatePath } from "next/cache"
import { serverError } from "@/lib/http-errors"
import { newToken, sha256hex } from "@/lib/guest-token"
import { clientIp, isGuestOrderRateLimited } from "@/lib/guest-rate-limit"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

const MAX_CART_ITEMS = 50

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
  const email = typeof source.email === "string" ? source.email.trim().toLowerCase() : ""
  const phone = typeof source.phone === "string" ? source.phone.trim() : ""

  // Length checks also reject whitespace-only values, which trim to "".
  if (name.length < NAME_MIN || name.length > NAME_MAX) return null
  if (phone.length < PHONE_MIN || phone.length > PHONE_MAX) return null
  if (!EMAIL_RE.test(email)) return null

  return { name, email, phone }
}

/** Maps create_ebook_order() / create_guest_ebook_order() errors to HTTP responses. */
function mapOrderError(message: string): { status: number; error: string; order_id?: string } {
  if (message.startsWith("cart_empty")) return { status: 400, error: "Cart is empty" }
  if (message.startsWith("cart_too_large")) return { status: 400, error: "Too many items" }
  if (message.startsWith("book_not_found")) return { status: 400, error: "A book in your cart no longer exists" }
  if (message.startsWith("ebook_unavailable")) return { status: 400, error: "A book in your cart is unavailable" }
  if (message.startsWith("invalid_price")) return { status: 400, error: "A book in your cart has an invalid price" }
  if (message.startsWith("free_not_allowed")) {
    return { status: 400, error: "This order cannot be completed as a guest" }
  }
  if (message.startsWith("invalid_guest_token")) {
    return { status: 400, error: "Checkout session expired. Please try again." }
  }
  if (message.startsWith("already_owned")) {
    return { status: 409, error: "You already own this ebook and can still download it" }
  }
  if (message.startsWith("active_order_exists")) {
    const existing = message.split(":")[1]
    return { status: 409, error: "active_order_exists", order_id: existing }
  }
  return { status: 500, error: "Failed to create order" }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req)

    const user = await getOptionalUser()

    const body = await req.json()
    const cartItems = (body as { cartItems?: unknown })?.cartItems
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400, headers: NO_STORE })
    }
    if (cartItems.length > MAX_CART_ITEMS) {
      return NextResponse.json({ error: "Too many items" }, { status: 400, headers: NO_STORE })
    }

    const bookIds: string[] = []
    for (const item of cartItems) {
      const id = (item as { book_id?: unknown })?.book_id
      if (typeof id !== "string" || id.length === 0 || id.length > 128) {
        return NextResponse.json({ error: "Invalid cart item" }, { status: 400, headers: NO_STORE })
      }
      bookIds.push(id)
    }

    const contact = parseContact((body as { contact?: unknown }).contact)
    if (!contact) {
      return NextResponse.json({ error: "Contact information required" }, { status: 400, headers: NO_STORE })
    }

    // ---- Signed-in buyer: unchanged behaviour (authenticated RPC + RLS) ----
    if (user) {
      const client = await createServerClient()
      const { data, error } = await client.database.rpc("create_ebook_order", {
        p_items: bookIds,
        p_contact: contact,
      })

      if (error) {
        console.error("[orders] create failed:", error.message)
        const mapped = mapOrderError(error.message ?? "")
        const errorBody: Record<string, unknown> = { error: mapped.error }
        if (mapped.order_id) errorBody.order_id = mapped.order_id
        return NextResponse.json(errorBody, { status: mapped.status, headers: NO_STORE })
      }

      try { revalidatePath("/account/orders") } catch {}
      try { revalidatePath("/account") } catch {}
      return NextResponse.json({ data }, { headers: NO_STORE })
    }

    // ---- Guest buyer ----
    // Fail closed: if the limiter cannot record/check the attempt, refuse.
    let limited = true
    try {
      limited = await isGuestOrderRateLimited({ ip: clientIp(req), email: contact.email })
    } catch (err) {
      console.error("[orders] guest rate limit failed", err)
      limited = true
    }
    if (limited) {
      return NextResponse.json(
        { error: "Too many checkout attempts. Please try again later." },
        { status: 429, headers: NO_STORE },
      )
    }

    // The raw token goes to the browser in an httpOnly cookie; only its hash
    // is stored. The server-side project_admin client performs the write.
    const guestToken = newToken()
    const guestTokenHash = sha256hex(guestToken)

    const service = createServiceClient()
    const { data, error } = await service.database.rpc("create_guest_ebook_order", {
      p_items: bookIds,
      p_contact: contact,
      p_guest_token_hash: guestTokenHash,
    })

    if (error) {
      console.error("[orders] guest create failed:", error.message)
      const mapped = mapOrderError(error.message ?? "")
      // Never expose an existing order id to an anonymous caller.
      return NextResponse.json({ error: mapped.error }, { status: mapped.status, headers: NO_STORE })
    }

    const result = Array.isArray(data) ? data[0] : data
    const orderId = (result as { order_id?: string })?.order_id
    if (!orderId) {
      return NextResponse.json({ error: "Failed to create order" }, { status: 500, headers: NO_STORE })
    }

    const cookieStore = await cookies()
    cookieStore.set(`go_${orderId}`, guestToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    })

    return NextResponse.json({ data: result }, { headers: NO_STORE })
  } catch (err: unknown) {
    if (err instanceof Response) {
      return new Response(err.body, {
        status: err.status,
        headers: { ...Object.fromEntries(err.headers), ...NO_STORE },
      })
    }
    return serverError("orders", err, { headers: NO_STORE })
  }
}
