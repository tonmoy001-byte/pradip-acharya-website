import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { sanitizePostgREST, quotePostgrestValue } from "@/lib/sanitize-postgrest"
import { invalidatePosts } from "@/lib/public-cache"
import { serverError } from "@/lib/http-errors"
import { cleanPostHtml } from "@/lib/sanitize-html"
import { validatePostBody } from "@/lib/post-validation"
import { assertSameOrigin } from "@/lib/origin-check"

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
      const q = quotePostgrestValue(`%${search}%`)
      query = query.or(`title.ilike.${q},content.ilike.${q}`)
    }
    if (status) {
      query = query.eq("status", status)
    }
    if (postType) {
      query = query.eq("post_type", postType)
    }

    const { data, error } = await query
    if (error) {
      console.error("[admin posts] list failed:", error.message)
      return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 })
    }

    return NextResponse.json({ posts: data || [] })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    return serverError("admin posts GET", err)
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req)
    await requireAdmin()
    const body = await req.json()
    const client = await createServerClient()

    const validationError = validatePostBody(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const { data, error } = await client.database.rpc("admin_create_post", {
      p_title: body.title,
      p_slug: body.slug,
      p_content: cleanPostHtml(body.content || ""),
      p_excerpt: body.excerpt || null,
      p_cover_image: body.cover_image || null,
      p_post_type: body.post_type || "blog",
      p_status: body.status || "draft",
      p_tags: body.tags || [],
      p_meta_title: body.meta_title || null,
      p_meta_description: body.meta_description || null,
    })

    if (error) {
      console.error("[admin posts] create failed:", error.message)
      return NextResponse.json({ error: "Failed to create post" }, { status: 500 })
    }

    // Update author_name if provided (RPC hardcodes it)
    const postId = data as string
    if (body.author_name) {
      await client.database
        .from("posts")
        .update({ author_name: body.author_name })
        .eq("id", postId)
    }

    invalidatePosts(body.slug)
    return NextResponse.json({ post_id: postId })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    return serverError("admin posts POST", err)
  }
}
