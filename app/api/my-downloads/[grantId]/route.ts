// app/api/my-downloads/[grantId]/route.ts
// GET: Authenticated PDF download endpoint.
// Verifies ownership + payment, consumes download, returns file.

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

    // Consume the download via RPC
    const { data: grantData, error: grantError } = await client.database.rpc("consume_download", {
      p_grant_id: grantId,
      p_user_id: user.id,
    })

    if (grantError) {
      return NextResponse.json({ error: grantError.message || "Download failed" }, { status: 403, headers: { "Cache-Control": "no-store" } })
    }

    // Fetch the PDF file from storage
    const storageKey = grantData.storage_key
    const { data: blob, error: storageError } = await client.storage
      .from("digital-books")
      .download(storageKey)

    if (storageError || !blob) {
      return NextResponse.json({ error: "File not found" }, { status: 404, headers: { "Cache-Control": "no-store" } })
    }

    // Return the PDF with appropriate headers
    return new Response(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${storageKey.split("/").pop() || "download.pdf"}"`,
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
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500, headers: { "Cache-Control": "no-store" } })
  }
}
