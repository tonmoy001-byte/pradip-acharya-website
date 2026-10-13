// lib/payment-settlement.test.ts
// Settlement integrity regression tests.
//
// These lock in the rules that keep money honest:
//   * a NaN / non-numeric gateway amount can never mark an order paid
//   * a pending verdict parks the order in payment_review, and a later
//     failed verdict puts it back so the customer can pay again
//   * only pending_payment / payment_review orders can move to paid
//   * the gateway metadata user must own the order
//   * re-settling a paid order only re-runs fulfillment

import { describe, it, expect } from "vitest"
import {
  amountCoversOrder,
  settleNagorikPayTransaction,
  type ServiceClient,
} from "./payment-settlement"

interface Call {
  fn: string
  args: unknown[]
}

interface Canned {
  orders: Array<Record<string, unknown>>
  updateResult?: Array<Record<string, unknown>>
  rpcError?: unknown
}

/**
 * Minimal PostgREST fake. `from()` returns a chainable stub whose
 * terminal method is `limit(1)`; the chain itself is thenable and
 * resolves with the canned update result (or the canned rows).
 * `database.rpc()` resolves directly. Every call is recorded so
 * tests can assert what the settlement actually asked the
 * database to do.
 */
function makeClient(canned: Canned) {
  const calls: Call[] = []

  const chain: any = {
    select: () => chain,
    eq: (col: string, val: unknown) => {
      calls.push({ fn: "eq", args: [col, val] })
      return chain
    },
    in: () => chain,
    update: (patch: unknown) => {
      calls.push({ fn: "update", args: [patch] })
      return chain
    },
    insert: (rows: unknown) => {
      calls.push({ fn: "insert", args: [rows] })
      return Promise.resolve({ error: null })
    },
    limit: async () => ({ data: canned.orders, error: null }),
    then: (resolve: (v: unknown) => unknown) =>
      resolve({ data: canned.updateResult ?? canned.orders, error: null }),
  }

  const client = {
    calls,
    database: {
      from: (table: string) => {
        calls.push({ fn: "from", args: [table] })
        return chain
      },
      rpc: (fn: string, args: unknown) => {
        calls.push({ fn: `rpc:${fn}`, args: [args] })
        return Promise.resolve({ error: canned.rpcError ?? null, data: null })
      },
    },
  }

  return { client: client as unknown as ServiceClient, calls }
}

function gateway(overrides: Record<string, unknown> = {}) {
  return {
    cus_name: "Test User",
    cus_email: "t@t.c",
    amount: "150",
    transaction_id: "txn-1",
    payment_method: "bKash",
    status: "COMPLETED",
    metadata: { order_id: "order-1", user_id: "user-1" },
    ...overrides,
  }
}

const ORDER = {
  id: "order-1",
  user_id: "user-1",
  payment_status: "pending_payment",
  total: 150,
}

describe("amountCoversOrder", () => {
  it("rejects NaN and non-numeric amounts (NaN < x is false)", () => {
    expect(amountCoversOrder(NaN, 150)).toBe(false)
    expect(amountCoversOrder(undefined, 150)).toBe(false)
    expect(amountCoversOrder(null, 150)).toBe(false)
    expect(amountCoversOrder("", 150)).toBe(false)
    expect(amountCoversOrder("abc", 150)).toBe(false)
  })

  it("rejects underpaid amounts and negative totals", () => {
    expect(amountCoversOrder(100, 150)).toBe(false)
    expect(amountCoversOrder("100", 150)).toBe(false)
    expect(amountCoversOrder(150, -5)).toBe(false)
  })

  it("accepts exact payment and overpayment", () => {
    expect(amountCoversOrder(150, 150)).toBe(true)
    expect(amountCoversOrder("150", 150)).toBe(true)
    expect(amountCoversOrder(200, 150)).toBe(true)
  })

  it("compares against the rounded amount sent to the gateway", () => {
    // 99.999 is sent to the gateway as "100" (2-decimal rounding).
    expect(amountCoversOrder(100, 99.999)).toBe(true)
    expect(amountCoversOrder(99.99, 99.999)).toBe(false)
  })
})

