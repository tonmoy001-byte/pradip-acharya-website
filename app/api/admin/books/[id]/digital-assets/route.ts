// app/api/admin/books/[id]/digital-assets/route.ts
// POST: Save or update digital asset (PDF storage key) for a book format.

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id: bookId } = await params
    const body = await req.json()
    const { formatName, storageKey } = body as { formatName: string; storageKey: string }

    if (!formatName || !storageKey) {
      return NextResponse.json({ error: "formatName and storageKey required" }, { status: 400 })
    }

    const client = await createServerClient()

    // Find the format_id for this book + format name
    const { data: format, error: fmtErr } = await client.database
      .from("book_formats")
      .select("id")
      .eq("book_id", bookId)
      .eq("format_name", formatName)
      .single()

    if (fmtErr || !format) {
      return NextResponse.json({ error: "Format not found" }, { status: 404 })
    }

    const formatId = format.id

    // Check for existing digital asset
    const { data: existing } = await client.database
      .from("digital_assets")
      .select("id")
      .eq("format_id", formatId)
      .eq("active", true)
      .maybeSingle()

    if (existing) {
      // Update
      const { error } = await client.database
        .from("digital_assets")
        .update({ storage_key: storageKey })
        .eq("id", existing.id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
      // Insert
      const { error } = await client.database
        .from("digital_assets")
        .insert({ format_id: formatId, storage_key: storageKey })
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
