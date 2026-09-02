// app/api/profile/route.ts
// GET: Fetch user profile via get_user_profile() RPC.
// PUT: Update profile via upsert_profile(p_full_name, p_phone) RPC.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const client = await createServerClient()

    const { data, error } = await client.database.rpc("get_user_profile", {
      p_user_id: user.id,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to fetch profile" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      )
    }

    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } })
  } catch (err: any) {
    if (err instanceof Response) {
      const res = new Response(err.body, {
        status: err.status,
        headers: { ...Object.fromEntries(err.headers), "Cache-Control": "no-store" },
      })
      return res
    }
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUser()
    const client = await createServerClient()

    const body = await req.json()
    const { full_name, phone } = body

    if (!full_name && !phone) {
      return NextResponse.json(
        { error: "At least one field (full_name, phone) is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    const { data, error } = await client.database.rpc("upsert_profile", {
      p_user_id: user.id,
      p_full_name: full_name || null,
      p_phone: phone || null,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to update profile" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      )
    }

    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } })
  } catch (err: any) {
    if (err instanceof Response) {
      const res = new Response(err.body, {
        status: err.status,
        headers: { ...Object.fromEntries(err.headers), "Cache-Control": "no-store" },
      })
      return res
    }
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
