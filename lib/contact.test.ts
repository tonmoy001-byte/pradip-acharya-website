import { describe, it, expect } from "vitest"
import { toWhatsAppUrl } from "./contact"

describe("toWhatsAppUrl", () => {
  it("converts BD local format to international 880", () => {
    expect(toWhatsAppUrl("01712-345678")).toBe("https://wa.me/8801712345678")
    expect(toWhatsAppUrl("0171234567")).toBe("https://wa.me/880171234567")
  })

  it("normalizes international format with +, spaces and dashes", () => {
    expect(toWhatsAppUrl("+880-1712 345 678")).toBe("https://wa.me/8801712345678")
  })

  it("keeps already-880 numbers unchanged", () => {
    expect(toWhatsAppUrl("8801712345678")).toBe("https://wa.me/8801712345678")
  })

  it("leaves non-BD international numbers unchanged", () => {
    expect(toWhatsAppUrl("+1 415 555 2671")).toBe("https://wa.me/14155552671")
  })

  it("returns null for empty or non-numeric input", () => {
    expect(toWhatsAppUrl("")).toBeNull()
    expect(toWhatsAppUrl("   ")).toBeNull()
    expect(toWhatsAppUrl(null)).toBeNull()
    expect(toWhatsAppUrl(undefined)).toBeNull()
    expect(toWhatsAppUrl("abc")).toBeNull()
  })

  it("returns null below 7 digits, passes at exactly 7", () => {
    expect(toWhatsAppUrl("012345")).toBeNull()
    expect(toWhatsAppUrl("12-34")).toBeNull()
    expect(toWhatsAppUrl("1234567")).toBe("https://wa.me/1234567")
  })
})
