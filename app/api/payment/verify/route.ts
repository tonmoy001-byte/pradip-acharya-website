// app/api/payment/verify/route.ts
// GET: Verify a NagorikPay payment after the customer redirect.
//
// This is the settlement path. Once NagorikPay confirms the transaction as
// COMPLETED and the amount covers the order total, the order is marked paid and
// `fulfill_paid_order` immediately issues the download grants — there is no
// waiting on a human admin, so the buyer can download the moment they land back
// on the site.
//
// NagorikPay redirects append `transactionId` (camelCase). Accept the legacy
// snake_case `transaction_id` as well so older bookmarks keep working.
//
// Writes go through the service client because the `orders` table has no
// non-admin UPDATE policy: the customer's own JWT cannot mark their order paid.

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/insforge-service"
import { verifyNagorikPayPayment } from "@/lib/nagorikpay"

export const dynamic = "force-dynamic"

/**
 * Sanitize input for use in PostgREST .or() filter.
 * Escapes characters that could alter the filter expression.
 */
function sanitizePostgREST(input: string): string {
  return input
    .replace(/%/g, "%25")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/,/g, "%2C")
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const transactionId =
      searchParams.get("transactionId") || searchParams.get("transaction_id")

    if (!transactionId) {
      return NextResponse.json({ error: "transactionId required" }, { status: 400 })
    }

    // Verify with NagorikPay
    const result = await verifyNagorikPayPayment(transactionId)

    const client = createServiceClient()

    // Sanitize inputs before interpolating into PostgREST .or() filter
    const safeTxnId = sanitizePostgREST(transactionId)
    const safeOrderId = result.metadata?.order_id ? sanitizePostgREST(result.metadata.order_id) : ""

    // Find order by transaction_id in metadata or payment_reference
    const filter = safeOrderId
      ? `payment_reference.eq.${safeTxnId},id.eq.${safeOrderId}`
      : `payment_reference.eq.${safeTxnId}`

    const { data: orders, error: findError } = await client.database
      .from("orders")
      .select("id, payment_status, total")
      .or(filter)
      .limit(1)

    if (findError || !orders || orders.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const order = orders[0] as { id: string; payment_status: string; total: number }

    if (order.payment_status === "paid") {
      // Already settled by the webhook or an earlier visit. Re-running
      // fulfillment is idempotent and repairs the case where the first
      // settlement marked the order paid but never issued the grants.
      const { data: repaired } = await client.database.rpc("fulfill_paid_order", {
        p_order_id: order.id,
        p_payment_reference: transactionId,
      })
      return NextResponse.json({ status: "paid", order_id: order.id, ...(repaired as object) })
    }

    if (result.status === "COMPLETED") {
      // R7: Verify payment amount matches order total
      const paidAmount = Number(result.amount)
      if (paidAmount < order.total) {
        console.error(`Payment amount mismatch: paid ${paidAmount}, expected ${order.total}`)
        return NextResponse.json({ error: "Payment amount does not match order total" }, { status: 400 })
      }

      const { error: updateError } = await client.database
        .from("orders")
        .update({
          payment_status: "paid",
          payment_reference: transactionId,
          paid_at: new Date().toISOString(),
        })
        .eq("id", order.id)

      if (updateError) {
        console.error("Failed to update order:", updateError)
        return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
      }

      // Log payment event
      await client.database.from("payment_events").insert({
        provider: "nagorikpay",
        provider_transaction_id: transactionId,
        order_id: order.id,
        status: "completed",
        verified: true,
      })

      // Release the files immediately — no admin approval in the loop.
      const { data: fulfillment, error: fulfillError } = await client.database.rpc("fulfill_paid_order", {
        p_order_id: order.id,
        p_payment_reference: transactionId,
      })

      if (fulfillError) {
        console.error("Fulfillment failed:", fulfillError)
        return NextResponse.json({ status: "paid", order_id: order.id, download_ready: false }, { status: 200 })
      }

      return NextResponse.json({ status: "paid", order_id: order.id, ...(fulfillment as object) })
    }

    return NextResponse.json({ status: "failed", order_id: order.id })
  } catch (err: unknown) {
    console.error("Verify error:", err)
    const message = err instanceof Error ? err.message : "Verification failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
