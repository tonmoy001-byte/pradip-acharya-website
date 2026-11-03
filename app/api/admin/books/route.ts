import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { quotePostgrestValue } from "@/lib/sanitize-postgrest"
import { invalidateBooks } from "@/lib/public-cache"
import { EBOOK_DELIVERY_TYPE, BOOK_CATEGORY, BOOK_CATEGORY_LABEL } from "@/lib/data"
import { serverError } from "@/lib/http-errors"
import { assertSameOrigin } from "@/lib/origin-check"

export async function GET(req: Request) {
  try {
    await requireAdmin()
    const client = await createServerClient()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const category = searchParams.get("category") || ""

    let query = client.database
      .from("books")
      .select("*, book_formats(*)")
      .order("created_at", { ascending: false })

    if (search) {
      const q = quotePostgrestValue(`%${search}%`)
      query = query.or(`title.ilike.${q},author.ilike.${q}`)
    }
    if (category) {
      query = query.eq("category", category)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: "Failed to fetch books" }, { status: 500 })
    }

    return NextResponse.json({ books: data || [] })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    return serverError("admin books GET", err)
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req)
    await requireAdmin()
    const body = await req.json()
    const client = await createServerClient()

    // Ebook-only store: exactly one digital format may be created, and the
    // delivery type is forced server-side so a physical format can never be
    // introduced through the admin API.
    const submitted = Array.isArray(body.formats) ? body.formats : []
    const formats = submitted
      .filter((f: any) => f?.name)
      .map((f: any) => ({
        name: f.name,
        price: Number(f.price) || 0,
        compareAtPrice: f.compareAtPrice ?? null,
        delivery_type: EBOOK_DELIVERY_TYPE,
        available: f.available !== false,
      }))

    if (formats.length !== 1) {
      return NextResponse.json(
        { error: "একটি ইবুক ফরম্যাট (ডিজিটাল) আবশ্যক" },
        { status: 400 },
      )
    }

    const { data, error } = await client.database.rpc("admin_create_book", {
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
      p_formats: formats,
    })

    if (error) {
      return NextResponse.json({ error: "Failed to create book" }, { status: 500 })
    }

    // Update extra fields not handled by the RPC
    const bookId = data as string
    const { error: updateErr } = await client.database
      .from("books")
      .update({
        publication_date: body.publication_date || null,
        publisher: body.publisher || null,
        isbn: body.isbn || null,
        pages: body.pages || null,
        language: body.language || null,
      })
      .eq("id", bookId)

    if (updateErr) {
      return NextResponse.json({ error: "Failed to update book" }, { status: 500 })
    }

    invalidateBooks(bookId)
    return NextResponse.json({ book_id: bookId })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    return serverError("admin books POST", err)
  }
}
