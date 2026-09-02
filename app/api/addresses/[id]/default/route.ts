// app/api/addresses/[id]/default/route.ts
// PUT: Set address as default via set_default_address(p_address_id) RPC.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

type RouteParams = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const user = await requireUser()
    const client = await createServerClient()
    const { id } = await params

    const { data: existing, error: fetchError } = await client.database
      .from("addresses")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 })
    }

    const { error } = await client.database.rpc("set_default_address", {
      p_address_id: id,
    })

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to set default address" }, { status: 500 })
    }

    return NextResponse.json({ data: { success: true } })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
