// app/api/admin/books/[id]/digital-assets/route.ts
// POST: Save or update digital asset (PDF storage key) for a book format.

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { invalidateBooks } from "@/lib/public-cache"
import { EBOOK_DELIVERY_TYPE } from "@/lib/data"

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

    // Ebook-only: resolve the book's digital format directly. A name lookup is
    // only a fallback for legacy rows whose format_name differs.
    const { data: digitalFormats, error: digitalErr } = await client.database
      .from("book_formats")
      .select("id")
      .eq("book_id", bookId)
      .eq("delivery_type", EBOOK_DELIVERY_TYPE)
      .limit(1)

    let formatId = digitalFormats?.[0]?.id as string | undefined

    if (!formatId) {
      const { data: format, error: fmtErr } = await client.database
        .from("book_formats")
        .select("id")
        .eq("book_id", bookId)
        .eq("format_name", formatName)
        .single()

      if (fmtErr || !format) {
        return NextResponse.json({ error: "এই বইয়ের ইবুক ফরম্যাট পাওয়া যায়নি" }, { status: 404 })
      }
      formatId = format.id
    }

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

    invalidateBooks(bookId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
