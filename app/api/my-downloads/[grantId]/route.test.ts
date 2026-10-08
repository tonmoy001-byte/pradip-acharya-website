// app/api/my-downloads/[grantId]/route.test.ts
// Ebook download authorization regression tests.
//
// Locks in the requirement that the PDF is only ever served to the
// authenticated, authorized owner of a paid ebook order item, and that
// tampering with grant / order / order-item / format ids yields nothing.

import { describe, it, expect, vi, beforeEach } from "vitest"

const requireUser = vi.fn()
const storageDownload = vi.fn()

// Table-scoped query builders. Each returns a chainable stub whose terminal
// method is `limit` (and, for `orders` in this route, nothing else).
type Row = Record<string, any>

const tables: Record<string, Row[]> = {
  download_grants: [],
  order_items: [],
  orders: [],
  digital_assets: [],
}

const appliedFilters: Record<string, Array<[string, any]>> = {}

function makeBuilder(table: string) {
  appliedFilters[table] = []
  const state: { filters: Array<[string, any]>; isNull: Array<string> } = {
    filters: [],
    isNull: [],
  }

  const builder: any = {
    select: () => builder,
    eq: (col: string, val: any) => {
      state.filters.push([col, val])
      return builder
    },
    is: (col: string, val: any) => {
      state.isNull.push(col)
      void val
      return builder
    },
    limit: async () => {
      appliedFilters[table] = state.filters
      let rows = [...(tables[table] || [])]
      for (const [col, val] of state.filters) {
        rows = rows.filter((r) => r[col] === val)
      }
      for (const col of state.isNull) {
        rows = rows.filter((r) => r[col] === null)
      }
      return { data: rows, error: null }
    },
    update: (patch: Row) => {
      builder.__patch = patch
      return builder
    },
    then: (resolve: any) => resolve({ data: [], error: null }),
  }
  return builder
}

vi.mock("@/lib/auth-helpers", () => ({
  requireUser: () => requireUser(),
}))

vi.mock("@/lib/insforge-server", () => ({
  createServerClient: async () => ({
    database: {
      from: (table: string) => makeBuilder(table),
    },
    storage: {
      from: () => ({ download: (key: string) => storageDownload(key) }),
    },
  }),
}))

import { GET } from "./route"

const ME = "user-me"
const OTHER = "user-other"

function grant(overrides: Row = {}) {
  return {
    id: "grant-1",
    user_id: ME,
    order_item_id: "item-1",
    max_downloads: 3,
    download_count: 0,
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    revoked_at: null,
    ...overrides,
  }
}

function orderItem(overrides: Row = {}) {
  return {
    id: "item-1",
    order_id: "order-1",
    book_id: "book-1",
    format_id: "fmt-1",
    delivery_type_snapshot: "digital",
    ...overrides,
  }
}

function call(grantId = "grant-1") {
  return GET(new Request("https://site.test"), {
    params: Promise.resolve({ grantId }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUser.mockResolvedValue({ id: ME })
  tables.download_grants = [grant()]
  tables.order_items = [orderItem()]
  tables.orders = [{ id: "order-1", user_id: ME, payment_status: "paid" }]
  tables.digital_assets = [
    { format_id: "fmt-1", active: true, storage_key: "ebooks/1700-abc123.pdf" },
  ]
  storageDownload.mockResolvedValue({
    data: new Blob([new Uint8Array([1, 2, 3])], { type: "application/pdf" }),
    error: null,
  })
})

describe("GET /api/my-downloads/[grantId]", () => {
  it("serves the PDF to the owner of a paid ebook order item", async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("application/pdf")
    expect(res.headers.get("Content-Disposition")).toContain("attachment")
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(storageDownload).toHaveBeenCalledWith("ebooks/1700-abc123.pdf")
  })

  it("refuses a grant that belongs to another customer", async () => {
    tables.download_grants = [grant({ user_id: OTHER })]
    const res = await call()
    expect(res.status).toBe(403)
    expect(storageDownload).not.toHaveBeenCalled()
  })

  it("refuses when the backing order is not paid", async () => {
    tables.orders = [{ id: "order-1", user_id: ME, payment_status: "pending_payment" }]
    const res = await call()
    expect(res.status).toBe(403)
    expect(storageDownload).not.toHaveBeenCalled()
  })

  it("refuses when the order belongs to another customer", async () => {
    tables.orders = [{ id: "order-1", user_id: OTHER, payment_status: "paid" }]
    const res = await call()
    expect(res.status).toBe(403)
    expect(storageDownload).not.toHaveBeenCalled()
  })

  it("refuses a non-digital (legacy paperbook) order line", async () => {
    tables.order_items = [orderItem({ delivery_type_snapshot: "physical" })]
    const res = await call()
    expect(res.status).toBe(403)
    expect(storageDownload).not.toHaveBeenCalled()
  })

  it("refuses a revoked grant", async () => {
    tables.download_grants = [grant({ revoked_at: new Date().toISOString() })]
    const res = await call()
    expect(res.status).toBe(403)
    expect(storageDownload).not.toHaveBeenCalled()
  })

  it("refuses an expired grant", async () => {
    tables.download_grants = [
      grant({ expires_at: new Date(Date.now() - 1000).toISOString() }),
    ]
    const res = await call()
    expect(res.status).toBe(403)
    expect(storageDownload).not.toHaveBeenCalled()
  })

  it("refuses once the download limit is reached", async () => {
    tables.download_grants = [grant({ download_count: 3, max_downloads: 3 })]
    const res = await call()
    expect(res.status).toBe(403)
    expect(storageDownload).not.toHaveBeenCalled()
  })

  it("refuses when no PDF is attached to the format", async () => {
    tables.digital_assets = []
    const res = await call()
    expect(res.status).toBe(404)
    expect(storageDownload).not.toHaveBeenCalled()
  })

  it("refuses an unknown grant id without leaking whether it exists", async () => {
    const res = await call("grant-does-not-exist")
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("Download grant not found or not authorized")
    expect(storageDownload).not.toHaveBeenCalled()
  })

  it("does not resolve a digital asset for a different format id", async () => {
    // The asset lookup is scoped to the order item's format_id; changing the
    // order item must not reach another format's file.
    tables.order_items = [orderItem({ format_id: "fmt-other" })]
    tables.digital_assets = [
      { format_id: "fmt-1", active: true, storage_key: "ebooks/1700-abc123.pdf" },
    ]
    const res = await call()
    // No asset is attached to fmt-other, so nothing is served.
    expect(res.status).toBe(404)
    expect(storageDownload).not.toHaveBeenCalled()
  })

  it("refuses everything when the user is not authenticated", async () => {
    requireUser.mockRejectedValue(new Response("{}", { status: 401 }))
    const res = await call()
    expect(res.status).toBe(401)
    expect(storageDownload).not.toHaveBeenCalled()
  })
})
