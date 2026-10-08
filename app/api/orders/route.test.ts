// app/api/orders/route.test.ts
// Ebook-only enforcement + price-authority regression tests.
//
// These lock in the core architectural guarantee of the ebook-only store:
// a client cannot buy a paperbook, and cannot control the price it pays.

import { describe, it, expect, vi, beforeEach } from "vitest"

const requireUser = vi.fn()
const rpc = vi.fn()
const insertOrders = vi.fn()
const insertOrderItems = vi.fn()
const formatsSelect = vi.fn()
const bookSelect = vi.fn()

vi.mock("@/lib/auth-helpers", () => ({
  requireUser: () => requireUser(),
}))

vi.mock("@/lib/insforge-server", () => ({
  createServerClient: async () => ({
    database: {
      from: (table: string) => {
        if (table === "book_formats") {
          return {
            select: () => formatsSelect(),
          }
        }
        if (table === "books") {
          return { select: () => bookSelect() }
        }
        if (table === "orders") {
          return {
            insert: (...args: any[]) => insertOrders(...args),
          }
        }
        if (table === "order_items") {
          return { insert: (...args: any[]) => insertOrderItems(...args) }
        }
        throw new Error(`unexpected table ${table}`)
      },
      rpc: (...args: any[]) => rpc(...args),
    },
  }),
}))

import { POST } from "./route"

const DIGITAL = {
  id: "fmt-ebook",
  available: true,
  price: 150,
  delivery_type: "digital",
  format_name: "eBook",
}

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

beforeEach(() => {
  vi.clearAllMocks()
  requireUser.mockResolvedValue({ id: "user-1" })
  bookSelect.mockReturnValue({
    eq: () => ({
      single: async () => ({ data: { id: "book-1", title: "ছেঁড়া পুষ্প", author: "আচার্য্য" } }),
    }),
  })
  formatsSelect.mockReturnValue({
    eq: () => ({
      eq: () => ({
        limit: async () => ({ data: [DIGITAL] }),
      }),
    }),
  })
  insertOrders.mockReturnValue({
    select: () => ({ single: async () => ({ data: { id: "order-1" } }) }),
  })
  insertOrderItems.mockResolvedValue({ error: null })
})

describe("POST /api/orders — ebook-only", () => {
  it("prices from the server-resolved digital format, not the client", async () => {
    const res = await POST(jsonRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.total).toBe(150)
    expect(body.data.delivery_charge).toBe(0)
    expect(body.data.digital_only).toBe(true)
  })

  it("ignores a client-supplied paperbook format_name and still sells the ebook", async () => {
    const res = await POST(
      jsonRequest(
        baseBody({
          cartItems: [{ book_id: "book-1", format_name: "Paperback", quantity: 1 }],
        }),
      ),
    )
    const body = await res.json()

    expect(res.status).toBe(200)

    const inserted = insertOrderItems.mock.calls[0][0][0]
    expect(inserted.delivery_type_snapshot).toBe("digital")
    expect(inserted.format_id).toBe("fmt-ebook")
    expect(inserted.unit_price_snapshot).toBe(150)
  })

  it("rejects a book that has no digital format", async () => {
    formatsSelect.mockReturnValue({
      eq: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }) }),
    })

    const res = await POST(jsonRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/Ebook not available/i)
    expect(insertOrders).not.toHaveBeenCalled()
  })

  it("rejects an unavailable ebook", async () => {
    formatsSelect.mockReturnValue({
      eq: () => ({
        eq: () => ({ limit: async () => ({ data: [{ ...DIGITAL, available: false }] }) }),
      }),
    })

    const res = await POST(jsonRequest(baseBody()))
    expect(res.status).toBe(400)
    expect(insertOrders).not.toHaveBeenCalled()
  })

  it("rejects a physical delivery_type returned by the database", async () => {
    formatsSelect.mockReturnValue({
      eq: () => ({
        eq: () => ({ limit: async () => ({ data: [{ ...DIGITAL, delivery_type: "physical" }] }) }),
      }),
    })

    const res = await POST(jsonRequest(baseBody()))
    expect(res.status).toBe(400)
    expect(insertOrders).not.toHaveBeenCalled()
  })

  it("never accepts a shipping address and always writes a null one", async () => {
    await POST(
      jsonRequest(
        baseBody({
          shippingAddress: { address: "x", city: "y", postal_code: "z" },
        }),
      ),
    )

    const order = insertOrders.mock.calls[0][0]
    expect(order.shipping_address).toBeNull()
    expect(order.delivery_charge).toBe(0)
    expect(order.fulfillment_status).toBe("not_applicable")
    expect(order.payment_method).toBe("rupantor")
  })

  it("ignores a client-supplied total and recomputes it", async () => {
    const res = await POST(jsonRequest(baseBody({ total: 1 })))
    const body = await res.json()
    expect(body.data.total).toBe(150)
  })

  it("rejects out-of-range quantities", async () => {
    for (const quantity of [0, -1, 2.5, 101]) {
      const res = await POST(jsonRequest(baseBody({ cartItems: [{ book_id: "book-1", quantity }] })))
      expect(res.status).toBe(400)
    }
    expect(insertOrders).not.toHaveBeenCalled()
  })

  it("requires an authenticated user", async () => {
    requireUser.mockRejectedValue(new Response("{}", { status: 401 }))
    const res = await POST(jsonRequest(baseBody()))
    expect(res.status).toBe(401)
    expect(insertOrders).not.toHaveBeenCalled()
  })
})

