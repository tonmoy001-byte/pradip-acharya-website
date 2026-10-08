// app/api/my-downloads/[grantId]/route.ts
// GET: Authenticated PDF download endpoint.
//
// Server-side authorization chain — every step must pass before a byte is
// returned, and the PDF is only ever streamed from the private storage bucket:
//   1. authenticated user (requireUser)
//   2. grant exists, is owned by this user, and is not revoked
//   3. grant is not expired and under its download limit
//   4. grant's order_item exists, is a digital (ebook) line, and belongs to an
//      order owned by this user whose payment_status = 'paid'
//   5. an active digital asset is attached to that exact format
// There is no way to reach another customer's PDF by editing grant, order,
// order-item or format ids, and no public/predictable URL for the file.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { EBOOK_DELIVERY_TYPE } from "@/lib/data"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

/** Uniform rejection — never reveal whether a grant/order id exists. */
function denied(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE })
}

type RouteParams = { params: Promise<{ grantId: string }> }

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const user = await requireUser()
    const client = await createServerClient()

    const { grantId } = await params

    if (!grantId || grantId.length > 128) {
      return denied(403, "Download grant not found or not authorized")
    }

    // 1. Fetch the grant, scoped to the authenticated user
    const { data: grants, error: fetchError } = await client.database
      .from("download_grants")
      .select("*")
      .eq("id", grantId)
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .limit(1)

    if (fetchError || !grants || grants.length === 0) {
      return denied(403, "Download grant not found or not authorized")
    }

    const grant = grants[0] as any

    // 2. Check expiry
    if (!grant.expires_at || new Date(grant.expires_at) < new Date()) {
      return denied(403, "Download link has expired")
    }

    // 3. Check max downloads
    if (grant.download_count >= grant.max_downloads) {
      return denied(403, "Maximum download limit reached")
    }

    // 4. Resolve the order item and verify it is an owned, paid, digital line
    const { data: orderItems, error: oiError } = await client.database
      .from("order_items")
      .select("id, order_id, book_id, format_id, delivery_type_snapshot")
      .eq("id", grant.order_item_id)
      .limit(1)

    if (oiError || !orderItems || orderItems.length === 0) {
      return denied(403, "Download grant not found or not authorized")
    }

    const orderItem = orderItems[0] as any

    if (String(orderItem.delivery_type_snapshot).toLowerCase() !== EBOOK_DELIVERY_TYPE) {
      return denied(403, "This order line is not a digital ebook")
    }

    const { data: orders, error: orderError } = await client.database
      .from("orders")
      .select("id, user_id, payment_status")
      .eq("id", orderItem.order_id)
      .eq("user_id", user.id)
      .limit(1)

    if (orderError || !orders || orders.length === 0) {
      return denied(403, "Download grant not found or not authorized")
    }

    if ((orders[0] as any).payment_status !== "paid") {
      return denied(403, "Payment has not been confirmed for this order")
    }

    // 5. Get the digital asset (storage key) for this exact format
    const { data: assets, error: daError } = await client.database
      .from("digital_assets")
      .select("storage_key")
      .eq("format_id", orderItem.format_id)
      .eq("active", true)
      .limit(1)

    if (daError || !assets || assets.length === 0) {
      return denied(404, "No file attached to this order")
    }

    const storageKey = (assets[0] as any)?.storage_key
    if (!storageKey || typeof storageKey !== "string") {
      return denied(404, "No file attached to this order")
    }

    // 6. Atomically increment download count
    // NOTE: PostgREST SDK doesn't support `SET col = col + 1` syntax.
    // True atomicity requires a DB RPC function (CREATE FUNCTION ... BEGIN UPDATE ... END).
    // For now, we re-read the grant right before incrementing to minimize the race window.
    const { data: freshGrants } = await client.database
      .from("download_grants")
      .select("download_count, max_downloads")
      .eq("id", grantId)
      .limit(1)
    const freshGrant = freshGrants?.[0] as any
    if (freshGrant && freshGrant.download_count >= freshGrant.max_downloads) {
      return denied(403, "Maximum download limit reached")
    }

    const { error: updateError } = await client.database
      .from("download_grants")
      .update({
        download_count: (freshGrant?.download_count ?? grant.download_count) + 1,
        last_downloaded_at: new Date().toISOString(),
      })
      .eq("id", grantId)

    if (updateError) {
      console.error("Failed to increment download count:", updateError)
    }

    // 7. Stream the PDF from the private storage bucket
    const { data: blob, error: storageError } = await client.storage
      .from("digital-books")
      .download(storageKey)

    if (storageError || !blob) {
      console.error("Storage download error:", storageError)
      return denied(404, "File not found in storage")
    }

    // 8. Return the PDF
    const filename = storageKey.split("/").pop() || "ebook.pdf"

    return new Response(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.\-]/g, "_")}"`,
        "Content-Length": String(blob.size ?? ""),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
      },
    })
  } catch (err: any) {
    if (err instanceof Response) {
      return new Response(err.body, {
        status: err.status,
        headers: { ...Object.fromEntries(err.headers), ...NO_STORE },
      })
    }
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500, headers: NO_STORE },
    )
  }
}
