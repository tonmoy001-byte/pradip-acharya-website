import { describe, it, expect } from "vitest"
import { isAllowedPaymentUrl } from "./payment-url"

describe("isAllowedPaymentUrl", () => {
  it("allows valid NagorikPay hosts", () => {
    expect(isAllowedPaymentUrl("https://secure-pay.nagorikpay.com/execute/abc")).toBe(true)
    expect(isAllowedPaymentUrl("https://sandbox-api.nagorikpay.com/execute/xyz")).toBe(true)
    expect(isAllowedPaymentUrl("https://secure-pay.nagorikpay.com/api/payment/create")).toBe(true)
  })

  it("rejects http protocol", () => {
    expect(isAllowedPaymentUrl("http://secure-pay.nagorikpay.com/execute/abc")).toBe(false)
  })

  it("rejects look-alike hosts", () => {
    expect(isAllowedPaymentUrl("https://secure-pay.nagorikpay.com.evil.io")).toBe(false)
    expect(isAllowedPaymentUrl("https://evilsecure-pay.nagorikpay.com")).toBe(false)
    expect(isAllowedPaymentUrl("https://secure-pay.nagorikpay.com.fake.com")).toBe(false)
  })

  it("rejects garbage and non-strings", () => {
    expect(isAllowedPaymentUrl("not a url")).toBe(false)
    expect(isAllowedPaymentUrl("")).toBe(false)
    expect(isAllowedPaymentUrl(null)).toBe(false)
    expect(isAllowedPaymentUrl(undefined)).toBe(false)
    expect(isAllowedPaymentUrl(123)).toBe(false)
  })
})