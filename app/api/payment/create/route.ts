// app/api/payment/create/route.ts
// POST: Initiate NagorikPay payment for an order.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { createServiceClient } from "@/lib/insforge-service"
import { createNagorikPayPayment, formatNagorikPayAmount } from "@/lib/nagorikpay"
import { SITE_URL } from "@/lib/seo"
import { assertSameOrigin } from "@/lib/origin-check"

export const dynamic = "force-dynamic"

/** Last path segment of a URL (the gateway's execute/transaction id). */
function lastPathSegment(url: string): string | null {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean)
    return segments.length > 0 ? segments[segments.length - 1] : null
  } catch {
    return null
  }
}

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
    // TEMPORARY DEBUG LOGGING — capture the exact payload sent to the gateway.
    const successUrl = `${siteUrl}/payment/success?order_id=${encodeURIComponent(order_id)}`
    console.info("[payment] create payload", {
      order_id,
      cus_name: orderRow.contact.name,
      cus_email: orderRow.contact.email,
      amount: formatNagorikPayAmount(orderRow.total),
      success_url: successUrl,
      cancel_url: `${siteUrl}/payment/cancel?order_id=${encodeURIComponent(order_id)}`,
      webhook_url: `${siteUrl}/api/payment/webhook`,
      metadata: { order_id, user_id: user.id },
    })

    const payment = await createNagorikPayPayment({
      cus_name: orderRow.contact.name,
      cus_email: orderRow.contact.email,
      amount: formatNagorikPayAmount(orderRow.total),
      success_url: successUrl,
      cancel_url: `${siteUrl}/payment/cancel?order_id=${encodeURIComponent(order_id)}`,
      webhook_url: `${siteUrl}/api/payment/webhook`,
      order_id,
      metadata: { order_id, user_id: user.id },
    })

    // Store the gateway reference (last path segment of the execute URL,
    // e.g. /api/execute/<transactionId>) on the order so settlement can
    // find this order even when the gateway verify response carries no
    // metadata.order_id. Only touch orders still awaiting payment.
    const gatewayRef = lastPathSegment(payment.payment_url)
    if (gatewayRef) {
      const serviceClient = createServiceClient()
      const { error: refError } = await serviceClient.database
        .from("orders")
        .update({ payment_reference: gatewayRef })
        .eq("id", order_id)
        .eq("payment_status", "pending_payment")
      if (refError) {
        console.error("[payment] failed to store gateway reference", {
          order_id,
          code: (refError as { code?: string }).code,
          message: (refError as { message?: string }).message,
        })
      }
      console.info("[payment] gateway reference stored", { order_id, gatewayRef })
    } else {
      console.error("[payment] no gateway reference in payment_url", { payment_url: payment.payment_url })
    }

    return NextResponse.json({ payment_url: payment.payment_url })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    console.error("[payment] create failed:", err)
    return NextResponse.json({ error: "Payment could not be started. Please try again." }, { status: 502 })
  }
}
