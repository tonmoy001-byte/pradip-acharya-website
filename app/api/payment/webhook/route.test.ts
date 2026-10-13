// app/api/payment/webhook/route.test.ts
// IPN settlement regression tests.
//
// Locks in the two rules the webhook gained when the gateway verify response
// was found to carry no metadata.order_id:
//   * settlement proceeds without metadata and finds the order through the
//     payment_reference stored at creation time
//   * a transaction already claimed by a different order is ignored

import { describe, it, expect, vi, beforeEach } from "vitest"

const verifyGateway = vi.fn()
let serviceClient: any

vi.mock("@/lib/insforge-service", () => ({
  createServiceClient: () => serviceClient,
}))

vi.mock("@/lib/nagorikpay-webhook", () => ({
  verifyWebhookSignature: () => true,
}))

vi.mock("@/lib/nagorikpay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/nagorikpay")>()
  return {
    ...actual,
    verifyNagorikPayPayment: (...args: unknown[]) => verifyGateway(...args),
  }
})

import { POST } from "./route"

interface Call {
  fn: string
  args: unknown[]
}

interface Canned {
  orders: Array<Record<string, unknown>>
  updateResult?: Array<Record<string, unknown>>
}

/** Same PostgREST fake as lib/payment-settlement.test.ts. */
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
        return Promise.resolve({ error: null, data: null })
      },
    },
  }

  return client
}

function gatewayVerify(overrides: Record<string, unknown> = {}) {
  return {
    cus_name: "Test User",
    cus_email: "t@t.c",
    amount: "150",
    transaction_id: "txn-1",
    payment_method: "bKash",
    status: "COMPLETED",
    ...overrides,
  }
}

const ORDER = {
  id: "order-1",
  user_id: "user-1",
  payment_status: "pending_payment",
  total: 150,
}

function webhookRequest(body = "transactionId=txn-1&status=completed") {
  return new Request("https://site.test/api/payment/webhook", { method: "POST", body })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/payment/webhook — order matching", () => {
  it("settles when the gateway verify response has no metadata at all", async () => {
    serviceClient = makeClient({ orders: [ORDER], updateResult: [{ id: "order-1" }] })
    verifyGateway.mockResolvedValue(gatewayVerify({ metadata: undefined }))

    const res = await POST(webhookRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ received: true })
    expect(body.ignored).toBeUndefined()
    // Found the order through the payment_reference stored at creation time.
    expect(
      serviceClient.calls.some(
        (c: Call) => c.fn === "eq" && c.args[0] === "payment_reference" && c.args[1] === "txn-1",
      ),
    ).toBe(true)
    expect(
      serviceClient.calls.some(
        (c: Call) => c.fn === "update" && (c.args[0] as any).payment_status === "paid",
      ),
    ).toBe(true)
  })

  it("ignores a replayed transaction when another order holds the reference", async () => {
    serviceClient = makeClient({ orders: [ORDER], updateResult: [{ id: "order-1" }] })
    verifyGateway.mockResolvedValue(
      gatewayVerify({ metadata: { order_id: "order-2", user_id: "user-1" } }),
    )

    const res = await POST(webhookRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ received: true, ignored: "transaction_already_used" })
    expect(serviceClient.calls.some((c: Call) => c.fn === "update")).toBe(false)
    expect(serviceClient.calls.some((c: Call) => c.fn.startsWith("rpc:"))).toBe(false)
  })

  it("settles when metadata.order_id matches the order holding the reference", async () => {
    serviceClient = makeClient({ orders: [ORDER], updateResult: [{ id: "order-1" }] })
    verifyGateway.mockResolvedValue(
      gatewayVerify({ metadata: { order_id: "order-1", user_id: "user-1" } }),
    )

    const res = await POST(webhookRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ received: true })
    expect(
      serviceClient.calls.some(
        (c: Call) => c.fn === "update" && (c.args[0] as any).payment_status === "paid",
      ),
    ).toBe(true)
  })
})
