import { describe, it, expect } from "vitest"
import { authFailureStatus } from "./auth-helpers"

describe("authFailureStatus (P1 admin auth error handling)", () => {
  it("maps expired/invalid session (401) to 401", () => {
    expect(authFailureStatus({ statusCode: 401 })).toBe(401)
  })

  it("maps InsForge 403 auth error to 401 (session problem)", () => {
    expect(authFailureStatus({ statusCode: 403 })).toBe(401)
  })

  it("maps network/unexpected error (no statusCode) to 500", () => {
    expect(authFailureStatus(new Error("network down"))).toBe(500)
    expect(authFailureStatus(null)).toBe(500)
    expect(authFailureStatus(undefined)).toBe(500)
  })

  it("maps 5xx InsForge failure to 500 (system, not logged out)", () => {
    expect(authFailureStatus({ statusCode: 500 })).toBe(500)
    expect(authFailureStatus({ statusCode: 502 })).toBe(500)
    expect(authFailureStatus({ statusCode: 0 })).toBe(500)
  })
})
