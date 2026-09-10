import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

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
      query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`)
    }
    if (category) {
      query = query.eq("category", category)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ books: data || [] })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const body = await req.json()
    const client = await createServerClient()

    const { data, error } = await client.database.rpc("admin_create_book", {
      p_title: body.title,
      p_author: body.author,
      p_category: body.category,
      p_subcategory: body.subcategory,
      p_subcategory_slug: body.subcategory_slug,
      p_description: body.description || "",
      p_synopsis: body.synopsis || null,
      p_cover_primary: body.cover_primary || null,
      p_cover_hover: body.cover_hover || null,
      p_featured: body.featured || false,
      p_is_new: body.is_new || false,
      p_trending: body.trending || false,
      p_is_demo: body.is_demo || false,
      p_formats: body.formats || [],
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ book_id: data })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
