// app/api/payment/webhook/route.ts
// POST: NagorikPay webhook (IPN) for server-to-server payment notifications.
// Thin wrapper around shared settlement logic with fail-closed signature check.

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/insforge-service"
import { verifyNagorikPayPayment } from "@/lib/nagorikpay"
import { verifyWebhookSignature } from "@/lib/nagorikpay-webhook"
import { settleNagorikPayTransaction } from "@/lib/payment-settlement"
import { serverError } from "@/lib/http-errors"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const timestamp = req.headers.get("x-nagorikpay-timestamp")
    const signature = req.headers.get("x-nagorikpay-signature")

    // Fail-closed: missing secret returns false (403).
    // NAGORIKPAY_WEBHOOK_SECRET is set in the deployment env. The API-key fallback
    // only triggers when the secret is unset, so it is dead in production; if it
    // ever fires, the panel secret has stopped matching and real payments will
    // stop settling through the webhook until it is regenerated.
    const webhookSecret = process.env.NAGORIKPAY_WEBHOOK_SECRET
    const isValid = verifyWebhookSignature(
      rawBody,
      timestamp,
      signature,
      webhookSecret || process.env.NAGORIKPAY_API_KEY,
    )
    if (!webhookSecret) {
      console.error("[webhook] NAGORIKPAY_WEBHOOK_SECRET unset — falling back to API key")
    }
    if (!isValid) {
      console.error("[webhook] Invalid or missing signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
    }

    // Form-urlencoded payload: transactionId, status, paymentMethod, ...
    const params = new URLSearchParams(rawBody)
    const transactionId = params.get("transactionId") || params.get("transaction_id")

    if (!transactionId) {
      // Malformed payload - permanent error, return 200 so gateway stops retrying
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
    const orderId =
      typeof result.metadata?.order_id === "string" && result.metadata.order_id
        ? result.metadata.order_id
        : undefined

    // Replay guard: a transaction may settle only one order. If another order
    // already claims this payment_reference, ignore before settling.
    if (orderId) {
      const { data: holder } = await client.database
        .from("orders").select("id").eq("payment_reference", transactionId).limit(1)
      if (holder && holder.length > 0 && holder[0].id !== orderId) {
        console.error("[webhook] transaction replay blocked", {
          transactionId,
          order_id: orderId,
          held_by: holder[0].id,
        })
        return NextResponse.json({ received: true, ignored: "transaction_already_used" }, { status: 200 })
      }
    }

    // Note: metadata.order_id is not required here — settlement falls back to
    // the payment_reference stored on the order at creation time.
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
        // Permanent condition - log and return 200
        console.error("[webhook] amount mismatch", { order_id: outcome.order_id })
        return NextResponse.json({ received: true, ignored: "amount_mismatch" }, { status: 200 })
      case "not_found":
        // Permanent condition - log and return 200
        console.error("[webhook] order not found", { transactionId })
        return NextResponse.json({ received: true, ignored: "order_not_found" }, { status: 200 })
    }
  } catch (err: unknown) {
    // Transient failures - 500 so gateway retries. Log the reason server-side only.
    return serverError("payment webhook", err)
  }
}
