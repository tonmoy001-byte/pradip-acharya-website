// app/api/admin/books/[id]/digital-assets/route.ts
// POST: Save or update digital asset (PDF storage key) for a book format.

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { invalidateBooks } from "@/lib/public-cache"
import { EBOOK_DELIVERY_TYPE } from "@/lib/data"
import { assertSameOrigin } from "@/lib/origin-check"
import { serverError } from "@/lib/http-errors"

const STORAGE_KEY_RE = /^ebooks\/[\w.-]+\.pdf$/

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req)
    await requireAdmin()
    const { id: bookId } = await params
    const body = await req.json()
    const { formatName, storageKey } = body as { formatName: string; storageKey: string }

    if (!formatName || !storageKey) {
      return NextResponse.json({ error: "formatName and storageKey required" }, { status: 400 })
    }
    if (!STORAGE_KEY_RE.test(storageKey)) {
      return NextResponse.json({ error: "Invalid storage key" }, { status: 400 })
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
        console.error("[digital-assets] update failed:", error.message)
        return NextResponse.json({ error: "Failed to save digital asset" }, { status: 500 })
      }
    } else {
      // Insert
      const { error } = await client.database
        .from("digital_assets")
        .insert({ format_id: formatId, storage_key: storageKey })
      if (error) {
        console.error("[digital-assets] insert failed:", error.message)
        return NextResponse.json({ error: "Failed to save digital asset" }, { status: 500 })
      }
    }

    invalidateBooks(bookId)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    return serverError("digital assets", err)
  }
}
