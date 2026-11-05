// app/api/orders/route.test.ts
// Order-creation regression tests (signed-in + guest).

import { describe, it, expect, vi, beforeEach } from "vitest"

const getOptionalUser = vi.fn()
const rpc = vi.fn()
const serviceRpc = vi.fn()
const rateLimit = vi.fn()

vi.mock("@/lib/auth-helpers", () => ({
  getOptionalUser: () => getOptionalUser(),
  requireUser: () => getOptionalUser(),
}))

vi.mock("@/lib/insforge-server", () => ({
  createServerClient: async () => ({
    database: { rpc: (...args: any[]) => rpc(...args) },
  }),
}))

vi.mock("@/lib/insforge-service", () => ({
  createServiceClient: () => ({
    database: { rpc: (...args: any[]) => serviceRpc(...args) },
  }),
}))

vi.mock("@/lib/guest-rate-limit", () => ({
  clientIp: () => "127.0.0.1",
  isGuestOrderRateLimited: (...args: any[]) => rateLimit(...args),
}))

vi.mock("@/lib/guest-token", () => ({
  newToken: () => "guest-token-value",
  sha256hex: (v: string) => "hashed-" + v,
}))

import { POST } from "./route"
import { cookies } from "next/headers"

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: vi.fn(),
    get: vi.fn(),
  }),
}))

function jsonRequest(body: any) {
  return new Request("https://site.test/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function baseBody(overrides: any = {}) {
  return {
    cartItems: [{ book_id: "book-1", quantity: 1 }],
    contact: { name: "ক আচার্য্য", email: "a@b.c", phone: "01700000000" },
    ...overrides,
  }
}

const ORDER_RESULT = {
  order_id: "order-1",
  subtotal: 150,
  delivery_charge: 0,
  total: 150,
  item_count: 1,
  digital_only: true,
  free: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  getOptionalUser.mockResolvedValue({ id: "user-1" })
  rpc.mockResolvedValue({ data: ORDER_RESULT, error: null })
  serviceRpc.mockResolvedValue({ data: ORDER_RESULT, error: null })
  rateLimit.mockResolvedValue(false)
})

describe("POST /api/orders — signed-in", () => {
  it("creates the order through the database function with book ids only", async () => {
    const res = await POST(jsonRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual(ORDER_RESULT)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][0]).toBe("create_ebook_order")
    expect(rpc.mock.calls[0][1]).toEqual({
      p_items: ["book-1"],
      p_contact: { name: "ক আচার্য্য", email: "a@b.c", phone: "01700000000" },
    })
  })

  it("maps already_owned to 409", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "already_owned:ছেঁড়া পুষ্প" } })
    const res = await POST(jsonRequest(baseBody()))
    const body = await res.json()
    expect(res.status).toBe(409)
  })

  it("rejects an empty cart before touching the database", async () => {
    const res = await POST(jsonRequest(baseBody({ cartItems: [] })))
    expect(res.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("keeps a thrown Response's status and adds no-store", async () => {
    getOptionalUser.mockRejectedValue(new Response("{}", { status: 500 }))
    const res = await POST(jsonRequest(baseBody()))
    expect(res.status).toBe(500)
    expect(res.headers.get("Cache-Control")).toBe("no-store")
  })
})

describe("POST /api/orders — guest", () => {
  beforeEach(() => {
    getOptionalUser.mockResolvedValue(null)
  })

  it("creates a guest order via the service client and returns order_id", async () => {
    const res = await POST(jsonRequest(baseBody()))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toEqual(ORDER_RESULT)
    expect(serviceRpc).toHaveBeenCalledTimes(1)
    expect(serviceRpc.mock.calls[0][0]).toBe("create_guest_ebook_order")
    expect(rateLimit).toHaveBeenCalled()
  })

  it("fails closed (429) when the rate limiter rejects", async () => {
    rateLimit.mockResolvedValue(true)
    const res = await POST(jsonRequest(baseBody()))
    expect(res.status).toBe(429)
    expect(serviceRpc).not.toHaveBeenCalled()
  })

  it("does not leak an existing order id on error", async () => {
    serviceRpc.mockResolvedValue({ data: null, error: { message: "active_order_exists:secret" } })
    const res = await POST(jsonRequest(baseBody()))
    const body = await res.json()
    expect(res.status).toBe(409)
    expect(body.order_id).toBeUndefined()
  })

  it("maps invalid_guest_token to 400", async () => {
    serviceRpc.mockResolvedValue({ data: null, error: { message: "invalid_guest_token" } })
    const res = await POST(jsonRequest(baseBody()))
    expect(res.status).toBe(400)
  })
})