import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { invalidateBooks } from "@/lib/public-cache"
import { EBOOK_DELIVERY_TYPE, BOOK_CATEGORY, BOOK_CATEGORY_LABEL } from "@/lib/data"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const client = await createServerClient()

    const { data, error } = await client.database
      .from("books")
      .select("*, book_formats(*)")
      .eq("id", id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    // Fetch digital assets and map to formats
    const formatIds = (data.book_formats || []).map((f: any) => f.id)
    let digitalAssets: any[] = []
    if (formatIds.length > 0) {
      const { data: assets } = await client.database
        .from("digital_assets")
        .select("id, format_id, storage_key, active")
        .in("format_id", formatIds)
        .eq("active", true)
      digitalAssets = assets || []
    }

    // Attach storageKey to each format
    const assetsByFormat = new Map(digitalAssets.map((a: any) => [a.format_id, a.storage_key]))
    const formatsWithAssets = (data.book_formats || []).map((f: any) => ({
      ...f,
      storage_key: assetsByFormat.get(f.id) || null,
    }))

    return NextResponse.json({ book: { ...data, book_formats: formatsWithAssets } })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const client = await createServerClient()

    // `admin_update_book` deletes and re-inserts every book_formats row for the
    // book. Two things must survive that round-trip:
    //   1. legacy physical format rows, which historical order_items may still
    //      reference — so they are read and passed through untouched;
    //   2. the ebook's digital_assets link, which is keyed by format_id and
    //      would otherwise be orphaned (breaking every download grant).
    const { data: existingFormats } = await client.database
      .from("book_formats")
      .select("id, format_name, price, compare_at_price, available, delivery_type")
      .eq("book_id", id)

    const existing = (existingFormats || []) as any[]
    const preservedLegacyFormats = existing
      .filter((f) => String(f.delivery_type).toLowerCase() !== EBOOK_DELIVERY_TYPE)
      .map((f) => ({
        name: f.format_name,
        price: Number(f.price),
        compareAtPrice: f.compare_at_price ?? null,
        delivery_type: f.delivery_type,
        available: f.available,
      }))

    const previousEbookFormat = existing.find(
      (f) => String(f.delivery_type).toLowerCase() === EBOOK_DELIVERY_TYPE,
    )
    let previousStorageKey: string | null = null
    if (previousEbookFormat) {
      const { data: asset } = await client.database
        .from("digital_assets")
        .select("storage_key")
        .eq("format_id", previousEbookFormat.id)
        .eq("active", true)
        .maybeSingle()
      previousStorageKey = asset?.storage_key ?? null
    }

    // Ebook-only: the submitted payload carries exactly one digital format.
    const submitted = Array.isArray(body.formats) ? body.formats : []
    const ebookFormats = submitted
      .filter((f: any) => f?.name)
      .map((f: any) => ({
        name: f.name,
        price: Number(f.price) || 0,
        compareAtPrice: f.compareAtPrice ?? null,
        delivery_type: EBOOK_DELIVERY_TYPE,
        available: f.available !== false,
      }))

    if (ebookFormats.length !== 1) {
      return NextResponse.json(
        { error: "একটি ইবুক ফরম্যাট (ডিজিটাল) আবশ্যক" },
        { status: 400 },
      )
    }

    const { error } = await client.database.rpc("admin_update_book", {
      p_book_id: id,
      p_title: body.title,
      p_author: body.author,
      // Single-category store: taxonomy is fixed server-side, never taken
      // from the request, so no client can introduce another category value.
      p_category: BOOK_CATEGORY,
      p_subcategory: BOOK_CATEGORY_LABEL,
      p_subcategory_slug: BOOK_CATEGORY,
      p_description: body.description || "",
      p_synopsis: body.synopsis || null,
      p_cover_primary: body.cover_primary || null,
      p_cover_hover: body.cover_hover || null,
      p_featured: body.featured || false,
      p_is_new: body.is_new || false,
      p_trending: body.trending || false,
      p_is_demo: body.is_demo || false,
      p_formats: [...preservedLegacyFormats, ...ebookFormats],
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Re-attach the previously stored PDF to the freshly created ebook format.
    if (previousStorageKey) {
      const { data: newEbook } = await client.database
        .from("book_formats")
        .select("id")
        .eq("book_id", id)
        .eq("delivery_type", EBOOK_DELIVERY_TYPE)
        .limit(1)

      const newFormatId = newEbook?.[0]?.id
      if (newFormatId) {
        const { data: existingAsset } = await client.database
          .from("digital_assets")
          .select("id")
          .eq("format_id", newFormatId)
          .eq("active", true)
          .maybeSingle()

        if (existingAsset) {
          await client.database
            .from("digital_assets")
            .update({ storage_key: previousStorageKey })
            .eq("id", existingAsset.id)
        } else {
          await client.database
            .from("digital_assets")
            .insert({ format_id: newFormatId, storage_key: previousStorageKey })
        }
      }
    }

    // Update extra fields not handled by the RPC
    const { error: updateErr } = await client.database
      .from("books")
      .update({
        publication_date: body.publication_date || null,
        publisher: body.publisher || null,
        isbn: body.isbn || null,
        pages: body.pages || null,
        language: body.language || null,
      })
      .eq("id", id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    invalidateBooks(id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const client = await createServerClient()

    const { error } = await client.database.rpc("admin_delete_book", {
      p_book_id: id,
    })

    if (error) {
      const message = error.message || "Delete failed"
      if (message.includes("Book not found")) {
        return NextResponse.json({ error: message }, { status: 404 })
      }
      // Business rule failures (orders / digital assets still reference the book)
      if (message.includes("Cannot delete book")) {
        return NextResponse.json({ error: message }, { status: 409 })
      }
      return NextResponse.json({ error: message }, { status: 500 })
    }

    invalidateBooks(id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
