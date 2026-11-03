// app/api/payment/create/route.ts
// POST: Initiate NagorikPay payment for an order.
//
// Idempotent: reuses a live payment attempt, rejects paid/terminal orders,
// and atomically claims a new attempt via begin_payment_attempt() so parallel
// requests cannot create two gateway sessions.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { createServiceClient } from "@/lib/insforge-service"
import { createNagorikPayPayment, formatNagorikPayAmount } from "@/lib/nagorikpay"
import { paymentUrls } from "@/lib/payment-urls"
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

    if (orderRow.payment_status !== "pending_payment" && orderRow.payment_status !== "payment_review") {
      return NextResponse.json({ error: "Order already processed" }, { status: 409 })
    }

    if (!(Number(orderRow.total) > 0)) {
      return NextResponse.json({ error: "Nothing to pay for this order" }, { status: 400 })
    }

    // Atomic claim / reuse / in-progress decision.
    const { data: claim, error: claimError } = await client.database.rpc("begin_payment_attempt", {
      p_order_id: order_id,
    })

    if (claimError || !claim) {
      console.error("[payment] begin_payment_attempt failed", { order_id, message: claimError?.message })
      return NextResponse.json({ error: "Payment could not be started. Please try again." }, { status: 500 })
    }

    const claimRow = claim as { action: string; attempt_id?: string; payment_url?: string; reason?: string }

    if (claimRow.action === "reuse" && claimRow.payment_url) {
      return NextResponse.json({ payment_url: claimRow.payment_url })
    }

    if (claimRow.action === "in_progress") {
      return NextResponse.json({ error: "payment_in_progress", order_id }, { status: 409 })
    }

    if (claimRow.action === "rejected") {
      return NextResponse.json({ error: "Order already processed" }, { status: 409 })
    }

    if (claimRow.action !== "claimed" || !claimRow.attempt_id) {
      return NextResponse.json({ error: "Payment could not be started. Please try again." }, { status: 500 })
    }

    const attemptId = claimRow.attempt_id

    const urls = paymentUrls(order_id)
    const successUrl = urls.success

    let payment
    try {
      payment = await createNagorikPayPayment({
        cus_name: orderRow.contact.name,
        cus_email: orderRow.contact.email,
        amount: formatNagorikPayAmount(orderRow.total),
        success_url: successUrl,
        cancel_url: urls.cancel,
        webhook_url: urls.webhook,
        order_id,
        metadata: { order_id, user_id: user.id, attempt_id: attemptId },
      })
    } catch (err) {
      // Mark the claimed attempt failed so a retry is possible.
      const serviceClient = createServiceClient()
      await serviceClient.database
        .from("payment_attempts")
        .update({ status: "failed" })
        .eq("id", attemptId)
        .eq("status", "pending")
      throw err
    }

    const gatewayRef = lastPathSegment(payment.payment_url)

    const serviceClient = createServiceClient()
    const updatePayload: Record<string, unknown> = {
      status: "pending",
      payment_url: payment.payment_url,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }
    if (gatewayRef) updatePayload.provider_transaction_id = gatewayRef
    await serviceClient.database
      .from("payment_attempts")
      .update(updatePayload)
      .eq("id", attemptId)

    // Backward-compat: keep orders.payment_reference while unpaid so legacy
    // settlement (no attempt row) can still resolve. Never overwrite on paid.
    if (gatewayRef) {
      await serviceClient.database
        .from("orders")
        .update({ payment_reference: gatewayRef })
        .eq("id", order_id)
        .eq("payment_status", "pending_payment")
    }

    return NextResponse.json({ payment_url: payment.payment_url })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    console.error("[payment] create failed:", err)
    return NextResponse.json({ error: "Payment could not be started. Please try again." }, { status: 502 })
  }
}
