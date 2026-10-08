// app/api/contact/route.test.ts
// Guards the contact route's recipient resolution.
//
// site_settings.value is JSONB, so a stored email can arrive as a plain
// string or as a JSON object written by an admin tool. The route must accept
// both, otherwise the admin UI's `{"email": "..."}` shape silently produces
// the misleading "যোগাযোগ ইমেইল সেটআপ করা হয়নি।" error.

import { describe, it, expect } from "vitest"
import { extractContactEmail } from "@/lib/contact-form"

describe("extractContactEmail", () => {
  it("reads a plain string", () => {
    expect(extractContactEmail("Pradipkumaracharjee78@gmail.com")).toBe(
      "Pradipkumaracharjee78@gmail.com",
    )
  })

  it("reads a JSON object with an email key", () => {
    expect(extractContactEmail({ email: "Pradipkumaracharjee78@gmail.com" })).toBe(
      "Pradipkumaracharjee78@gmail.com",
    )
  })

  it("reads a JSON object with a value key", () => {
    expect(extractContactEmail({ value: "Pradipkumaracharjee78@gmail.com" })).toBe(
      "Pradipkumaracharjee78@gmail.com",
    )
  })

  it("reads a JSON object with an address key", () => {
    expect(extractContactEmail({ address: "Pradipkumaracharjee78@gmail.com" })).toBe(
      "Pradipkumaracharjee78@gmail.com",
    )
  })

  it("reads a JSON-string object (as returned by getSiteSettings)", () => {
    expect(extractContactEmail(JSON.stringify({ email: "Pradipkumaracharjee78@gmail.com" }))).toBe(
      "Pradipkumaracharjee78@gmail.com",
    )
  })

  it("trims surrounding whitespace", () => {
    expect(extractContactEmail("  Pradipkumaracharjee78@gmail.com  ")).toBe(
      "Pradipkumaracharjee78@gmail.com",
    )
  })

  it("returns empty for null, undefined and empty string", () => {
    expect(extractContactEmail(null)).toBe("")
    expect(extractContactEmail(undefined)).toBe("")
    expect(extractContactEmail("")).toBe("")
    expect(extractContactEmail("   ")).toBe("")
  })

  it("returns empty for a malformed JSON object", () => {
    expect(extractContactEmail("{ not json }")).toBe("")
  })

  it("returns empty when the object has no recognised email key", () => {
    expect(extractContactEmail({ name: "someone" })).toBe("")
  })

  it("never returns the wrong address", () => {
    // The previous recipient must not survive through any stored shape.
    expect(extractContactEmail("itay89640@gmail.com")).not.toBe(
      "Pradipkumaracharjee78@gmail.com",
    )
    expect(extractContactEmail({ email: "itay89640@gmail.com" })).not.toBe(
      "Pradipkumaracharjee78@gmail.com",
    )
  })
})