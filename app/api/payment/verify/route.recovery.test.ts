// app/api/payment/verify/route.recovery.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const getOptionalUser = vi.fn()
const verifyGateway = vi.fn()
let serviceClient: any

vi.mock("@/lib/auth-helpers", () => ({
  getOptionalUser: () => getOptionalUser(),
  requireUser: () => getOptionalUser(),
}))

vi.mock("@/lib/insforge-service", () => ({
  createServiceClient: () => serviceClient,
}))

vi.mock("@/lib/nagorikpay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/nagorikpay")>()
  return { ...actual, verifyNagorikPayPayment: (...args: unknown[]) => verifyGateway(...args) }
})

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}))

import { GET } from "./route"

function makeClient(orders: any[]) {
  const calls: any[] = []
  const chain: any = {
    select: () => chain,
    eq: (...a: any[]) => { calls.push({ fn: "eq", args: a }); return chain },
    is: () => chain,
    in: () => chain,
    limit: () => chain,
    single: () => Promise.resolve({ data: orders[0] ?? null, error: null }),
    then: (cb: any) => cb({ data: orders, error: null }),
  }
  // Make awaitable
  const fromFn = (table: string) => {
    const c = { ...chain }
    ;(c as any).then = (cb: any) => cb({ data: orders, error: null })
    return c
  }
  return { database: { from: fromFn, rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "forbidden" } }) }, calls }
}

beforeEach(() => {
  vi.clearAllMocks()
  getOptionalUser.mockResolvedValue(null)
  verifyGateway.mockResolvedValue({
    cus_name: "t", cus_email: "t@t.c", amount: "150", transaction_id: "txn-1",
    payment_method: "bKash", status: "COMPLETED", metadata: { order_id: "order-1" },
  })
})

describe("guest verify recovery", () => {
  it("returns recovery:true when cookie missing and order is paid", async () => {
    const chain: any = {}
    chain.select = () => chain
    chain.eq = () => chain
    chain.is = () => chain
    chain.in = () => chain
    chain.limit = () => Promise.resolve({ data: [{ id: "order-1", payment_status: "paid" }], error: null })
    chain.single = () => Promise.resolve({ data: { id: "order-1", payment_status: "paid" }, error: null })
    chain.then = (cb: any) => cb({ data: [{ id: "order-1", payment_status: "paid" }], error: null })
    serviceClient = {
      database: {
        from: () => chain,
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
    }
    const res = await GET(new Request("https://site.test/api/payment/verify?transactionId=txn-1&order_id=order-1"))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ status: "paid", guest: true, recovery: true })
  })

  it("returns 404 when cookie missing and order is not paid", async () => {
    const chain2: any = {}
    chain2.select = () => chain2
    chain2.eq = () => chain2
    chain2.is = () => chain2
    chain2.in = () => chain2
    chain2.limit = () => Promise.resolve({ data: [{ id: "order-1", payment_status: "pending_payment" }], error: null })
    chain2.single = () => Promise.resolve({ data: { id: "order-1", payment_status: "pending_payment" }, error: null })
    chain2.then = (cb: any) => cb({ data: [{ id: "order-1", payment_status: "pending_payment" }], error: null })
    serviceClient = {
      database: {
        from: () => chain2,
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
    }
    const res = await GET(new Request("https://site.test/api/payment/verify?transactionId=txn-1&order_id=order-1"))
    expect(res.status).toBe(404)
  })
})