// app/api/payment/create/route.ts
// POST: Initiate NagorikPay payment for an order.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { createNagorikPayPayment, formatNagorikPayAmount } from "@/lib/nagorikpay"
import { SITE_URL } from "@/lib/seo"
import { assertSameOrigin } from "@/lib/origin-check"

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
    assertSameOrigin(req)
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

    // Free orders never reach the gateway — create_ebook_order settles
    // them immediately. If one still gets here, something is wrong.
    if (!(Number(orderRow.total) > 0)) {
      return NextResponse.json({ error: "Nothing to pay for this order" }, { status: 400 })
    }

    // SITE_URL rejects localhost/non-HTTPS values from the env (lib/seo.ts),
    // so a forwarded dev value can never reach the gateway as a return URL.
    const siteUrl = SITE_URL

    console.info("[payment] create", { returnHost: new URL(siteUrl).host, order_id })

    // NagorikPay appends its own redirect query params (transactionId, status, …)
    // to success_url — do not embed a RupantorPay-style {transaction_id} placeholder.
    const payment = await createNagorikPayPayment({
      cus_name: orderRow.contact.name,
      cus_email: orderRow.contact.email,
      amount: formatNagorikPayAmount(orderRow.total),
      success_url: `${siteUrl}/payment/success`,
      cancel_url: `${siteUrl}/payment/cancel?order_id=${encodeURIComponent(order_id)}`,
      webhook_url: `${siteUrl}/api/payment/webhook`,
      metadata: { order_id, user_id: user.id },
    })

    return NextResponse.json({ payment_url: payment.payment_url })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    console.error("[payment] create failed:", err)
    return NextResponse.json({ error: "Payment could not be started. Please try again." }, { status: 502 })
  }
}
