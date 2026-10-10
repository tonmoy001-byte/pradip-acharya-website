import { describe, it, expect } from "vitest"
import { verifyWebhookSignature } from "./nagorikpay-webhook"
import { createHmac } from "node:crypto"

function sign(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")
}

const testSecret = "test-secret-key"
const testTimestamp = String(Math.floor(Date.now() / 1000))
const testBody = "transactionId=TEST123&status=completed&paymentMethod=bkash&paymentAmount=100&paymentFee=1.5&amount=100"

describe("verifyWebhookSignature", () => {
  it("accepts valid signature with sha256= prefix", () => {
    const sig = "sha256=" + sign(testSecret, testTimestamp, testBody)
    expect(verifyWebhookSignature(testBody, testTimestamp, sig, testSecret)).toBe(true)
  })

  it("accepts valid signature without sha256= prefix", () => {
    const sig = sign(testSecret, testTimestamp, testBody)
    expect(verifyWebhookSignature(testBody, testTimestamp, sig, testSecret)).toBe(true)
  })

  it("rejects tampered body", () => {
    const tamperedBody = "transactionId=TEST123&status=completed&paymentMethod=bkash&paymentAmount=100&paymentFee=1.5&amount=999"
    const sig = sign(testSecret, testTimestamp, testBody)
    expect(verifyWebhookSignature(tamperedBody, testTimestamp, sig, testSecret)).toBe(false)
  })

  it("rejects wrong secret", () => {
    const sig = sign(testSecret, testTimestamp, testBody)
    expect(verifyWebhookSignature(testBody, testTimestamp, sig, "wrong-secret")).toBe(false)
  })

  it("rejects stale timestamp (> 300s)", () => {
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 400)
    const sig = sign(testSecret, oldTimestamp, testBody)
    expect(verifyWebhookSignature(testBody, oldTimestamp, sig, testSecret)).toBe(false)
  })

  it("rejects future timestamp (> 300s ahead)", () => {
    const futureTimestamp = String(Math.floor(Date.now() / 1000) + 400)
    const sig = sign(testSecret, futureTimestamp, testBody)
    expect(verifyWebhookSignature(testBody, futureTimestamp, sig, testSecret)).toBe(false)
  })

  it("rejects non-numeric timestamp", () => {
    const sig = sign(testSecret, testTimestamp, testBody)
    expect(verifyWebhookSignature(testBody, "not-a-number", sig, testSecret)).toBe(false)
  })

  it("rejects missing headers", () => {
    const sig = sign(testSecret, testTimestamp, testBody)
    expect(verifyWebhookSignature(testBody, null, sig, testSecret)).toBe(false)
    expect(verifyWebhookSignature(testBody, testTimestamp, null, testSecret)).toBe(false)
  })

  it("rejects different-length signature", () => {
    const sig = "sha256=" + sign(testSecret, testTimestamp, testBody).slice(0, -1)
    expect(verifyWebhookSignature(testBody, testTimestamp, sig, testSecret)).toBe(false)
  })

  it("returns false when secret is missing (fail-closed)", () => {
    const sig = sign(testSecret, testTimestamp, testBody)
    expect(verifyWebhookSignature(testBody, testTimestamp, sig, undefined)).toBe(false)
    expect(verifyWebhookSignature(testBody, testTimestamp, sig, null)).toBe(false)
  })
})