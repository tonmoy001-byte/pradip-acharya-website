import { describe, it, expect } from "vitest"
import { sanitizePostgREST, quotePostgrestValue } from "./sanitize-postgrest"

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

describe("quotePostgrestValue", () => {
  it("wraps the value in double quotes", () => {
    expect(quotePostgrestValue("abc")).toBe('"abc"')
  })

  it("keeps commas, dots and parentheses literal inside the quotes", () => {
    expect(quotePostgrestValue("a,b.c(d)")).toBe('"a,b.c(d)"')
  })

  it("escapes embedded quotes and backslashes", () => {
    expect(quotePostgrestValue('a"b\\c')).toBe('"a\\"b\\\\c"')
  })

  it("truncates long input to the max length", () => {
    const long = "x".repeat(150)
    expect(quotePostgrestValue(long)).toBe(`"${"x".repeat(100)}"`)
  })

  it("handles empty string", () => {
    expect(quotePostgrestValue("")).toBe('""')
  })
})