describe("settleNagorikPayTransaction", () => {
  it("marks a covered payment paid, logs the event and fulfills", async () => {
    const { client, calls } = makeClient({
      orders: [ORDER],
      updateResult: [{ id: "order-1" }],
    })

    const outcome = await settleNagorikPayTransaction({
      client,
      transactionId: "txn-1",
      gateway: gateway() as any,
    })

    expect(outcome).toEqual({ kind: "paid", order_id: "order-1", download_ready: true })
    expect(calls.some((c) => c.fn === "rpc:fulfill_paid_order")).toBe(true)
    expect(calls.some((c) => c.fn === "insert")).toBe(true)

    // The "mark paid" update only runs for the two waiting states.
    const paidUpdate = calls.find((c) => c.fn === "update")
    expect(paidUpdate?.args[0]).toMatchObject({
      payment_status: "paid",
      payment_reference: "txn-1",
    })
  })

  it("never marks an order paid when the gateway amount is NaN", async () => {
    const { client, calls } = makeClient({
      orders: [ORDER],
      updateResult: [{ id: "order-1" }],
    })

    const outcome = await settleNagorikPayTransaction({
      client,
      transactionId: "txn-1",
      gateway: gateway({ amount: "NaN" }) as any,
    })

    expect(outcome).toEqual({ kind: "amount_mismatch", order_id: "order-1" })
    expect(calls.some((c) => c.fn === "update")).toBe(false)
    expect(calls.some((c) => c.fn === "rpc:fulfill_paid_order")).toBe(false)
    expect(calls.some((c) => c.fn === "insert")).toBe(false)
  })

  it("parks a pending payment in payment_review, then a failed verdict reverts it", async () => {
    const pending = makeClient({ orders: [ORDER] })
    const first = await settleNagorikPayTransaction({
      client: pending.client,
      transactionId: "txn-1",
      gateway: gateway({ status: "PENDING" }) as any,
    })

    expect(first).toEqual({ kind: "pending", order_id: "order-1" })
    expect(pending.calls.find((c) => c.fn === "update")?.args[0]).toMatchObject({
      payment_status: "payment_review",
      payment_reference: "txn-1",
    })

    const review = makeClient({ orders: [{ ...ORDER, payment_status: "payment_review" }] })
    const second = await settleNagorikPayTransaction({
      client: review.client,
      transactionId: "txn-1",
      gateway: gateway({ status: "FAILED" }) as any,
    })

    expect(second).toEqual({ kind: "failed", order_id: "order-1" })
    expect(review.calls.find((c) => c.fn === "update")?.args[0]).toMatchObject({
      payment_status: "pending_payment",
      payment_reference: null,
    })
  })

  it("never marks an order paid from an unrelated status", async () => {
    // The .in(payment_status, [...]) guard blocks the update (empty
    // result), the re-read still shows the old status, settlement
    // gives up — and no grant is released.
    const { client, calls } = makeClient({
      orders: [{ ...ORDER, payment_status: "refunded" }],
      updateResult: [],
    })

    const outcome = await settleNagorikPayTransaction({
      client,
      transactionId: "txn-1",
      gateway: gateway() as any,
    })

    expect(outcome).toEqual({ kind: "failed", order_id: "order-1" })
    expect(calls.some((c) => c.fn === "rpc:fulfill_paid_order")).toBe(false)
    expect(calls.some((c) => c.fn === "insert")).toBe(false)
  })

  it("returns not_found when the gateway metadata user does not own the order", async () => {
    const { client, calls } = makeClient({ orders: [ORDER] })

    const outcome = await settleNagorikPayTransaction({
      client,
      transactionId: "txn-1",
      gateway: gateway({ metadata: { order_id: "order-1", user_id: "user-other" } }) as any,
    })

    expect(outcome).toEqual({ kind: "not_found" })
    expect(calls.some((c) => c.fn === "update")).toBe(false)
  })

  it("re-runs fulfillment for an already-paid order without touching its status", async () => {
    const { client, calls } = makeClient({ orders: [{ ...ORDER, payment_status: "paid" }] })

    const outcome = await settleNagorikPayTransaction({
      client,
      transactionId: "txn-1",
      gateway: gateway() as any,
    })

    expect(outcome).toEqual({ kind: "paid", order_id: "order-1", download_ready: true })
    expect(calls.some((c) => c.fn === "rpc:fulfill_paid_order")).toBe(true)
    expect(calls.some((c) => c.fn === "update")).toBe(false)
  })

  it("falls back to the payment_reference lookup when metadata has no order id", async () => {
    const { client, calls } = makeClient({
      orders: [ORDER],
      updateResult: [{ id: "order-1" }],
    })

    const outcome = await settleNagorikPayTransaction({
      client,
      transactionId: "txn-1",
      gateway: gateway({ metadata: { user_id: "user-1" } }) as any,
    })

    expect(outcome).toEqual({ kind: "paid", order_id: "order-1", download_ready: true })
    expect(
      calls.some(
        (c) => c.fn === "eq" && c.args[0] === "payment_reference" && c.args[1] === "txn-1",
      ),
    ).toBe(true)
  })

  it("settles with the caller-supplied order id when gateway metadata is missing entirely", async () => {
    const { client, calls } = makeClient({
      orders: [ORDER],
      updateResult: [{ id: "order-1" }],
    })

    const outcome = await settleNagorikPayTransaction({
      client,
      transactionId: "txn-1",
      gateway: gateway({ metadata: undefined }) as any,
      orderId: "order-1",
    })

    expect(outcome).toEqual({ kind: "paid", order_id: "order-1", download_ready: true })
    expect(
      calls.some((c) => c.fn === "eq" && c.args[0] === "id" && c.args[1] === "order-1"),
    ).toBe(true)
  })

  it("settles with no metadata and no order id by falling back to payment_reference", async () => {
    const { client, calls } = makeClient({
      orders: [ORDER],
      updateResult: [{ id: "order-1" }],
    })

    const outcome = await settleNagorikPayTransaction({
      client,
      transactionId: "txn-1",
      gateway: gateway({ metadata: undefined }) as any,
    })

    expect(outcome).toEqual({ kind: "paid", order_id: "order-1", download_ready: true })
    expect(
      calls.some(
        (c) => c.fn === "eq" && c.args[0] === "payment_reference" && c.args[1] === "txn-1",
      ),
    ).toBe(true)
    expect(calls.some((c) => c.fn === "update")).toBe(true)
  })
})
