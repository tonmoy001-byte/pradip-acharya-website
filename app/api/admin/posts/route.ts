import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { sanitizePostgREST } from "@/lib/sanitize"

export async function GET(req: Request) {
  try {
    await requireAdmin()
    const client = await createServerClient()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const postType = searchParams.get("post_type") || ""

    let query = client.database
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })

    if (search) {
      const safe = sanitizePostgREST(search)
      query = query.or(`title.ilike.%${safe}%,content.ilike.%${safe}%`)
    }
    if (status) {
      query = query.eq("status", status)
    }
    if (postType) {
      query = query.eq("post_type", postType)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ posts: data || [] })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const body = await req.json()
    const client = await createServerClient()

    const { data, error } = await client.database.rpc("admin_create_post", {
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

    // Update author_name if provided (RPC hardcodes it)
    const postId = data as string
    if (body.author_name) {
      await client.database
        .from("posts")
        .update({ author_name: body.author_name })
        .eq("id", postId)
    }

    return NextResponse.json({ post_id: postId })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
