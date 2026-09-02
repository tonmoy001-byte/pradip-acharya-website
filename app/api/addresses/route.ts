// app/api/addresses/route.ts
// GET: List user's addresses ordered by is_default DESC, created_at DESC.
// POST: Create new address. If is_default, calls set_default_address RPC.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const client = await createServerClient()

    const { data, error } = await client.database
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to fetch addresses" }, { status: 500, headers: NO_STORE })
    }

    return NextResponse.json({ data }, { headers: NO_STORE })
  } catch (err: any) {
    if (err instanceof Response) return new Response(err.body, { status: err.status, headers: { ...Object.fromEntries(err.headers), "Cache-Control": "no-store" } })
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500, headers: NO_STORE })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const client = await createServerClient()

    const body = await req.json()
    const { label, recipient_name, phone, address_line, district, upazila, postal_code, is_default } = body

    if (!recipient_name || !phone || !address_line || !district || !upazila) {
      return NextResponse.json(
        { error: "recipient_name, phone, address_line, district, and upazila are required" },
        { status: 400, headers: NO_STORE },
      )
    }

    const { data, error } = await client.database
      .from("addresses")
      .insert({
        user_id: user.id,
        label: label || null,
        recipient_name,
        phone,
        address_line,
        district,
        upazila,
        postal_code: postal_code || null,
        is_default: is_default || false,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to create address" }, { status: 500, headers: NO_STORE })
    }

    if (is_default && data) {
      const { error: setDefaultError } = await client.database.rpc("set_default_address", {
        p_address_id: data.id,
      })

      if (setDefaultError) {
        return NextResponse.json(
          { error: setDefaultError.message || "Failed to set default address" },
          { status: 500, headers: NO_STORE },
        )
      }
    }

    return NextResponse.json({ data }, { headers: NO_STORE })
  } catch (err: any) {
    if (err instanceof Response) return new Response(err.body, { status: err.status, headers: { ...Object.fromEntries(err.headers), "Cache-Control": "no-store" } })
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500, headers: NO_STORE })
  }
}
