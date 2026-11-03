// app/api/wishlist/route.ts
// GET: List user's wishlist items joined with books data.
// POST: Toggle wishlist via toggle_wishlist(p_book_id) RPC.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { serverError } from "@/lib/http-errors"
import { assertSameOrigin } from "@/lib/origin-check"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const client = await createServerClient()

    const { data, error } = await client.database
      .from("wishlists")
      .select("*, books(id, title, author, cover_primary, book_formats(format_name, price, delivery_type, available))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Failed to fetch wishlist" }, { status: 500, headers: NO_STORE })
    }

    return NextResponse.json({ data }, { headers: NO_STORE })
  } catch (err: unknown) {
    if (err instanceof Response) return new Response(err.body, { status: err.status, headers: { ...Object.fromEntries(err.headers), "Cache-Control": "no-store" } })
    return serverError("wishlist GET", err, { headers: NO_STORE })
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req)
    const user = await requireUser()
    const client = await createServerClient()

    const body = await req.json()
    const { book_id } = body

    if (!book_id) {
      return NextResponse.json({ error: "book_id is required" }, { status: 400, headers: NO_STORE })
    }

    const { data, error } = await client.database.rpc("toggle_wishlist", {
      p_book_id: book_id,
    })

    if (error) {
      return NextResponse.json({ error: "Failed to toggle wishlist" }, { status: 500, headers: NO_STORE })
    }

    return NextResponse.json({ data }, { headers: NO_STORE })
  } catch (err: unknown) {
    if (err instanceof Response) return new Response(err.body, { status: err.status, headers: { ...Object.fromEntries(err.headers), "Cache-Control": "no-store" } })
    return serverError("wishlist POST", err, { headers: NO_STORE })
  }
}
