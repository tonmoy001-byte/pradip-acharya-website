import { describe, it, expect } from "vitest"
import { classifyGatewayStatus } from "./payment-status"

describe("classifyGatewayStatus", () => {
  it("returns paid for COMPLETED and SUCCESS", () => {
    expect(classifyGatewayStatus("COMPLETED")).toBe("paid")
    expect(classifyGatewayStatus("SUCCESS")).toBe("paid")
    expect(classifyGatewayStatus("completed")).toBe("paid")
    expect(classifyGatewayStatus("success")).toBe("paid")
  })

  it("returns pending for PENDING", () => {
    expect(classifyGatewayStatus("PENDING")).toBe("pending")
    expect(classifyGatewayStatus("Pending")).toBe("pending")
    expect(classifyGatewayStatus("pending")).toBe("pending")
  })

  it("returns failed for ERROR and unknown", () => {
    expect(classifyGatewayStatus("ERROR")).toBe("failed")
    expect(classifyGatewayStatus("error")).toBe("failed")
    expect(classifyGatewayStatus("weird")).toBe("failed")
  })

  it("handles non-string inputs", () => {
    expect(classifyGatewayStatus(undefined)).toBe("failed")
    expect(classifyGatewayStatus(null)).toBe("failed")
    expect(classifyGatewayStatus("")).toBe("failed")
    expect(classifyGatewayStatus(123)).toBe("failed")
  })
})