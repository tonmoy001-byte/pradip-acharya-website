import { describe, it, expect } from "vitest"
import { sanitizePostgREST } from "./sanitize-postgrest"

describe("sanitizePostgREST", () => {
  it("escapes special characters", () => {
    expect(sanitizePostgREST("abc%def")).toBe("abc%25def")
    expect(sanitizePostgREST("abc(def)")).toBe("abc%28def%29")
    expect(sanitizePostgREST("a,b,c")).toBe("a%2Cb%2Cc")
  })

  it("handles empty string", () => {
    expect(sanitizePostgREST("")).toBe("")
  })

  it("does not change safe strings", () => {
    expect(sanitizePostgREST("abc123")).toBe("abc123")
  })
})