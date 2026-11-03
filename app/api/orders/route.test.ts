// app/api/orders/route.test.ts
// Order-creation regression tests.
//
// Order creation happens inside the create_ebook_order() database
// function (db/migrations/018). These tests lock in what this route
// is still responsible for: request validation, sending only book
// ids (the function fixes quantity at 1 and prices every line
// server-side), sanitizing the contact block, and mapping the
// function's error messages to the right HTTP status.

import { describe, it, expect, vi, beforeEach } from "vitest"

const requireUser = vi.fn()
const rpc = vi.fn()

vi.mock("@/lib/auth-helpers", () => ({
  requireUser: () => requireUser(),
}))

vi.mock("@/lib/insforge-server", () => ({
  createServerClient: async () => ({
    database: {
      rpc: (...args: any[]) => rpc(...args),
    },
  }),
}))

import { POST } from "./route"

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
  requireUser.mockResolvedValue({ id: "user-1" })
  rpc.mockResolvedValue({ data: ORDER_RESULT, error: null })
})

describe("POST /api/orders — create_ebook_order", () => {
  it("creates the order through the database function with book ids only", async () => {
    const res = await POST(jsonRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual(ORDER_RESULT)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][0]).toBe("create_ebook_order")
    // Only book ids and the sanitized contact reach the database —
    // quantity is fixed at 1 inside the function.
    expect(rpc.mock.calls[0][1]).toEqual({
      p_items: ["book-1"],
      p_contact: { name: "ক আচার্য্য", email: "a@b.c", phone: "01700000000" },
    })
  })

  it("sends every cart line's book id (merging duplicates is the function's job)", async () => {
    const res = await POST(
      jsonRequest(baseBody({ cartItems: [{ book_id: "book-1" }, { book_id: "book-2" }] })),
    )
    expect(res.status).toBe(200)
    expect(rpc.mock.calls[0][1].p_items).toEqual(["book-1", "book-2"])
  })

  it("maps cart_empty to 400", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "cart_empty" } })
    const res = await POST(jsonRequest(baseBody()))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toBe("Cart is empty")
  })

  it("maps already_owned to 409 so the customer keeps their download", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "already_owned:ছেঁড়া পুষ্প" } })
    const res = await POST(jsonRequest(baseBody()))
    const body = await res.json()
    expect(res.status).toBe(409)
    expect(body.error).toMatch(/already own this ebook/i)
  })

  it("maps book_not_found and ebook_unavailable to 400", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "book_not_found:book-1" } })
    const res = await POST(jsonRequest(baseBody()))
    expect(res.status).toBe(400)

    rpc.mockResolvedValue({ data: null, error: { message: "ebook_unavailable:Title" } })
    const res2 = await POST(jsonRequest(baseBody()))
    expect(res2.status).toBe(400)
  })

  it("maps unknown function errors to a generic 500 (never the raw message)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "column orders.foo does not exist" } })
    const res = await POST(jsonRequest(baseBody()))
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error).toBe("Failed to create order")
  })

  it("rejects an empty cart before touching the database", async () => {
    const res = await POST(jsonRequest(baseBody({ cartItems: [] })))
    expect(res.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("rejects a cart larger than 50 items", async () => {
    const items = Array.from({ length: 51 }, (_, i) => ({ book_id: `book-${i}` }))
    const res = await POST(jsonRequest(baseBody({ cartItems: items })))
    expect(res.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("rejects cart items without a usable book id", async () => {
    for (const bad of [{}, { book_id: "" }, { book_id: 42 }, { book_id: "x".repeat(129) }]) {
      const res = await POST(jsonRequest(baseBody({ cartItems: [bad] })))
      expect(res.status).toBe(400)
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it("rejects invalid contact blocks (whitespace, bad email, wrong types)", async () => {
    const cases: unknown[] = [
      { name: "", email: "a@b.c", phone: "01700000000" },
      { name: "   ", email: "   ", phone: "   " },
      { name: "ক আচার্য্য", email: "notanemail", phone: "01700000000" },
      { name: "ক আচার্য্য", email: "a@b.c", phone: "12345" },
      "string",
      42,
      null,
    ]
    for (const contact of cases) {
      const res = await POST(jsonRequest(baseBody({ contact })))
      expect(res.status, `expected 400 for ${JSON.stringify(contact)}`).toBe(400)
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it("trims and strips unknown keys from the contact before sending", async () => {
    const res = await POST(
      jsonRequest(
        baseBody({
          contact: {
            name: "  ক আচার্য্য  ",
            email: " a@b.c ",
            phone: " 01700000000 ",
            user_id: "evil",
            is_admin: true,
          },
        }),
      ),
    )
    expect(res.status).toBe(200)
    expect(rpc.mock.calls[0][1].p_contact).toEqual({
      name: "ক আচার্য্য",
      email: "a@b.c",
      phone: "01700000000",
    })
  })

  it("requires an authenticated user", async () => {
    requireUser.mockRejectedValue(new Response("{}", { status: 401 }))
    const res = await POST(jsonRequest(baseBody()))
    expect(res.status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("keeps a thrown Response's status and adds no-store", async () => {
    requireUser.mockRejectedValue(new Response("{}", { status: 401 }))
    const res = await POST(jsonRequest(baseBody()))
    expect(res.headers.get("Cache-Control")).toBe("no-store")
  })
})
