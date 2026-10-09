// lib/nagorikpay.ts
// NagorikPay API client for payment creation and verification.
// Docs: https://nagorikpay.com/developers/docs

const NAGORIKPAY_API_KEY = process.env.NAGORIKPAY_API_KEY!
const NAGORIKPAY_BASE_URL =
  process.env.NAGORIKPAY_BASE_URL || "https://secure-pay.nagorikpay.com/api/payment"

interface NagorikPayCreatePayload {
  cus_name: string
  cus_email: string
  amount: string
  success_url: string
  cancel_url: string
  webhook_url?: string
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
      "API-KEY": NAGORIKPAY_API_KEY,
    },
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`NagorikPay create failed: ${res.status} ${text}`)
  }

  let data: NagorikPayCreateResponse
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`NagorikPay create returned non-JSON: ${text}`)
  }

  if (data.status !== true || !data.payment_url) {
    throw new Error(`NagorikPay create error: ${data.message || text}`)
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
      "API-KEY": NAGORIKPAY_API_KEY,
    },
    body: JSON.stringify({ transaction_id: transactionId }),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`NagorikPay verify failed: ${res.status} ${text}`)
  }

  let data: NagorikPayVerifyResponse | { status: false; message: string }
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`NagorikPay verify returned non-JSON: ${text}`)
  }

  if ((data as { status: boolean }).status === false) {
    const message = (data as { message?: string }).message || text
    throw new Error(`NagorikPay verify error: ${message}`)
  }

  return data as NagorikPayVerifyResponse
}
