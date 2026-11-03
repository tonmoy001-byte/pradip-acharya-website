import { describe, it, expect } from "vitest"
import { assertSameOrigin } from "@/lib/origin-check"

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/test", {
    method: "POST",
    headers,
  })
}

describe("assertSameOrigin", () => {
  it("allows a request with no Origin and no Sec-Fetch-Site", () => {
    expect(() => assertSameOrigin(makeReq())).not.toThrow()
  })

  it("allows a same-origin request with Sec-Fetch-Site: same-origin", () => {
    expect(() =>
      assertSameOrigin(makeReq({ "sec-fetch-site": "same-origin" })),
    ).not.toThrow()
  })

  it("allows Sec-Fetch-Site: none (e.g. navigation, form POST)", () => {
    expect(() =>
      assertSameOrigin(makeReq({ "sec-fetch-site": "none" })),
    ).not.toThrow()
  })

  it("rejects cross-site fetch (Sec-Fetch-Site: cross-site)", () => {
    let thrown: Response | null = null
    try {
      assertSameOrigin(makeReq({ "sec-fetch-site": "cross-site" }))
    } catch (e) {
      thrown = e as Response
    }
    expect(thrown).not.toBeNull()
    expect(thrown!.status).toBe(403)
  })

  it("allows an Origin that matches the host", () => {
    expect(() =>
      assertSameOrigin(
        makeReq({ origin: "https://example.com", host: "example.com" }),
      ),
    ).not.toThrow()
  })

  it("allows an Origin that matches x-forwarded-host", () => {
    expect(() =>
      assertSameOrigin(
        makeReq({
          origin: "https://example.com",
          "x-forwarded-host": "example.com",
        }),
      ),
    ).not.toThrow()
  })

  it("rejects an Origin from a different host", () => {
    let thrown: Response | null = null
    try {
      assertSameOrigin(
        makeReq({ origin: "https://evil.com", host: "example.com" }),
      )
    } catch (e) {
      thrown = e as Response
    }
    expect(thrown).not.toBeNull()
    expect(thrown!.status).toBe(403)
  })

  it("rejects a malformed Origin header", () => {
    let thrown: Response | null = null
    try {
      assertSameOrigin(makeReq({ origin: "not-a-url", host: "example.com" }))
    } catch (e) {
      thrown = e as Response
    }
    expect(thrown).not.toBeNull()
    expect(thrown!.status).toBe(403)
  })
})