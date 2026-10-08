// app/api/profile/route.ts
// GET: Fetch user profile via get_user_profile() RPC.
// PUT: Update profile via direct upsert on profiles table (upsert_profile RPC is broken).

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const client = await createServerClient()

    // Profile + admin flag in one request, RPCs run in parallel.
    const [profileResult, adminResult] = await Promise.all([
      client.database.rpc("get_user_profile", { p_user_id: user.id }),
      client.database.rpc("is_admin", { uid: user.id }),
    ])

    const { data, error } = profileResult

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to fetch profile" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      )
    }

    // Admin check is non-fatal: a failure degrades to customer view, never 500s.
    let isAdmin = false
    if (adminResult.error) {
      console.error("[profile] is_admin check failed; defaulting to customer role", adminResult.error)
    } else {
      isAdmin = adminResult.data === true
    }

    // Merge: profile data + auth user info as fallback
    // InsForge RPC returns rows as indexed keys (e.g. "0") plus flat fields
    const profileData = data || {}
    const row = profileData["0"] || profileData
    const result = {
      ...row,
      user_id: row.user_id || user.id,
      email: row.email || profileData.email || user.email || "",
      full_name: row.display_name || row.full_name || profileData.full_name || null,
      is_admin: isAdmin,
    }

    return NextResponse.json({ data: result }, { headers: { "Cache-Control": "no-store" } })
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
    const { full_name } = body

    if (!full_name) {
      return NextResponse.json(
        { error: "Full name is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    // Direct upsert — skip the broken upsert_profile RPC
    const { data: existing } = await client.database
      .from("profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()

    let data = null
    let error = null

    if (existing) {
      const updatePayload: Record<string, string | null> = {}
      if (full_name !== undefined) updatePayload.display_name = full_name
      if (Object.keys(updatePayload).length > 0) {
        const updateResult = await client.database
          .from("profiles")
          .update(updatePayload)
          .eq("user_id", user.id)
        data = updateResult.data
        error = updateResult.error
      }
    } else {
      const insertPayload: Record<string, string | null> = {
        user_id: user.id,
        display_name: full_name || null,
      }
      const insertResult = await client.database
        .from("profiles")
        .insert([insertPayload])
      data = insertResult.data
      error = insertResult.error
    }

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
