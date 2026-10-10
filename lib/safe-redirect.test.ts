import { describe, it, expect } from "vitest"
import { safeNextPath } from "./safe-redirect"

describe("safeNextPath", () => {
  it("returns valid checkout path", () => {
    expect(safeNextPath("/checkout?book=chhera-pushpo")).toBe("/checkout?book=chhera-pushpo")
  })

  it("blocks double-slash open redirect", () => {
    expect(safeNextPath("//evil.com")).toBe("/")
    expect(safeNextPath("/\\evil.com")).toBe("/")
    expect(safeNextPath("https://evil.com")).toBe("/")
    expect(safeNextPath("javascript:alert(1)")).toBe("/")
    // URL-encoded double-slash is a path starting with single / — harmless but not fallback
    expect(safeNextPath("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com")
  })

  it("handles empty and nullish inputs", () => {
    expect(safeNextPath("")).toBe("/")
    expect(safeNextPath(null)).toBe("/")
    expect(safeNextPath(undefined)).toBe("/")
  })

  it("uses custom fallback", () => {
    expect(safeNextPath("//evil.com", "/fallback")).toBe("/fallback")
  })

  it("rejects full URLs (returns fallback, does not extract path)", () => {
    expect(safeNextPath("https://example.com/checkout")).toBe("/")
  })
})