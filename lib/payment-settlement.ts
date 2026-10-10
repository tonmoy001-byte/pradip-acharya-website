// lib/payment-settlement.ts
// Shared NagorikPay settlement logic used by the verify route and the
// webhook. Both must agree on every rule below, so the logic lives here
// exactly once.
//
// Settlement rules:
//   * The gateway is re-verified server-side first; the webhook payload
//     alone is never trusted.
//   * The order is located by the order_id we put in the gateway
//     metadata, then by the payment_reference we stored — never by a
//     loose .or() match that could hit the wrong row.
//   * A paid outcome requires a real, finite gateway amount that covers
//     the order total (compared against the rounded amount we sent to
//     the gateway, so 150.00 vs 150 cannot fail).
//   * metadata.user_id must match the order's owner.
//   * Only pending_payment and payment_review orders can move to paid.
//     A pending gateway status moves pending_payment → payment_review; a
//     later failed status moves a stuck payment_review order back to
//     pending_payment so the customer can pay again.
//   * Fulfillment is idempotent: re-running it for an already-paid
//     order is a safe no-op.

import { formatNagorikPayAmount } from "@/lib/nagorikpay"
import { classifyGatewayStatus } from "@/lib/payment-status"

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

interface OrderRow {
  id: string
  user_id: string
  payment_status: string
  total: number
}

const ORDER_COLUMNS = "id, user_id, payment_status, total"

/**
 * True only when the gateway amount is a real number that covers what we
 * asked for. Number("abc") and Number(undefined) are NaN, and NaN < x is
 * false — which is why the naive comparison used to mark underpaid (or
 * missing) amounts as paid.
 */
export function amountCoversOrder(gatewayAmount: unknown, orderTotal: unknown): boolean {
  const paid = Number(gatewayAmount)
  const total = Number(orderTotal)
  if (!Number.isFinite(paid) || !Number.isFinite(total) || total < 0) return false
  // Compare against exactly what we sent to the gateway (rounded to 2 decimals).
  const expected = Number(formatNagorikPayAmount(total))
  return paid >= expected
}

async function findOrder(
  client: ServiceClient,
  transactionId: string,
  orderId?: string,
): Promise<OrderRow | null> {
  // 1) By order id from the gateway metadata (we set it ourselves when creating the payment).
  if (orderId) {
    const { data } = await client.database
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("id", orderId)
      .limit(1)
    if (data && data.length > 0) return data[0] as OrderRow
  }
  // 2) By the payment reference we stored earlier.
  const { data } = await client.database
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("payment_reference", transactionId)
    .limit(1)
  return data && data.length > 0 ? (data[0] as OrderRow) : null
}

async function fulfill(client: ServiceClient, order: OrderRow, transactionId: string): Promise<SettleOutcome> {
  const { error } = await client.database.rpc("fulfill_paid_order", {
    p_order_id: order.id,
    p_payment_reference: transactionId,
  })
  if (error) {
    console.error("[payment] fulfillment failed", { order_id: order.id })
    return { kind: "paid", order_id: order.id, download_ready: false }
  }
  return { kind: "paid", order_id: order.id, download_ready: true }
}

export async function settleNagorikPayTransaction(args: {
  client: ServiceClient
  transactionId: string
  gateway: NagorikPayVerifyResult
  orderId?: string
}): Promise<SettleOutcome> {
  const { client, transactionId, gateway } = args
  const orderId = args.orderId ?? (gateway.metadata?.order_id as string | undefined)

  const order = await findOrder(client, transactionId, orderId)
  if (!order) return { kind: "not_found" }

  // The payment must belong to this order's owner (we put user_id in the metadata).
  const metaUser = gateway.metadata?.user_id
  if (typeof metaUser === "string" && metaUser !== order.user_id) {
    console.error("[payment] metadata user mismatch", { order_id: order.id })
    return { kind: "not_found" }
  }

  // Already paid: re-run fulfillment (safe to repeat).
  if (order.payment_status === "paid") return fulfill(client, order, transactionId)

  const outcome = classifyGatewayStatus(gateway.status)

  if (outcome === "pending") {
    if (order.payment_status === "pending_payment") {
      await client.database
        .from("orders")
        .update({ payment_status: "payment_review", payment_reference: transactionId })
        .eq("id", order.id)
        .eq("payment_status", "pending_payment")
    }
    return { kind: "pending", order_id: order.id }
  }

  if (outcome === "failed") {
    // Put a stuck order back so the customer can pay again.
    if (order.payment_status === "payment_review") {
      await client.database
        .from("orders")
        .update({ payment_status: "pending_payment", payment_reference: null })
        .eq("id", order.id)
        .eq("payment_status", "payment_review")
    }
    return { kind: "failed", order_id: order.id }
  }

  if (outcome !== "paid") return { kind: "failed", order_id: order.id }

  // ---- paid ----
  if (!amountCoversOrder(gateway.amount, order.total)) {
    console.error("[payment] amount mismatch", { order_id: order.id, paid: gateway.amount, expected: order.total })
    return { kind: "amount_mismatch", order_id: order.id }
  }

  // Only move forward from the two "waiting" states, never from anything else.
  const { data: updated, error: updateError } = await client.database
    .from("orders")
    .update({
      payment_status: "paid",
      payment_reference: transactionId,
      paid_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .in("payment_status", ["pending_payment", "payment_review"])
    .select("id")

  if (updateError) {
    console.error("[payment] failed to update order", { order_id: order.id })
    throw new Error("Failed to update order")
  }

  if (!updated || updated.length === 0) {
    // Another request settled it first, or the order is in a state we must not pay.
    const { data: again } = await client.database
      .from("orders").select("payment_status").eq("id", order.id).limit(1)
    if (again?.[0]?.payment_status !== "paid") return { kind: "failed", order_id: order.id }
  }

  // Log the payment event. A duplicate (unique violation 23505) is fine —
  // the SDK reports errors as { error }, not by throwing.
  const { error: eventError } = await client.database.from("payment_events").insert({
    provider: "nagorikpay",
    provider_transaction_id: transactionId,
    order_id: order.id,
    status: "completed",
    verified: true,
  })
  if (eventError && (eventError as { code?: string }).code !== "23505") {
    console.error("[payment] could not log payment event", { order_id: order.id })
  }

  return fulfill(client, order, transactionId)
}
