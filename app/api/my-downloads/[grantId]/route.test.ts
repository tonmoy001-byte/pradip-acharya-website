// app/api/my-downloads/[grantId]/route.test.ts
// Ebook download authorization regression tests.
//
// Locks in the requirement that the PDF is only ever served to the
// authenticated, authorized owner of a paid ebook order item, and that
// tampering with grant / order / order-item / format ids yields nothing.
//
// digital_assets and the private storage bucket are admin-only under RLS,
// so the route must escalate to the service client for those two reads —
// but only after every authorization check has passed. The service client
// must never be constructed on a rejection path.

import { describe, it, expect, vi, beforeEach } from "vitest"

const requireUser = vi.fn()
const createServiceClient = vi.fn()
const serviceStorageDownload = vi.fn()
const consumeDownload = vi.fn()

// Table-scoped query builders for the customer-session client (steps 1–4
// and consume_download). The service client gets its own builder so tests
// can prove which client read which table.
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

// Which client last touched which table / storage — for assertions.
const userClientTables: string[] = []
const serviceClientTables: string[] = []

function makeUserBuilder(table: string) {
  userClientTables.push(table)
  return makeBuilder(table)
}

function makeServiceBuilder(table: string) {
  serviceClientTables.push(table)
  return makeBuilder(table)
}

vi.mock("@/lib/auth-helpers", () => ({
  requireUser: () => requireUser(),
}))

vi.mock("@/lib/insforge-server", () => ({
  createServerClient: async () => ({
    database: {
      from: (table: string) => makeUserBuilder(table),
      rpc: (...args: any[]) => consumeDownload(...args),
    },
    // The customer-session client must never download from digital-books.
    storage: {
      from: () => ({
        download: () => {
          throw new Error("customer-session storage download must not be used")
        },
      }),
    },
  }),
}))

