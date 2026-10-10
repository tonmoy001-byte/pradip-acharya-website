// app/api/payment/verify/route.ts
// GET: Verify a NagorikPay payment after the customer redirect.
// Thin wrapper around shared settlement logic.

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/insforge-service"
import { verifyNagorikPayPayment } from "@/lib/nagorikpay"
import { settleNagorikPayTransaction } from "@/lib/payment-settlement"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const transactionId =
      searchParams.get("transactionId") || searchParams.get("transaction_id")

    if (!transactionId) {
      return NextResponse.json({ error: "transactionId required" }, { status: 400 })
    }

    // Verify with NagorikPay
    let result
    try {
      result = await verifyNagorikPayPayment(transactionId)
    } catch (verifyErr) {
      console.error("NagorikPay verify unavailable:", verifyErr)
      return NextResponse.json(
        { status: "error", error: "verification_unavailable" },
        { status: 502 },
      )
    }

    const client = createServiceClient()
    const orderId = result.metadata?.order_id

    const outcome = await settleNagorikPayTransaction({
      client,
      transactionId,
      gateway: result,
      orderId,
    })

    // Map SettleOutcome to HTTP response
    switch (outcome.kind) {
      case "paid":
        return NextResponse.json({
          status: "paid",
          order_id: outcome.order_id,
          download_ready: outcome.download_ready,
        })
      case "pending":
        return NextResponse.json({ status: "pending", order_id: outcome.order_id })
      case "failed":
        return NextResponse.json({ status: "failed", order_id: outcome.order_id })
      case "amount_mismatch":
        return NextResponse.json({ error: "Payment amount does not match order total" }, { status: 400 })
      case "not_found":
        return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
  } catch (err: unknown) {
    console.error("Verify error:", err)
    const message = err instanceof Error ? err.message : "Verification failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}