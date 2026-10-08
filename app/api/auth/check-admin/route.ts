// app/api/auth/check-admin/route.ts
// Check if a user is an admin via is_admin RPC.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const client = await createServerClient()

    const { data, error } = await client.database.rpc("is_admin", {
      uid: user.id,
    })

    if (error) {
      return NextResponse.json({ isAdmin: false }, { headers: { "Cache-Control": "no-store" } })
    }

    return NextResponse.json({ isAdmin: data === true }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ isAdmin: false }, { headers: { "Cache-Control": "no-store" } })
  }
}