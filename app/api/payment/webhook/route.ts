// app/api/payment/webhook/route.ts
// POST: RupantorPay webhook for server-to-server payment notifications.
// Verifies webhook authenticity via HMAC-SHA256 signature when RUPANTOR_PAY_WEBHOOK_SECRET is set.
// Always re-verifies payment status with the RupantorPay API before marking orders as paid.

import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/insforge-server"
import { verifyRupantorPayment } from "@/lib/rupantor"

export const dynamic = "force-dynamic"

/**
 * Verify HMAC-SHA256 webhook signature.
 * Returns true if signature is valid or if no secret is configured (graceful fallback).
 */
async function verifyWebhookSignature(
  body: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const secret = process.env.RUPANTOR_PAY_WEBHOOK_SECRET
  if (!secret) {
    // No secret configured — skip signature check (not ideal but graceful)
    console.warn("[webhook] RUPANTOR_PAY_WEBHOOK_SECRET not set — skipping signature verification")
    return true
  }
  if (!signatureHeader) return false

  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    )

    // Decode the expected signature from hex
    const sigBytes = new Uint8Array(
      signatureHeader.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
    )

    const bodyBytes = encoder.encode(body)
    return await crypto.subtle.verify("HMAC", key, sigBytes, bodyBytes)
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  try {
    // Verify webhook signature
    const rawBody = await req.text()
    const signature = req.headers.get("x-signature") || req.headers.get("x-webhook-signature")

    const isValid = await verifyWebhookSignature(rawBody, signature)
    if (!isValid) {
      console.error("[webhook] Invalid signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
    }

    const body = JSON.parse(rawBody)
    const { transaction_id } = body

    if (!transaction_id) {
      return NextResponse.json({ error: "transaction_id required" }, { status: 400 })
    }

    // Verify with RupantorPay API (always re-verify, never trust the webhook payload alone)
    const result = await verifyRupantorPayment(transaction_id)

    const client = await createServerClient()

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
      // Already processed
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
          payment_reference: transaction_id,
        })
        .eq("id", order.id)

      // Log payment event
      await client.database.from("payment_events").insert({
        provider: "rupantor",
        provider_transaction_id: transaction_id,
        order_id: order.id,
        status: "completed",
        verified: true,
      })
    }

    return NextResponse.json({ received: true })
  } catch (err: unknown) {
    console.error("Webhook error:", err)
    const message = err instanceof Error ? err.message : "Webhook processing failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
