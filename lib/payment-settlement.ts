// lib/payment-settlement.ts
// Shared NagorikPay settlement logic used by the verify route and the
// webhook. Both must agree on every rule below, so the logic lives here
// exactly once.
//
// Settlement rules:
//   * The gateway is re-verified server-side first; the webhook payload
//     alone is never trusted.
//   * The order is located by payment_attempts (txn), then orders.payment_reference,
//     then gateway metadata.order_id. Never by email/amount/book.
//   * A paid outcome requires a real, finite gateway amount that covers
//     the order total (compared against the rounded amount we sent).
//   * metadata.user_id (and attempt.user_id) must match the order owner.
//   * Only pending_payment and payment_review orders can move to paid.
//     A pending gateway status moves pending_payment -> payment_review; a
//     later failed status moves a stuck payment_review order back to
//     pending_payment so the customer can pay again.
//   * Fulfillment is idempotent: re-running it for an already-paid
//     order is a safe no-op.
//   * A different successful transaction on an already-paid order is
//     recorded as duplicate/refund_required: original reference preserved,
//     no new grant.

import { formatNagorikPayAmount } from "@/lib/nagorikpay"
import { classifyGatewayStatus } from "@/lib/payment-status"
import { deliverGuestOrderEmail } from "@/lib/guest-delivery"

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
  | { kind: "duplicate"; order_id: string }
  | { kind: "amount_mismatch"; order_id: string }
  | { kind: "not_found" }

/** Service client type returned by createServiceClient() — intentionally loose. */
export type ServiceClient = any

interface OrderRow {
  id: string
  user_id: string | null
  payment_status: string
  total: number
  payment_reference: string | null
  currency: string
  contact: { name?: string; email?: string; phone?: string } | null
}

interface AttemptRow {
  id: string
  order_id: string
  user_id: string | null
  status: string
  provider_transaction_id: string | null
}

const ORDER_COLUMNS =
  "id, user_id, payment_status, total, payment_reference, currency, contact"

// The NagorikPay verify response does not include a currency field, so we
// cannot compare currency here. The store is BDT-only; if a multi-currency
// gateway is ever introduced, add a currency check before marking paid.
export function amountCoversOrder(gatewayAmount: unknown, orderTotal: unknown): boolean {
  const paid = Number(gatewayAmount)
  const total = Number(orderTotal)
  if (!Number.isFinite(paid) || !Number.isFinite(total) || total < 0) return false
  const expected = Number(formatNagorikPayAmount(total))
  return paid >= expected
}

async function findAttemptByTxn(client: ServiceClient, transactionId: string): Promise<AttemptRow | null> {
  const { data } = await client.database
    .from("payment_attempts")
    .select("id, order_id, user_id, status, provider_transaction_id")
    .eq("provider", "nagorikpay")
    .eq("provider_transaction_id", transactionId)
    .limit(1)
  return data && data.length > 0 ? (data[0] as AttemptRow) : null
}

