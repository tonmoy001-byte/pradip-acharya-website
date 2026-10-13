// lib/nagorikpay.ts
// NagorikPay API client for payment creation and verification.
// Docs: https://nagorikpay.com/developers/docs

const NAGORIKPAY_BASE_URL =
  process.env.NAGORIKPAY_BASE_URL || "https://secure-pay.nagorikpay.com/api/payment"

/** Resolve the API key at call time so a missing key fails loudly, not as `API-KEY: undefined`. */
function apiKey(): string {
  const key = process.env.NAGORIKPAY_API_KEY
  if (!key) throw new Error("NAGORIKPAY_API_KEY is not set")
  return key
}

interface NagorikPayCreatePayload {
  cus_name: string
  cus_email: string
  amount: string
  success_url: string
  cancel_url: string
  webhook_url?: string
  order_id?: string
  metadata?: Record<string, unknown>
}

interface NagorikPayCreateResponse {
  status: boolean
  message: string
  payment_url: string
}

interface NagorikPayVerifyResponse {
  cus_name: string
  cus_email: string
  amount: string
  transaction_id: string
  payment_method: string
  status: string
  metadata?: Record<string, any>
}

/**
 * Format amount for NagorikPay create API.
 * Natural numbers must not carry trailing zeros (10, not 10.00).
 */
export function formatNagorikPayAmount(amount: number): string {
  if (!Number.isFinite(amount)) throw new Error("Invalid amount")
  if (Number.isInteger(amount)) return String(amount)
  return String(Math.round(amount * 100) / 100)
}

/**
 * Create a NagorikPay payment session.
 * Returns the payment URL to redirect the customer to.
 */
export async function createNagorikPayPayment(
  payload: NagorikPayCreatePayload,
): Promise<NagorikPayCreateResponse> {
  const res = await fetch(`${NAGORIKPAY_BASE_URL}/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "API-KEY": apiKey(),
    },
    body: JSON.stringify(payload),
  })

  const text = await res.text()

  // TEMPORARY DEBUG LOGGING — capture the full gateway response so the
  // payment flow failure can be diagnosed. Remove once confirmed working.
  console.info("[nagorikpay] create response", {
    status: res.status,
    ok: res.ok,
    headers: Object.fromEntries(res.headers.entries()),
    body: text,
  })

  if (!res.ok) {
    // Gateway error bodies can contain stack fragments and internal
    // detail. Log them server-side; throw a short, safe message.
    console.error("[nagorikpay] create HTTP error", { status: res.status, body: text })
    throw new Error(`NagorikPay create failed: HTTP ${res.status}`)
  }

  let data: NagorikPayCreateResponse
  try {
    data = JSON.parse(text)
  } catch {
    console.error("[nagorikpay] create returned non-JSON", { body: text })
    throw new Error("NagorikPay create failed: non-JSON response")
  }

  if (!data.payment_url || typeof data.payment_url !== "string") {
    // Treat any non-empty payment_url as success — the gateway sometimes
    // returns status as 1/"true" rather than boolean true.
    console.error("[nagorikpay] create returned no payment_url", {
      status: data.status,
      message: (data as { message?: unknown }).message,
      payload: text,
    })
    throw new Error("NagorikPay create failed: no payment_url returned")
  }

  return data
}

/**
 * Verify a NagorikPay transaction.
 * Returns the payment status and details.
 */
export async function verifyNagorikPayPayment(
  transactionId: string,
): Promise<NagorikPayVerifyResponse> {
  const res = await fetch(`${NAGORIKPAY_BASE_URL}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "API-KEY": apiKey(),
    },
    body: JSON.stringify({ transaction_id: transactionId }),
  })

  const text = await res.text()
  if (!res.ok) {
    console.error("[nagorikpay] verify HTTP error", { status: res.status, body: text })
    throw new Error(`NagorikPay verify failed: HTTP ${res.status}`)
  }

  let data: NagorikPayVerifyResponse | { status: false; message: string }
  try {
    data = JSON.parse(text)
  } catch {
    console.error("[nagorikpay] verify returned non-JSON", { body: text })
    throw new Error("NagorikPay verify failed: non-JSON response")
  }

  if ((data as { status: boolean }).status === false) {
    const message = (data as { message?: string }).message || text
    console.error("[nagorikpay] verify error", { message })
    throw new Error("NagorikPay verify failed")
  }

  // The gateway sometimes returns metadata as a JSON-encoded string and
  // sometimes omits it entirely. Normalize so callers can rely on an object.
  const verifyData = data as NagorikPayVerifyResponse
  verifyData.metadata = normalizeMetadata(verifyData.metadata)

  return verifyData
}

/** Coerce gateway metadata (object | JSON string | missing) into a plain object. */
function normalizeMetadata(raw: unknown): Record<string, any> {
  if (raw == null) return {}
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, any>
      }
    } catch {
      // fall through — unparseable string becomes {}
    }
    return {}
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, any>
  }
  return {}
}
