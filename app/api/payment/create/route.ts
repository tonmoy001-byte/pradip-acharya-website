// app/api/payment/create/route.ts
// POST: Initiate RupantorPay payment for an order.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { createRupantorPayment } from "@/lib/rupantor"

export const dynamic = "force-dynamic"

interface OrderRow {
  id: string
  user_id: string
  total: number
  payment_status: string
  contact: { name: string; email: string; phone: string }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const client = await createServerClient()
    const body = await req.json()
    const { order_id } = body as { order_id: string }

    if (!order_id) {
      return NextResponse.json({ error: "order_id required" }, { status: 400 })
    }

    // Fetch order and verify ownership
    const { data: order, error: orderError } = await client.database
      .from("orders")
      .select("id, user_id, total, payment_status, contact")
      .eq("id", order_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const orderRow = order as OrderRow

    if (orderRow.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (orderRow.payment_status !== "pending_payment") {
      return NextResponse.json({ error: "Order already processed" }, { status: 400 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pradipbooks.insforge.site"

    // Create RupantorPay payment
    const payment = await createRupantorPayment({
      fullname: orderRow.contact.name,
      email: orderRow.contact.email,
      amount: String(orderRow.total),
      success_url: `${siteUrl}/payment/success?transaction_id={transaction_id}`,
      cancel_url: `${siteUrl}/payment/cancel?order_id=${order_id}`,
      webhook_url: `${siteUrl}/api/payment/webhook`,
      metadata: {
        order_id: order_id,
        user_id: user.id,
      },
    })

    // Update order with payment method
    await client.database
      .from("orders")
      .update({ payment_method: "rupantor" })
      .eq("id", order_id)

    return NextResponse.json({ payment_url: payment.payment_url })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
