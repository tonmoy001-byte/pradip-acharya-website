// app/api/guest-downloads/[grantId]/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const isRateLimited = vi.fn()
const cookiesGet = vi.fn()

vi.mock("@/lib/guest-rate-limit", () => ({
  clientIpFirst: () => "1.2.3.4",
  isRateLimited: (...args: any[]) => isRateLimited(...args),
}))

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => cookiesGet(name) }),
}))

vi.mock("@/lib/insforge-service", () => ({
  createServiceClient: () => ({
    database: { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "forbidden" } }) },
    storage: { from: () => ({ download: vi.fn() }) },
  }),
}))

vi.mock("@/lib/guest-token", () => ({
  sha256hex: (v: string) => "h-" + v,
}))

import { GET } from "./route"

const UUID = "11111111-2222-3333-4444-555555555555"
const ORDER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

function req() {
  return new Request(`https://site.test/api/guest-downloads/${UUID}?order_id=${ORDER}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  cookiesGet.mockReturnValue({ value: "A".repeat(43) })
  isRateLimited.mockResolvedValue(false)
})

describe("guest download rate limit", () => {
  it("returns 429 when limited", async () => {
    isRateLimited.mockResolvedValue(true)
    const res = await GET(req(), { params: Promise.resolve({ grantId: UUID }) })
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("600")
    expect(res.headers.get("Cache-Control")).toBe("no-store")
  })

  it("does not block when limiter throws (fail open)", async () => {
    isRateLimited.mockRejectedValue(new Error("db down"))
    const res = await GET(req(), { params: Promise.resolve({ grantId: UUID }) })
    expect(res.status).not.toBe(429)
  })

  it("IDOR: RPC forbidden -> 403 denied", async () => {
    isRateLimited.mockResolvedValue(false)
    cookiesGet.mockReturnValue({ value: "A".repeat(43) })
    const res = await GET(req(), { params: Promise.resolve({ grantId: UUID }) })
    expect(res.status).toBe(403)
  })
})
