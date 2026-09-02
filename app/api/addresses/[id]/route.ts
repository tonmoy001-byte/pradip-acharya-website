// app/api/addresses/[id]/route.ts
// PUT: Update address. Only if owned by user.
// DELETE: Delete address. Only if owned by user.

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

    const body = await req.json()
    const { label, recipient_name, phone, address_line, district, upazila, postal_code } = body

    const { data, error } = await client.database
      .from("addresses")
      .update({
        ...(label !== undefined && { label }),
        ...(recipient_name !== undefined && { recipient_name }),
        ...(phone !== undefined && { phone }),
        ...(address_line !== undefined && { address_line }),
        ...(district !== undefined && { district }),
        ...(upazila !== undefined && { upazila }),
        ...(postal_code !== undefined && { postal_code }),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to update address" }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
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

    const { error } = await client.database
      .from("addresses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to delete address" }, { status: 500 })
    }

    return NextResponse.json({ data: { deleted: true } })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
