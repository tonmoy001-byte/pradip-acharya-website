// app/api/my-downloads/[grantId]/route.ts
// GET: Authenticated PDF download endpoint.
//
// Server-side authorization chain — every step must pass before a byte is
// returned, and the PDF is only ever streamed from the private storage bucket:
//   1. authenticated user (requireUser)
//   2. grant exists, is owned by this user, and is not revoked
//   3. grant's order_item exists, is a digital (ebook) line, and belongs to an
//      order owned by this user whose payment_status = 'paid'
//   4. an active digital asset is attached to that exact format
// Steps 1–2 run on the customer-session client. Only after every check
// passes does the route escalate to the service client for steps 3–4
// (digital_assets lookup and private-bucket download) — both are admin-only
// under RLS/storage policies, so a customer JWT cannot read them. The
// service client is never constructed on a rejection path.
// There is no way to reach another customer's PDF by editing grant, order,
// order-item or format ids, and no public/predictable URL for the file.
//
// Browser navigations (Sec-Fetch-Dest: document or Accept: text/html) get a
// 303 redirect to /my-downloads?dl_error=<code> on rejection so Android /
// in-app browsers never see raw JSON. API / fetch callers still get JSON.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { createServiceClient } from "@/lib/insforge-service"
import { EBOOK_DELIVERY_TYPE } from "@/lib/data"
import { serverError } from "@/lib/http-errors"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

/** True when the request is a top-level browser navigation (not fetch/XHR). */
function isBrowserNavigation(req: Request): boolean {
  const dest = req.headers.get("sec-fetch-dest")
  if (dest === "document") return true
  const accept = req.headers.get("accept") || ""
  return accept.includes("text/html")
}

/**
 * Uniform rejection — never reveal whether a grant/order id exists.
 * Browser navigations are 303-redirected to /my-downloads with a stable
 * error code; everything else keeps the original JSON shape.
 */
function denied(status: number, message: string, req: Request, code: string) {
  if (isBrowserNavigation(req)) {
    return new Response(null, {
      status: 303,
      headers: {
        Location: `/my-downloads?dl_error=${code}`,
        ...NO_STORE,
      },
    })
  }
  return NextResponse.json({ error: message }, { status, headers: NO_STORE })
}

type RouteParams = { params: Promise<{ grantId: string }> }

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const user = await requireUser()
    const client = await createServerClient()

    const { grantId } = await params

    if (!grantId || grantId.length > 128) {
      return denied(403, "Download grant not found or not authorized", req, "not_found")
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
      return denied(403, "Download grant not found or not authorized", req, "not_found")
    }

    const grant = grants[0] as any

    // Defense in depth: the query already filters revoked_at, but
    // consume_download re-checks under lock — surface a stable code.
    if (grant.revoked_at) {
      return denied(403, "Download grant has been revoked", req, "revoked")
    }

    // 2. Resolve the order item and verify it is an owned, paid, digital line
    const { data: orderItems, error: oiError } = await client.database
      .from("order_items")
      .select("id, order_id, book_id, format_id, delivery_type_snapshot, title_snapshot")
      .eq("id", grant.order_item_id)
      .limit(1)

    if (oiError || !orderItems || orderItems.length === 0) {
      return denied(403, "Download grant not found or not authorized", req, "not_found")
    }

    const orderItem = orderItems[0] as any

    if (String(orderItem.delivery_type_snapshot).toLowerCase() !== EBOOK_DELIVERY_TYPE) {
      return denied(403, "This order line is not a digital ebook", req, "not_found")
    }

    const { data: orders, error: orderError } = await client.database
      .from("orders")
      .select("id, user_id, payment_status")
      .eq("id", orderItem.order_id)
      .eq("user_id", user.id)
      .limit(1)

    if (orderError || !orders || orders.length === 0) {
      return denied(403, "Download grant not found or not authorized", req, "not_found")
    }

    if ((orders[0] as any).payment_status !== "paid") {
      return denied(403, "Payment has not been confirmed for this order", req, "not_paid")
    }

    // 3–4. Escalate only now that every authorization check has passed.
    // digital_assets is admin-only under RLS and the private bucket only
    // allows admin SELECT, so the customer-session client cannot read
    // either. format_id comes from the authorized order item, never the
    // request.
    const service = createServiceClient()

    const { data: assets, error: daError } = await service.database
      .from("digital_assets")
      .select("storage_key")
      .eq("format_id", orderItem.format_id)
      .eq("active", true)
      .limit(1)

    if (daError || !assets || assets.length === 0) {
      return denied(404, "No file attached to this order", req, "no_file")
    }

    const storageKey = (assets[0] as any)?.storage_key
    if (!storageKey || typeof storageKey !== "string") {
      return denied(404, "No file attached to this order", req, "no_file")
    }

    // Fetch the file first, so a storage failure never costs
    // the customer a download.
    const { data: blob, error: storageError } = await service.storage
      .from("digital-books")
      .download(storageKey)

    if (storageError || !blob) {
      console.error("Storage download error:", storageError)
      return denied(404, "File not found in storage", req, "storage")
    }

    // 5. Record the download as a private statistic. consume_download()
    //    locks the grant and re-checks ownership / revocation / paid
    //    status; it no longer enforces an expiry or a download limit.
    const { data: consumed, error: consumeError } = await client.database.rpc(
      "consume_download",
      { p_grant_id: grantId },
    )
    if (consumeError) {
      console.error("consume_download failed:", consumeError.message)
      const code = /revok/i.test(consumeError.message || "") ? "revoked" : "not_found"
      return denied(
        403,
        code === "revoked" ? "Download grant has been revoked" : "Download grant not found or not authorized",
        req,
        code,
      )
    }
    if (!consumed) {
      return denied(403, "Download grant not found or not authorized", req, "not_found")
    }

    // 6. Return the PDF. Filename uses the book title (RFC 5987 for
    //    non-ASCII/Bengali names) with an ASCII fallback for older clients.
    const rawTitle = String((orderItem as any).title_snapshot || "").trim()
    const baseTitle = rawTitle
      .replace(/["\\]/g, "")
      .replace(/\.pdf$/i, "")
      .trim() || "ebook"
    const asciiName = `${baseTitle.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_")}.pdf`
    const utf8Name = encodeURIComponent(`${baseTitle}.pdf`)

    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    }
    if (typeof blob.size === "number" && Number.isFinite(blob.size)) {
      headers["Content-Length"] = String(blob.size)
    }

    return new Response(blob, { headers })
  } catch (err: unknown) {
    if (err instanceof Response) {
      return new Response(err.body, {
        status: err.status,
        headers: { ...Object.fromEntries(err.headers), ...NO_STORE },
      })
    }
    return serverError("download grant", err, { headers: NO_STORE })
  }
}
