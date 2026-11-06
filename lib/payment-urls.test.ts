import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

describe("paymentUrls", () => {
  const originalAppUrl = process.env.APP_URL
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL

  beforeEach(() => {
    vi.resetModules()
    process.env.APP_URL = "https://pradipuponnash.com"
    process.env.NEXT_PUBLIC_SITE_URL = "https://cpd9mnqf.ap-southeast.insforge.app"
  })

  afterEach(() => {
    process.env.APP_URL = originalAppUrl
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl
    vi.resetModules()
  })

  it("builds payment callback URLs from APP_URL", async () => {
    const { paymentUrls } = await import("./payment-urls")
    const urls = paymentUrls("123e4567-e89b-12d3-a456-426614174000")
    expect(urls.success).toBe(
      "https://pradipuponnash.com/payment/success?order_id=123e4567-e89b-12d3-a456-426614174000",
    )
    expect(urls.cancel).toBe(
      "https://pradipuponnash.com/payment/cancel?order_id=123e4567-e89b-12d3-a456-426614174000",
    )
    expect(urls.webhook).toBe("https://pradipuponnash.com/api/payment/webhook")
  })
})