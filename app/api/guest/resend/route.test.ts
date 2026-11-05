// app/api/guest/resend/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const isRateLimited = vi.fn()

vi.mock("@/lib/guest-rate-limit", () => ({
  clientIp: () => "1.2.3.4",
  isRateLimited: (...args: any[]) => isRateLimited(...args),
}))

const serviceFrom = vi.fn()
vi.mock("@/lib/insforge-service", () => ({
  createServiceClient: () => ({ database: { from: (...a: any[]) => serviceFrom(...a) } }),
}))

vi.mock("@/lib/guest-token", () => ({
  newToken: () => "tok",
  sha256hex: (v: string) => "h-" + v,
}))

vi.mock("@/lib/guest-delivery", () => ({
  guestExchangeUrl: (oid: string, t: string) => `https://site.test/api/guest/exchange?order_id=${oid}&t=${t}`,
}))

vi.mock("@/lib/email", () => ({
  sendGuestLinksEmail: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from "./route"

beforeEach(() => {
  vi.clearAllMocks()
  isRateLimited.mockResolvedValue(false)
  serviceFrom.mockImplementation((table: string) => {
    if (table === "orders") {
      return {
        select: () => ({
          is: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
        update: () => ({ eq: () => ({ is: () => ({ eq: () => Promise.resolve({}) }) }) }),
      }
    }
    return {}
  })
})

describe("guest resend", () => {
  it("returns uniform success for unknown email", async () => {
    const res = await POST(new Request("https://site.test/api/guest/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com" }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body).not.toHaveProperty("order_id")
  })

  it("returns uniform success when rate limited (no leak)", async () => {
    isRateLimited.mockResolvedValue(true)
    const res = await POST(new Request("https://site.test/api/guest/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.c" }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it("returns uniform success for invalid email format", async () => {
    const res = await POST(new Request("https://site.test/api/guest/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "notanemail" }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})