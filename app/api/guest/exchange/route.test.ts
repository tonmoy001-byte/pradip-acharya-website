// app/api/guest/exchange/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const isRateLimited = vi.fn()

vi.mock("@/lib/guest-rate-limit", () => ({
  clientIpFirst: () => "1.2.3.4",
  isRateLimited: (...args: any[]) => isRateLimited(...args),
}))

vi.mock("@/lib/insforge-service", () => ({
  createServiceClient: () => ({
    database: { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "forbidden" } }) },
  }),
}))

vi.mock("@/lib/guest-token", () => ({
  sha256hex: (v: string) => "h-" + v,
}))

import { GET } from "./route"

const UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

beforeEach(() => {
  vi.clearAllMocks()
  isRateLimited.mockResolvedValue(false)
})

describe("guest exchange rate limit", () => {
  it("returns 429 when limited", async () => {
    isRateLimited.mockResolvedValue(true)
    const res = await GET(new Request(`https://site.test/api/guest/exchange?order_id=${UUID}&t=${"A".repeat(43)}`))
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("600")
  })

  it("does not block when limiter throws (fail open)", async () => {
    isRateLimited.mockRejectedValue(new Error("db down"))
    const res = await GET(new Request(`https://site.test/api/guest/exchange?order_id=${UUID}&t=${"A".repeat(43)}`))
    expect(res.status).not.toBe(429)
  })
})
