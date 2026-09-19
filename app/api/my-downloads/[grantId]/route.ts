// app/api/my-downloads/[grantId]/route.ts
// GET: Authenticated PDF download endpoint.
// Verifies ownership + payment, validates grant, increments count, returns file.
// Bypasses broken consume_download RPC (ambiguous column bug).

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export const dynamic = "force-dynamic"

type RouteParams = { params: Promise<{ grantId: string }> }

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const user = await requireUser()
    const client = await createServerClient()

    const { grantId } = await params

    // 1. Fetch the grant
    const { data: grants, error: fetchError } = await client.database
      .from("download_grants")
      .select("*")
      .eq("id", grantId)
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .limit(1)

    if (fetchError || !grants || grants.length === 0) {
      return NextResponse.json(
        { error: "Download grant not found or not authorized" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    }

    const grant = grants[0] as any

    // 2. Check expiry
    if (new Date(grant.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Download link has expired" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    }

    // 3. Check max downloads
    if (grant.download_count >= grant.max_downloads) {
      return NextResponse.json(
        { error: "Maximum download limit reached" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    }

    // 4. Get the order item to find book_id and format_id
    const { data: orderItems, error: oiError } = await client.database
      .from("order_items")
      .select("book_id, format_id")
      .eq("id", grant.order_item_id)
      .limit(1)

    if (oiError || !orderItems || orderItems.length === 0) {
      return NextResponse.json(
        { error: "Order item not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      )
    }

    const orderItem = orderItems[0] as any

    // 5. Get the digital asset (storage key) — digital_assets links via format_id only
    const { data: assets, error: daError } = await client.database
      .from("digital_assets")
      .select("storage_key")
      .eq("format_id", orderItem.format_id)
      .eq("active", true)
      .limit(1)

    if (daError || !assets || assets.length === 0) {
      return NextResponse.json(
        { error: "No file attached to this order" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      )
    }

    const asset = assets[0] as any
    const storageKey = asset.storage_key

    if (!storageKey) {
      return NextResponse.json(
        { error: "Storage key not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      )
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
      return NextResponse.json(
        { error: "Maximum download limit reached" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
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

    // 7. Download the PDF from storage
    const { data: blob, error: storageError } = await client.storage
      .from("digital-books")
      .download(storageKey)

    if (storageError || !blob) {
      console.error("Storage download error:", storageError)
      return NextResponse.json(
        { error: "File not found in storage" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      )
    }

    // 8. Return the PDF
    const filename = storageKey.split("/").pop() || "download.pdf"

    return new Response(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err: any) {
    if (err instanceof Response) {
      return new Response(err.body, {
        status: err.status,
        headers: { ...Object.fromEntries(err.headers), "Cache-Control": "no-store" },
      })
    }
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
