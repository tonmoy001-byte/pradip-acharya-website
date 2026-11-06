import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

describe("siteUrl", () => {
  const previousAppUrl = process.env.APP_URL
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL

  beforeEach(() => {
    vi.resetModules()
    delete process.env.APP_URL
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  afterEach(() => {
    process.env.APP_URL = previousAppUrl
    process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("uses APP_URL with priority over NEXT_PUBLIC_SITE_URL", async () => {
    process.env.APP_URL = "https://pradipuponnash.com"
    process.env.NEXT_PUBLIC_SITE_URL = "https://cpd9mnqf.ap-southeast.insforge.app"
    const { SITE_URL } = await import("./siteUrl")
    expect(SITE_URL).toBe("https://pradipuponnash.com")
  })

  it("falls back to NEXT_PUBLIC_SITE_URL when APP_URL is missing", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://pradipuponnash.com"
    const { SITE_URL } = await import("./siteUrl")
    expect(SITE_URL).toBe("https://pradipuponnash.com")
  })

  it("rejects localhost in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    process.env.APP_URL = "http://localhost:3000"
    await expect(import("./siteUrl")).rejects.toThrow(/localhost/)
  })

  it("rejects non-https in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    process.env.APP_URL = "http://pradipuponnash.com"
    await expect(import("./siteUrl")).rejects.toThrow(/https/)
  })
})