import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const client = await createServerClient()

    const [profileRes, ordersRes] = await Promise.all([
      client.database.from("customer_profiles").select("*").eq("user_id", id).single(),
      client.database.from("orders").select("*").eq("user_id", id).order("created_at", { ascending: false }),
    ])

    if (profileRes.error) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    return NextResponse.json({
      customer: profileRes.data,
      orders: ordersRes.data || [],
    })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