// Contact validation is the authoritative integrity gate for `orders.contact`.
// The client is untrusted: every case below is reachable by posting directly
// to the endpoint, bypassing the checkout form entirely.
describe("POST /api/orders — contact validation", () => {
  async function postContact(contact: unknown) {
    const res = await POST(jsonRequest(baseBody({ contact })))
    return { status: res.status, body: await res.json() }
  }

  const VALID = { name: "ক আচার্য্য", email: "a@b.c", phone: "01700000000" }

  it("rejects empty strings", async () => {
    const { status, body } = await postContact({ name: "", email: "", phone: "" })
    expect(status).toBe(400)
    expect(body.error).toMatch(/Contact information required/i)
    expect(insertOrders).not.toHaveBeenCalled()
  })

  it("rejects whitespace-only strings (truthiness would have accepted these)", async () => {
    const { status } = await postContact({ name: "   ", email: "   ", phone: "   " })
    expect(status).toBe(400)
    expect(insertOrders).not.toHaveBeenCalled()
  })

  it("rejects invalid email formats", async () => {
    for (const email of ["notanemail", "@b.c", "a@", "a b@c.d", "a@b", "a@@b.c"]) {
      const { status } = await postContact({ ...VALID, email })
      expect(status, `expected 400 for email ${JSON.stringify(email)}`).toBe(400)
    }
    expect(insertOrders).not.toHaveBeenCalled()
  })

  it("rejects phone numbers outside the 6-32 character range", async () => {
    for (const phone of ["", "12345", "1".repeat(33)]) {
      const { status } = await postContact({ ...VALID, phone })
      expect(status, `expected 400 for phone of length ${phone.length}`).toBe(400)
    }
    // boundaries are accepted
    for (const phone of ["123456", "1".repeat(32)]) {
      const { status } = await postContact({ ...VALID, phone })
      expect(status, `expected 200 for phone of length ${phone.length}`).toBe(200)
    }
  })

  it("rejects a name outside the 2-120 character range", async () => {
    for (const name of ["", "ক", "ক".repeat(121)]) {
      const { status } = await postContact({ ...VALID, name })
      expect(status, `expected 400 for name of length ${name.length}`).toBe(400)
    }
  })

  it("rejects a missing or non-object contact", async () => {
    for (const contact of [undefined, null, "string", 42, true, ["a", "b"]]) {
      const { status } = await postContact(contact)
      expect(status, `expected 400 for contact ${JSON.stringify(contact)}`).toBe(400)
    }
    expect(insertOrders).not.toHaveBeenCalled()
  })

  it("rejects non-string field types instead of coercing them", async () => {
    const cases: Array<Record<string, unknown>> = [
      { name: {}, email: "a@b.c", phone: "01700000000" },
      { name: "ক আচার্য্য", email: [], phone: "01700000000" },
      { name: "ক আচার্য্য", email: "a@b.c", phone: { digits: "017" } },
      { name: null, email: "a@b.c", phone: "01700000000" },
      { name: 12345, email: "a@b.c", phone: "01700000000" },
      { name: "ক আচার্য্য", email: "a@b.c", phone: true },
    ]
    for (const contact of cases) {
      const { status } = await postContact(contact)
      expect(status, `expected 400 for ${JSON.stringify(contact)}`).toBe(400)
    }
    expect(insertOrders).not.toHaveBeenCalled()
  })

  it("creates the order for valid contact data", async () => {
    const { status, body } = await postContact(VALID)
    expect(status).toBe(200)
    expect(body.data.total).toBe(150)
    expect(insertOrders).toHaveBeenCalledTimes(1)
    expect(insertOrders.mock.calls[0][0].contact).toEqual(VALID)
  })

  it("trims surrounding whitespace before storing", async () => {
    const { status } = await postContact({
      name: "  ক আচার্য্য  ",
      email: "  a@b.c  ",
      phone: "  01700000000  ",
    })
    expect(status).toBe(200)
    expect(insertOrders.mock.calls[0][0].contact).toEqual({
      name: "ক আচার্য্য",
      email: "a@b.c",
      phone: "01700000000",
    })
  })

  it("does not persist extra keys supplied by the client", async () => {
    const { status } = await postContact({
      ...VALID,
      is_admin: true,
      user_id: "someone-else",
      role: "admin",
    })
    expect(status).toBe(200)
    expect(insertOrders.mock.calls[0][0].contact).toEqual(VALID)
    expect(Object.keys(insertOrders.mock.calls[0][0].contact).sort()).toEqual([
      "email",
      "name",
      "phone",
    ])
  })
})
