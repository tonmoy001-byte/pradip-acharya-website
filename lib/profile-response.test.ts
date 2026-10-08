import { describe, it, expect } from "vitest"
import { parseProfileResponse } from "./profile-response"

describe("parseProfileResponse", () => {
  it("maps core fields from a valid payload", () => {
    const parsed = parseProfileResponse({
      data: { user_id: "u-1", email: "a@b.com", full_name: "Tonmoy" },
    })
    expect(parsed).toEqual({ id: "u-1", email: "a@b.com", name: "Tonmoy", isAdmin: false })
  })

  it("falls back to email local-part when full_name is missing", () => {
    const parsed = parseProfileResponse({ data: { user_id: "u-1", email: "a@b.com" } })
    expect(parsed?.name).toBe("a")
  })

  it("maps is_admin true to isAdmin true", () => {
    const parsed = parseProfileResponse({
      data: { user_id: "u-1", email: "a@b.com", is_admin: true },
    })
    expect(parsed?.isAdmin).toBe(true)
  })

  it("treats missing is_admin as false", () => {
    const parsed = parseProfileResponse({ data: { user_id: "u-1", email: "a@b.com" } })
    expect(parsed?.isAdmin).toBe(false)
  })

  it("returns null for missing data", () => {
    expect(parseProfileResponse({ error: "unauthorized" })).toBe(null)
    expect(parseProfileResponse(null)).toBe(null)
    expect(parseProfileResponse(undefined)).toBe(null)
  })

  it("returns null when user_id is missing or not a string", () => {
    expect(parseProfileResponse({ data: { email: "a@b.com" } })).toBe(null)
    expect(parseProfileResponse({ data: { user_id: 42, email: "a@b.com" } })).toBe(null)
  })
})