vi.mock("@/lib/insforge-service", () => ({
  createServiceClient: () => {
    createServiceClient()
    return {
      database: {
        from: (table: string) => makeServiceBuilder(table),
      },
      storage: {
        from: () => ({ download: (key: string) => serviceStorageDownload(key) }),
      },
    }
  },
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

/** Service client must not have been constructed. */
function expectNoServiceClient() {
  expect(createServiceClient).not.toHaveBeenCalled()
  expect(serviceClientTables).toEqual([])
  expect(serviceStorageDownload).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUser.mockResolvedValue({ id: ME })
  userClientTables.length = 0
  serviceClientTables.length = 0
  tables.download_grants = [grant()]
  tables.order_items = [orderItem()]
  tables.orders = [{ id: "order-1", user_id: ME, payment_status: "paid" }]
  tables.digital_assets = [
    { format_id: "fmt-1", active: true, storage_key: "ebooks/1700-abc123.pdf" },
  ]
  serviceStorageDownload.mockResolvedValue({
    data: new Blob([new Uint8Array([1, 2, 3])], { type: "application/pdf" }),
    error: null,
  })
  consumeDownload.mockResolvedValue({
    data: { storage_key: "ebooks/1700-abc123.pdf", download_count: 1, max_downloads: 3 },
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
    expect(serviceStorageDownload).toHaveBeenCalledWith("ebooks/1700-abc123.pdf")
    expect(consumeDownload).toHaveBeenCalledWith("consume_download", {
      p_grant_id: "grant-1",
    })
  })

  it("uses the service client for digital_assets and storage, and the user client for consume_download", async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(createServiceClient).toHaveBeenCalledTimes(1)
    expect(serviceClientTables).toContain("digital_assets")
    expect(serviceStorageDownload).toHaveBeenCalledWith("ebooks/1700-abc123.pdf")
    // Steps 1–4 and consume_download stay on the customer-session client.
    expect(userClientTables).toContain("download_grants")
    expect(userClientTables).toContain("order_items")
    expect(userClientTables).toContain("orders")
    expect(consumeDownload).toHaveBeenCalledWith("consume_download", {
      p_grant_id: "grant-1",
    })
    // The customer-session client never read digital_assets.
    expect(userClientTables).not.toContain("digital_assets")
  })

  it("scopes the digital_assets lookup to the authorized order item's format_id", async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(appliedFilters.digital_assets).toEqual(
      expect.arrayContaining([
        ["format_id", "fmt-1"],
        ["active", true],
      ]),
    )
  })

  it("fetches the file before atomically consuming the download", async () => {
    // A storage failure must never cost the customer a download, so
    // the PDF is fetched first and the counter only moves afterwards.
    const res = await call()
    expect(res.status).toBe(200)
    expect(serviceStorageDownload.mock.invocationCallOrder[0]).toBeLessThan(
      consumeDownload.mock.invocationCallOrder[0],
    )
  })

  it("refuses when the atomic consume fails (limit hit concurrently)", async () => {
    consumeDownload.mockResolvedValue({
      data: null,
      error: { message: "Download limit reached" },
    })
    const res = await call()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/Maximum download limit reached or link expired/)
  })

  it("refuses when the atomic consume returns no result", async () => {
    consumeDownload.mockResolvedValue({ data: null, error: null })
    const res = await call()
    expect(res.status).toBe(403)
  })

  it("returns 500 (not 403) when the consume call itself fails", async () => {
    // A rejected RPC is an infrastructure failure, not a business
    // rejection: no download was counted and nothing was served.
    consumeDownload.mockRejectedValue(new Error("db down"))
    const res = await call()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Something went wrong. Please try again.")
  })

  it("refuses a grant that belongs to another customer without touching the service client", async () => {
    tables.download_grants = [grant({ user_id: OTHER })]
    const res = await call()
    expect(res.status).toBe(403)
    expectNoServiceClient()
  })

  it("refuses an unknown grant id without touching the service client", async () => {
    const res = await call("grant-does-not-exist")
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("Download grant not found or not authorized")
    expectNoServiceClient()
  })

  it("refuses a revoked grant without touching the service client", async () => {
    tables.download_grants = [grant({ revoked_at: new Date().toISOString() })]
    const res = await call()
    expect(res.status).toBe(403)
    expectNoServiceClient()
  })

  it("refuses an expired grant without touching the service client", async () => {
    tables.download_grants = [
      grant({ expires_at: new Date(Date.now() - 1000).toISOString() }),
    ]
    const res = await call()
    expect(res.status).toBe(403)
    expectNoServiceClient()
  })

  it("refuses once the download limit is reached without touching the service client", async () => {
    tables.download_grants = [grant({ download_count: 3, max_downloads: 3 })]
    const res = await call()
    expect(res.status).toBe(403)
    expectNoServiceClient()
  })

  it("refuses a non-digital order line without touching the service client", async () => {
    tables.order_items = [orderItem({ delivery_type_snapshot: "physical" })]
    const res = await call()
    expect(res.status).toBe(403)
    expectNoServiceClient()
  })

  it("refuses an unpaid order without touching the service client", async () => {
    tables.orders = [{ id: "order-1", user_id: ME, payment_status: "pending_payment" }]
    const res = await call()
    expect(res.status).toBe(403)
    expectNoServiceClient()
  })

  it("refuses an order that belongs to another customer without touching the service client", async () => {
    tables.orders = [{ id: "order-1", user_id: OTHER, payment_status: "paid" }]
    const res = await call()
    expect(res.status).toBe(403)
    expectNoServiceClient()
  })

  it("refuses everything when the user is not authenticated without touching the service client", async () => {
    requireUser.mockRejectedValue(new Response("{}", { status: 401 }))
    const res = await call()
    expect(res.status).toBe(401)
    expectNoServiceClient()
  })

  it("returns 404 when no active digital_assets row exists", async () => {
    tables.digital_assets = []
    const res = await call()
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("No file attached to this order")
    expect(serviceStorageDownload).not.toHaveBeenCalled()
    expect(consumeDownload).not.toHaveBeenCalled()
  })

  it("returns 404 when no active digital_assets row exists for the format", async () => {
    // Inactive row for the same format must not satisfy the lookup.
    tables.digital_assets = [
      { format_id: "fmt-1", active: false, storage_key: "ebooks/old.pdf" },
    ]
    const res = await call()
    expect(res.status).toBe(404)
    expect(serviceStorageDownload).not.toHaveBeenCalled()
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
    expect(serviceStorageDownload).not.toHaveBeenCalled()
    expect(consumeDownload).not.toHaveBeenCalled()
  })

  it("returns 404 and does not consume a download when the storage download fails", async () => {
    serviceStorageDownload.mockResolvedValue({
      data: null,
      error: { message: "object not found" },
    })
    const res = await call()
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("File not found in storage")
    expect(consumeDownload).not.toHaveBeenCalled()
  })
})
