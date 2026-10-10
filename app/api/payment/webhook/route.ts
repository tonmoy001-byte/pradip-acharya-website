// app/api/payment/webhook/route.ts
// POST: NagorikPay webhook (IPN) for server-to-server payment notifications.
//
// NagorikPay sends form-urlencoded fields (transactionId, status, …) and signs
// the raw body with HMAC-SHA256: message = timestamp + "." + rawBody.
// Signing key is NAGORIKPAY_WEBHOOK_SECRET when set, else the brand API key.
// Always re-verifies payment status with the NagorikPay API before marking
// orders as paid.

import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/insforge-service"
import { verifyNagorikPayPayment } from "@/lib/nagorikpay"

export const dynamic = "force-dynamic"

const REPLAY_WINDOW_SECONDS = 300

/**
 * Verify NagorikPay HMAC-SHA256 webhook signature.
 * Signed message is `timestamp + "." + rawBody` (form-urlencoded bytes).
 */
function verifyWebhookSignature(
  rawBody: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.NAGORIKPAY_WEBHOOK_SECRET || process.env.NAGORIKPAY_API_KEY
  if (!secret) {
    console.warn("[webhook] no NAGORIKPAY_WEBHOOK_SECRET or API key — skipping signature verification")
    return true
  }
  if (!timestampHeader || !signatureHeader) return false

  const timestamp = Number(timestampHeader)
  if (!Number.isFinite(timestamp)) return false
  if (Math.abs(Date.now() / 1000 - timestamp) > REPLAY_WINDOW_SECONDS) return false

  // Header format: sha256=<hex>
  const givenHex = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader

  const expected = createHmac("sha256", secret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest("hex")

  if (givenHex.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(givenHex, "utf8"), Buffer.from(expected, "utf8"))
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const timestamp = req.headers.get("x-nagorikpay-timestamp")
    const signature = req.headers.get("x-nagorikpay-signature")

    const isValid = verifyWebhookSignature(rawBody, timestamp, signature)
    if (!isValid) {
      console.error("[webhook] Invalid signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
    }

    // Form-urlencoded payload: transactionId, status, paymentMethod, …
    const params = new URLSearchParams(rawBody)
    const transactionId = params.get("transactionId") || params.get("transaction_id")

    if (!transactionId) {
      return NextResponse.json({ error: "transactionId required" }, { status: 400 })
    }

    // Verify with NagorikPay API (always re-verify, never trust the webhook payload alone)
    const result = await verifyNagorikPayPayment(transactionId)

    const client = createServiceClient()

    // Find order
    const orderId = result.metadata?.order_id
    if (!orderId) {
      return NextResponse.json({ error: "No order_id in metadata" }, { status: 400 })
    }

    const { data: orders, error: findError } = await client.database
      .from("orders")
      .select("id, payment_status, total")
      .eq("id", orderId)
      .limit(1)

    if (findError || !orders || orders.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const order = orders[0] as { id: string; payment_status: string; total: number }

    if (order.payment_status === "paid") {
      // Already settled. Fulfillment is idempotent, so this also covers the
      // case where the first settlement granted nothing.
      await client.database.rpc("fulfill_paid_order", {
        p_order_id: order.id,
        p_payment_reference: transactionId,
      })
      return NextResponse.json({ received: true })
    }

    if (result.status === "COMPLETED") {
      // Verify payment amount matches order total
      const paidAmount = Number(result.amount)
      if (paidAmount < order.total) {
        console.error(`[webhook] Payment amount mismatch: paid ${paidAmount}, expected ${order.total}`)
        return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 })
      }

      // Update order
      await client.database
        .from("orders")
        .update({
          payment_status: "paid",
          payment_reference: transactionId,
          paid_at: new Date().toISOString(),
        })
        .eq("id", order.id)

      // Log payment event
      await client.database.from("payment_events").insert({
        provider: "nagorikpay",
        provider_transaction_id: transactionId,
        order_id: order.id,
        status: "completed",
        verified: true,
      })

      // Release the files immediately — no admin approval in the loop. This is
      // the server-to-server path, so it settles the order even if the buyer
      // closes the tab before the redirect completes.
      const { error: fulfillError } = await client.database.rpc("fulfill_paid_order", {
        p_order_id: order.id,
        p_payment_reference: transactionId,
      })
      if (fulfillError) {
        console.error("[payment] fulfillment failed", { order_id: order.id })
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: unknown) {
    console.error("Webhook error:", err)
    const message = err instanceof Error ? err.message : "Webhook processing failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
