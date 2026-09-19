// app/api/payment/verify/route.ts
// GET: Verify RupantorPay payment after customer redirect.

import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/insforge-server"
import { verifyRupantorPayment } from "@/lib/rupantor"

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
    const transactionId = searchParams.get("transaction_id")

    if (!transactionId) {
      return NextResponse.json({ error: "transaction_id required" }, { status: 400 })
    }

    // Verify with RupantorPay
    const result = await verifyRupantorPayment(transactionId)

    const client = await createServerClient()

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
      // Already processed
      return NextResponse.json({ status: "paid", order_id: order.id })
    }

    if (result.status === "COMPLETED") {
      // R7: Verify payment amount matches order total
      const paidAmount = Number(result.amount)
      if (paidAmount < order.total) {
        console.error(`Payment amount mismatch: paid ${paidAmount}, expected ${order.total}`)
        return NextResponse.json({ error: "Payment amount does not match order total" }, { status: 400 })
      }

      // Update order to paid
      const { error: updateError } = await client.database
        .from("orders")
        .update({
          payment_status: "paid",
          payment_reference: transactionId,
        })
        .eq("id", order.id)

      if (updateError) {
        console.error("Failed to update order:", updateError)
        return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
      }

      // Log payment event
      await client.database.from("payment_events").insert({
        provider: "rupantor",
        provider_transaction_id: transactionId,
        order_id: order.id,
        status: "completed",
        verified: true,
      })

      return NextResponse.json({ status: "paid", order_id: order.id })
    }

    return NextResponse.json({ status: "failed", order_id: order.id })
  } catch (err: unknown) {
    console.error("Verify error:", err)
    const message = err instanceof Error ? err.message : "Verification failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
