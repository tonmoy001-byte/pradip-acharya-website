import { createServiceClient } from "@/lib/insforge-service"
import { verifyNagorikPayPayment } from "@/lib/nagorikpay"
import { classifyGatewayStatus } from "@/lib/payment-status"
import { sanitizePostgREST } from "./sanitize-postgrest"

export interface NagorikPayVerifyResult {
  cus_name: string
  cus_email: string
  amount: string
  transaction_id: string
  payment_method: string
  status: string
  metadata?: Record<string, unknown>
}

export type SettleOutcome =
  | { kind: "paid"; order_id: string; download_ready: boolean }
  | { kind: "pending"; order_id: string }
  | { kind: "failed"; order_id: string }
  | { kind: "amount_mismatch"; order_id: string }
  | { kind: "not_found" }

/** Service client type returned by createServiceClient() — intentionally loose. */
export type ServiceClient = any

/**
 * Locate order, verify amount, update status, log event, fulfill.
 * Idempotent: safe to call repeatedly for the same transaction.
 */
export async function settleNagorikPayTransaction(args: {
  client: ServiceClient
  transactionId: string
  gateway: NagorikPayVerifyResult
  orderId?: string
}): Promise<SettleOutcome> {
  const { client, transactionId, gateway, orderId } = args

  // Find order by transaction_id in metadata or payment_reference
  const safeTxnId = sanitizePostgREST(transactionId)
  const safeOrderId = orderId ? sanitizePostgREST(orderId) : (gateway.metadata?.order_id ? sanitizePostgREST(gateway.metadata.order_id as string) : "")

  const filter = safeOrderId
    ? `payment_reference.eq.${safeTxnId},id.eq.${safeOrderId}`
    : `payment_reference.eq.${safeTxnId}`

  const { data: orders, error: findError } = await client.database
    .from("orders")
    .select("id, payment_status, total")
    .or(filter)
    .limit(1)

  if (findError || !orders || orders.length === 0) {
    return { kind: "not_found" }
  }

  const order = orders[0] as { id: string; payment_status: string; total: number }

  // Already paid: re-run fulfillment (idempotent repair)
  if (order.payment_status === "paid") {
    const { error: fulfillError } = await client.database.rpc("fulfill_paid_order", {
      p_order_id: order.id,
      p_payment_reference: transactionId,
    })
    if (fulfillError) {
      console.error("[payment] fulfillment failed", { order_id: order.id })
      return { kind: "paid", order_id: order.id, download_ready: false }
    }
    return { kind: "paid", order_id: order.id, download_ready: true }
  }

  const gatewayOutcome = classifyGatewayStatus(gateway.status)

  if (gatewayOutcome === "pending") {
    // Bank-transfer/QR payments start as PENDING and complete later.
    // Set payment_status to 'payment_review' only when still pending_payment
    // to prevent a second payment from being started for this order.
    if (order.payment_status === "pending_payment") {
      await client.database
        .from("orders")
        .update({
          payment_status: "payment_review",
          payment_reference: transactionId,
        })
        .eq("id", order.id)
        .eq("payment_status", "pending_payment")
    }
    return { kind: "pending", order_id: order.id }
  }

  if (gatewayOutcome === "failed") {
    return { kind: "failed", order_id: order.id }
  }

  // paid outcome
  if (gatewayOutcome === "paid") {
    const paidAmount = Number(gateway.amount)
    if (paidAmount < order.total) {
      console.error(`Payment amount mismatch: paid ${paidAmount}, expected ${order.total}`)
      return { kind: "amount_mismatch", order_id: order.id }
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
      throw new Error("Failed to update order")
    }

    // Log payment event — ignore unique violation (duplicate webhook)
    try {
      await client.database.from("payment_events").insert({
        provider: "nagorikpay",
        provider_transaction_id: transactionId,
        order_id: order.id,
        status: "completed",
        verified: true,
      })
    } catch (e: any) {
      // PostgREST unique violation code 23505 — treat as success
      if (e?.code === "23505") {
        // duplicate event, already logged
      } else {
        throw e
      }
    }

    // Release the files
    const { error: fulfillError } = await client.database.rpc("fulfill_paid_order", {
      p_order_id: order.id,
      p_payment_reference: transactionId,
    })

    if (fulfillError) {
      console.error("[payment] fulfillment failed", { order_id: order.id })
      return { kind: "paid", order_id: order.id, download_ready: false }
    }

    return { kind: "paid", order_id: order.id, download_ready: true }
  }

  return { kind: "failed", order_id: order.id }
}