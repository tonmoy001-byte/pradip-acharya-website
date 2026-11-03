// app/api/payment/verify/route.test.ts
// Post-redirect settlement regression tests.
//
// Locks in the order-matching rules added when the gateway verify response
// was found to carry no metadata.order_id:
//   * order_id from the success-page query param settles the order
//   * a transaction already claimed by a different order is rejected with
//     a replay 409 before anything is written

import { describe, it, expect, vi, beforeEach } from "vitest"

const requireUser = vi.fn()
const verifyGateway = vi.fn()
let serviceClient: any

vi.mock("@/lib/auth-helpers", () => ({
  requireUser: () => requireUser(),
}))

vi.mock("@/lib/insforge-service", () => ({
  createServiceClient: () => serviceClient,
}))

vi.mock("@/lib/nagorikpay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/nagorikpay")>()
  return {
    ...actual,
    verifyNagorikPayPayment: (...args: unknown[]) => verifyGateway(...args),
  }
})

import { GET } from "./route"

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

function verifyRequest(query = "transactionId=txn-1") {
  return new Request(`https://site.test/api/payment/verify?${query}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUser.mockResolvedValue({ id: "user-1" })
})

describe("GET /api/payment/verify — order matching", () => {
  it("settles using the order_id query param when metadata has no order_id", async () => {
    serviceClient = makeClient({ orders: [ORDER], updateResult: [{ id: "order-1" }] })
    verifyGateway.mockResolvedValue(gatewayVerify({ metadata: {} }))

    const res = await GET(verifyRequest("transactionId=txn-1&order_id=order-1"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: "paid", order_id: "order-1", download_ready: true })
    expect(
      serviceClient.calls.some(
        (c: Call) => c.fn === "eq" && c.args[0] === "id" && c.args[1] === "order-1",
      ),
    ).toBe(true)
    expect(
      serviceClient.calls.some(
        (c: Call) => c.fn === "update" && (c.args[0] as any).payment_status === "paid",
      ),
    ).toBe(true)
  })

  it("settles when metadata.order_id matches the order holding the reference", async () => {
    serviceClient = makeClient({ orders: [ORDER], updateResult: [{ id: "order-1" }] })
    verifyGateway.mockResolvedValue(
      gatewayVerify({ metadata: { order_id: "order-1", user_id: "user-1" } }),
    )

    const res = await GET(verifyRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: "paid", order_id: "order-1", download_ready: true })
  })

  it("returns 409 when another order already holds this transaction", async () => {
    serviceClient = makeClient({ orders: [ORDER], updateResult: [{ id: "order-1" }] })
    verifyGateway.mockResolvedValue(gatewayVerify({ metadata: {} }))

    const res = await GET(verifyRequest("transactionId=txn-1&order_id=order-2"))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toBe("Transaction already used")
    expect(serviceClient.calls.some((c: Call) => c.fn === "update")).toBe(false)
    expect(serviceClient.calls.some((c: Call) => c.fn.startsWith("rpc:"))).toBe(false)
  })
})
