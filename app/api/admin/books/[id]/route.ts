import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

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

    return NextResponse.json({ book: data })
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

    const { error } = await client.database.rpc("admin_update_book", {
      p_book_id: id,
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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
