// lib/nagorikpay.test.ts
// Gateway metadata normalization regression tests.
//
// The NagorikPay verify response sometimes returns `metadata` as a
// JSON-encoded string and sometimes omits it entirely. Settlement code
// reads `metadata.order_id` / `metadata.user_id`, so verifyNagorikPayPayment
// must always hand back a plain object.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { verifyNagorikPayPayment } from "./nagorikpay"

const fetchMock = vi.fn()

function okJson(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

function verifyPayload(overrides: Record<string, unknown> = {}) {
  return {
    cus_name: "Test User",
    cus_email: "t@t.c",
    amount: "150",
    transaction_id: "txn-1",
    payment_method: "bKash",
    status: "COMPLETED",
    ...overrides,
  }
}

beforeEach(() => {
  process.env.NAGORIKPAY_API_KEY = "test-key"
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  delete process.env.NAGORIKPAY_API_KEY
})

describe("verifyNagorikPayPayment metadata normalization", () => {
  it("parses metadata when the gateway returns it as a JSON string", async () => {
    fetchMock.mockResolvedValue(
      okJson(
        verifyPayload({
          metadata: JSON.stringify({ order_id: "order-1", user_id: "user-1" }),
        }),
      ),
    )

    const result = await verifyNagorikPayPayment("txn-1")

    expect(result.metadata).toEqual({ order_id: "order-1", user_id: "user-1" })
  })

  it("uses {} when metadata is missing", async () => {
    fetchMock.mockResolvedValue(okJson(verifyPayload()))

    const result = await verifyNagorikPayPayment("txn-1")

    expect(result.metadata).toEqual({})
  })

  it("uses {} when metadata is an unparseable JSON string", async () => {
    fetchMock.mockResolvedValue(okJson(verifyPayload({ metadata: "{not json" })))

    const result = await verifyNagorikPayPayment("txn-1")

    expect(result.metadata).toEqual({})
  })

  it("uses {} when metadata parses to a non-object", async () => {
    fetchMock.mockResolvedValue(okJson(verifyPayload({ metadata: '"just a string"' })))

    const result = await verifyNagorikPayPayment("txn-1")

    expect(result.metadata).toEqual({})
  })

  it("keeps an object metadata as-is", async () => {
    const metadata = { order_id: "order-9", user_id: "user-9" }
    fetchMock.mockResolvedValue(okJson(verifyPayload({ metadata })))

    const result = await verifyNagorikPayPayment("txn-1")

    expect(result.metadata).toEqual(metadata)
  })
})
