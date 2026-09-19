// lib/rupantor.ts
// RupantorPay API client for payment creation and verification.

const RUPANTOR_API_KEY = process.env.RUPANTOR_PAY_API_KEY!
const RUPANTOR_BASE_URL = process.env.RUPANTOR_PAY_BASE_URL || "https://payment.rupantorpay.com/api/payment"

interface RupantorCreatePayload {
  fullname: string
  email: string
  amount: string
  success_url: string
  cancel_url: string
  webhook_url?: string
  metadata?: Record<string, any>
}

interface RupantorCreateResponse {
  status: number
  message: string
  payment_url: string
}

interface RupantorVerifyPayload {
  transaction_id: string
}

interface RupantorVerifyResponse {
  fullname: string
  email: string
  amount: string
  transaction_id: string
  trx_id: string
  payment_method: string
  status: string
  metadata?: Record<string, any>
}

/**
 * Create a RupantorPay payment session.
 * Returns the payment URL to redirect the customer to.
 */
export async function createRupantorPayment(payload: RupantorCreatePayload): Promise<RupantorCreateResponse> {
  const res = await fetch(`${RUPANTOR_BASE_URL}/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": RUPANTOR_API_KEY,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`RupantorPay create failed: ${res.status} ${error}`)
  }

  return res.json()
}

/**
 * Verify a RupantorPay transaction.
 * Returns the payment status and details.
 */
export async function verifyRupantorPayment(transactionId: string): Promise<RupantorVerifyResponse> {
  const res = await fetch(`${RUPANTOR_BASE_URL}/verify-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": RUPANTOR_API_KEY,
    },
    body: JSON.stringify({ transaction_id: transactionId }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`RupantorPay verify failed: ${res.status} ${error}`)
  }

  return res.json()
}
