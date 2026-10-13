// app/api/admin/orders/route.ts
// GET: Admin order listing with filters.

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { serverError } from "@/lib/http-errors"

export async function GET(req: Request) {
  try {
    await requireAdmin()

    const client = await createServerClient()
    const url = new URL(req.url)
    const status = url.searchParams.get("status")
    const page = parseInt(url.searchParams.get("page") || "1")
    const limit = parseInt(url.searchParams.get("limit") || "20")
    const offset = (page - 1) * limit

    let query = client.database
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq("payment_status", status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
    }

    return NextResponse.json({ data, page, limit })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    return serverError("admin orders", err)
  }
}