async function findOrder(client: ServiceClient, transactionId: string, orderId?: string, attempt?: AttemptRow | null): Promise<OrderRow | null> {
  // 1) Attempt binding (authoritative).
  if (attempt?.order_id) {
    const { data } = await client.database
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("id", attempt.order_id)
      .limit(1)
    if (data && data.length > 0) return data[0] as OrderRow
  }
  // 2) orders.payment_reference (legacy / pre-attempt).
  const { data: byRef } = await client.database
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("payment_reference", transactionId)
    .limit(1)
  if (byRef && byRef.length > 0) return byRef[0] as OrderRow
  // 3) gateway metadata order_id, only if no conflicting binding.
  if (orderId && !attempt) {
    const { data } = await client.database
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("id", orderId)
      .limit(1)
    if (data && data.length > 0) return data[0] as OrderRow
  }
  return null
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

  // Guest orders get their download link by email. The lease makes this safe
  // to retry from both verify and webhook: only one caller sends, and a failed
  // send is released for the next settlement attempt.
  if (order.user_id === null) {
    try {
      await deliverGuestOrderEmail(client, order)
    } catch (err) {
      console.error("[payment] guest delivery failed", {
        order_id: order.id,
        message: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  return { kind: "paid", order_id: order.id, download_ready: true }
}

async function ensureAttempt(client: ServiceClient, order: OrderRow, transactionId: string, attempt: AttemptRow | null, status: string): Promise<AttemptRow | null> {
  if (attempt) return attempt
  // Backfill a row for pre-migration transactions.
  const { data } = await client.database
    .from("payment_attempts")
    .insert({
      order_id: order.id,
      user_id: order.user_id,
      provider: "nagorikpay",
      provider_transaction_id: transactionId,
      status,
      amount: order.total,
      currency: order.currency || "BDT",
      completed_at: status === "paid" ? new Date().toISOString() : null,
    })
    .select("id, order_id, user_id, status, provider_transaction_id")
    .limit(1)
  // Unique violation -> fetch existing.
  if (!data || data.length === 0) {
    return findAttemptByTxn(client, transactionId)
  }
  return data[0] as AttemptRow
}

export async function settleNagorikPayTransaction(args: {
  client: ServiceClient
  transactionId: string
  gateway: NagorikPayVerifyResult
  orderId?: string
}): Promise<SettleOutcome> {
  const { client, transactionId, gateway } = args
  const orderId = args.orderId ?? (gateway.metadata?.order_id as string | undefined)

  const attempt = await findAttemptByTxn(client, transactionId)
  const order = await findOrder(client, transactionId, orderId, attempt)
  if (!order) return { kind: "not_found" }

  // Ownership checks.
  const metaUser = gateway.metadata?.user_id
  if (typeof metaUser === "string" && order.user_id && metaUser !== order.user_id) {
    console.error("[payment] metadata user mismatch", { order_id: order.id })
    return { kind: "not_found" }
  }
  if (attempt && attempt.user_id !== order.user_id) {
    console.error("[payment] attempt user mismatch", { order_id: order.id })
    return { kind: "not_found" }
  }

  // Already paid: idempotent handling.
  if (order.payment_status === "paid") {
    if (order.payment_reference === transactionId || attempt?.status === "paid" || !order.payment_reference) {
      return fulfill(client, order, transactionId)
    }

    // Different successful transaction on a paid order -> duplicate/refund_required.
    const outcome = classifyGatewayStatus(gateway.status)
    if (outcome === "paid") {
      const att = await ensureAttempt(client, order, transactionId, attempt, "refund_required")
      let duplicateOf: string | null = null
      if (order.payment_reference) {
        const orig = await findAttemptByTxn(client, order.payment_reference)
        duplicateOf = orig?.id ?? null
      }
      if (att) {
        await client.database
          .from("payment_attempts")
          .update({
            status: "refund_required",
            duplicate_of_attempt_id: duplicateOf,
            raw_payload: gateway as unknown as Record<string, unknown>,
          })
          .eq("id", att.id)
      }
      const { error: evErr } = await client.database.from("payment_events").insert({
        provider: "nagorikpay",
        provider_transaction_id: transactionId,
        order_id: order.id,
        status: "duplicate",
        verified: true,
        raw_payload: gateway as unknown as Record<string, unknown>,
      })
      if (evErr && (evErr as { code?: string }).code !== "23505") {
        console.error("[payment] could not log duplicate event", { order_id: order.id })
      }
      return { kind: "duplicate", order_id: order.id }
    }
    // Not a paid outcome: record event, do not touch order.
    await client.database.from("payment_events").insert({
      provider: "nagorikpay",
      provider_transaction_id: transactionId,
      order_id: order.id,
      status: outcome === "pending" ? "pending" : "failed",
      verified: true,
    })
    return { kind: outcome === "pending" ? "pending" : "failed", order_id: order.id }
  }

  const outcome = classifyGatewayStatus(gateway.status)

  if (outcome === "pending") {
    if (order.payment_status === "pending_payment") {
      await client.database
        .from("orders")
        .update({ payment_status: "payment_review", payment_reference: transactionId })
        .eq("id", order.id)
        .eq("payment_status", "pending_payment")
    }
    const att = await ensureAttempt(client, order, transactionId, attempt, "pending")
    if (att) {
      await client.database
        .from("payment_attempts")
        .update({ status: "pending", provider_transaction_id: transactionId })
        .eq("id", att.id)
    }
    await client.database.from("payment_events").insert({
      provider: "nagorikpay",
      provider_transaction_id: transactionId,
      order_id: order.id,
      status: "pending",
      verified: true,
    })
    return { kind: "pending", order_id: order.id }
  }

  if (outcome === "failed") {
    if (order.payment_status === "payment_review") {
      await client.database
        .from("orders")
        .update({ payment_status: "pending_payment", payment_reference: null })
        .eq("id", order.id)
        .eq("payment_status", "payment_review")
    }
    const att = await ensureAttempt(client, order, transactionId, attempt, "failed")
    if (att) {
      await client.database
        .from("payment_attempts")
        .update({ status: "failed" })
        .eq("id", att.id)
    }
    await client.database.from("payment_events").insert({
      provider: "nagorikpay",
      provider_transaction_id: transactionId,
      order_id: order.id,
      status: "failed",
      verified: true,
    })
    return { kind: "failed", order_id: order.id }
  }

  if (outcome !== "paid") return { kind: "failed", order_id: order.id }

  // ---- paid ----
  if (!amountCoversOrder(gateway.amount, order.total)) {
    console.error("[payment] amount mismatch", { order_id: order.id, paid: gateway.amount, expected: order.total })
    return { kind: "amount_mismatch", order_id: order.id }
  }

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
    // Another request settled it first, or terminal state.
    const { data: again } = await client.database
      .from("orders").select("payment_status, payment_reference").eq("id", order.id).limit(1)
    if (again?.[0]?.payment_status === "paid") {
      if (again[0].payment_reference !== transactionId) {
        // Different txn won -> duplicate path handled by caller re-running? Record here.
        return { kind: "duplicate", order_id: order.id }
      }
      return fulfill(client, order, transactionId)
    }
    return { kind: "failed", order_id: order.id }
  }

  const att = await ensureAttempt(client, order, transactionId, attempt, "paid")
  if (att) {
    await client.database
      .from("payment_attempts")
      .update({ status: "paid", completed_at: new Date().toISOString(), provider_transaction_id: transactionId })
      .eq("id", att.id)
  }

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
