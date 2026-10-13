import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { invalidatePosts } from "@/lib/public-cache"
import { serverError } from "@/lib/http-errors"
import { cleanPostHtml } from "@/lib/sanitize-html"
import { validatePostBody } from "@/lib/post-validation"
import { assertSameOrigin } from "@/lib/origin-check"

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
      console.error("[admin post] fetch failed:", error.message)
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    return NextResponse.json({ post: data })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    return serverError("admin posts GET", err)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req)
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const client = await createServerClient()

    const validationError = validatePostBody(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const { error } = await client.database.rpc("admin_update_post", {
      p_post_id: id,
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
      console.error("[admin post] update failed:", error.message)
      return NextResponse.json({ error: "Failed to update post" }, { status: 500 })
    }

    // Update author_name if provided (RPC doesn't handle it)
    if (body.author_name !== undefined) {
      await client.database
        .from("posts")
        .update({ author_name: body.author_name })
        .eq("id", id)
    }

    invalidatePosts(body.slug)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    return serverError("admin posts PUT", err)
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req)
    await requireAdmin()
    const { id } = await params
    const client = await createServerClient()

    const { error } = await client.database.rpc("admin_delete_post", {
      p_post_id: id,
    })

    if (error) {
      console.error("[admin post] delete failed:", error.message)
      return NextResponse.json({ error: "Failed to delete post" }, { status: 500 })
    }

    invalidatePosts()
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    return serverError("admin posts DELETE", err)
  }
}
