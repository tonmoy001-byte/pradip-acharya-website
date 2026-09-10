import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const client = await createServerClient()

    const { data, error } = await client.database
      .from("posts")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ post: data })
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

    const { error } = await client.database.rpc("admin_update_post", {
      p_post_id: id,
      p_title: body.title,
      p_slug: body.slug,
      p_content: body.content || "",
      p_excerpt: body.excerpt || null,
      p_cover_image: body.cover_image || null,
      p_post_type: body.post_type || "blog",
      p_status: body.status || "draft",
      p_tags: body.tags || [],
      p_meta_title: body.meta_title || null,
      p_meta_description: body.meta_description || null,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update author_name if provided (RPC doesn't handle it)
    if (body.author_name !== undefined) {
      await client.database
        .from("posts")
        .update({ author_name: body.author_name })
        .eq("id", id)
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

    const { error } = await client.database.rpc("admin_delete_post", {
      p_post_id: id,
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
