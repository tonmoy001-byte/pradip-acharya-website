// app/api/my-downloads/route.ts
// GET: List the current user's download grants.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const client = await createServerClient()

    const { data, error } = await client.database
      .from("download_grants")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: { "Cache-Control": "no-store" } })
    }

    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } })
  } catch (err: any) {
    if (err instanceof Response) {
      return new Response(err.body, {
        status: err.status,
        headers: { ...Object.fromEntries(err.headers), "Cache-Control": "no-store" },
      })
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500, headers: { "Cache-Control": "no-store" } })
  }
}
