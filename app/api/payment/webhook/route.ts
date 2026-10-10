// app/api/payment/webhook/route.ts
// POST: NagorikPay webhook (IPN) for server-to-server payment notifications.
// Thin wrapper around shared settlement logic with fail-closed signature check.

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/insforge-service"
import { verifyNagorikPayPayment } from "@/lib/nagorikpay"
import { verifyWebhookSignature } from "@/lib/nagorikpay-webhook"
import { settleNagorikPayTransaction } from "@/lib/payment-settlement"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const timestamp = req.headers.get("x-nagorikpay-timestamp")
    const signature = req.headers.get("x-nagorikpay-signature")

    // Fail-closed: missing secret returns false (403)
    const isValid = verifyWebhookSignature(
      rawBody,
      timestamp,
      signature,
      process.env.NAGORIKPAY_WEBHOOK_SECRET || process.env.NAGORIKPAY_API_KEY,
    )
    if (!isValid) {
      console.error("[webhook] Invalid or missing signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
    }

    // Form-urlencoded payload: transactionId, status, paymentMethod, …
    const params = new URLSearchParams(rawBody)
    const transactionId = params.get("transactionId") || params.get("transaction_id")

    if (!transactionId) {
      // Malformed payload — permanent error, return 200 so gateway stops retrying
      return NextResponse.json({ received: true, ignored: "missing_transactionId" }, { status: 200 })
    }

    // Verify with NagorikPay API (always re-verify, never trust the webhook payload alone)
    let result
    try {
      result = await verifyNagorikPayPayment(transactionId)
    } catch (verifyErr) {
      console.error("[webhook] NagorikPay verify unavailable:", verifyErr)
      return NextResponse.json({ error: "verification_unavailable" }, { status: 500 })
    }

    const client = createServiceClient()
    const orderId = result.metadata?.order_id

    if (!orderId) {
      // No order_id in metadata — permanent condition, return 200
      return NextResponse.json({ received: true, ignored: "no_order_id_in_metadata" }, { status: 200 })
    }

    const outcome = await settleNagorikPayTransaction({
      client,
      transactionId,
      gateway: result,
      orderId,
    })

    // Map outcome to webhook response codes
    switch (outcome.kind) {
      case "paid":
        return NextResponse.json({ received: true })
      case "pending":
        return NextResponse.json({ received: true })
      case "failed":
        return NextResponse.json({ received: true })
      case "amount_mismatch":
        // Permanent condition — log and return 200
        console.error("[webhook] amount mismatch", { order_id: outcome.order_id })
        return NextResponse.json({ received: true, ignored: "amount_mismatch" }, { status: 200 })
      case "not_found":
        // Permanent condition — log and return 200
        console.error("[webhook] order not found", { transactionId })
        return NextResponse.json({ received: true, ignored: "order_not_found" }, { status: 200 })
    }
  } catch (err: unknown) {
    console.error("Webhook error:", err)
    const message = err instanceof Error ? err.message : "Webhook processing failed"
    // Transient failures → 500 so gateway retries
    return NextResponse.json({ error: message }, { status: 500 })
  }
}