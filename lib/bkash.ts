// lib/bkash.ts
// Server-side bKash Tokenized Checkout API helpers.
// All credentials are kept server-side only — never exposed to the client.

const BKASH_ENV = process.env.BKASH_ENV || "sandbox"
const BKASH_USERNAME = process.env.BKASH_USERNAME || ""
const BKASH_PASSWORD = process.env.BKASH_PASSWORD || ""
const BKASH_APP_KEY = process.env.BKASH_APP_KEY || ""
const BKASH_APP_SECRET = process.env.BKASH_APP_SECRET || ""

const BASE_URLS = {
  sandbox: "https://checkout.sandbox.bka.sh/v1.2.0-beta/checkout",
  production: "https://tokenized.pay.bka.sh/v1.2.0-beta/checkout",
} as const

const BASE_URL = BASE_URLS[BKASH_ENV as keyof typeof BASE_URLS] || BASE_URLS.sandbox

// SDK script URL for the frontend
export const BKASH_SCRIPT_URL =
  BKASH_ENV === "production"
    ? "https://scripts.bka.sh/v1.2.0-beta/bKash-checkout-shurjo.min.js"
    : "https://scripts.sandbox.bka.sh/v1.2.0-beta/bKash-checkout-sandbox.min.js"

export interface BkashTokenGrantResponse {
  id_token: string
  token_type: string
  expires_in: number
  refresh_token: string
}

export interface BkashCreatePaymentResponse {
  paymentID: string
  createTime: string
  orgTrxNo: string | null
  invoiceNo: string
  merchantID: string
  amount: string
  currency: string
  intent: string
  merchantInvoiceNumber: string
  status: string
}

export interface BkashExecutePaymentResponse {
  paymentID: string
  amount: string
  transactionStatus: string
  trxID: string
  paymentExecuteTime: string
  paymentType: string
  currency: string
  intent: string
  merchantInvoiceNumber: string
  receivedAt: string | null
  authorizationCode: string | null
  agreementID: string | null
  PSPublicationDate: string | null
  reasonCode: string | null
  reason: string | null
}

export interface BkashQueryPaymentResponse {
  paymentID: string
  amount: string
  transactionStatus: string
  trxID: string
  paymentExecuteTime: string
  paymentType: string
  currency: string
  intent: string
  merchantInvoiceNumber: string
  errorCode: string | null
  errorMessage: string | null
}

// Simple token cache (in-memory, per-process)
let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Step 1: Grant access token from bKash.
 * Caches the token for 10 minutes to avoid repeated calls.
 */
export async function grantToken(): Promise<BkashTokenGrantResponse> {
  // Return cached token if still valid
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return { id_token: cachedToken.token } as BkashTokenGrantResponse
  }

  const res = await fetch(`${BASE_URL}/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      username: BKASH_USERNAME,
      password: BKASH_PASSWORD,
    },
    body: JSON.stringify({
      app_key: BKASH_APP_KEY,
      app_secret: BKASH_APP_SECRET,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`bKash Grant Token failed (${res.status}): ${text}`)
  }

  const data: BkashTokenGrantResponse = await res.json()

  // Cache for 10 minutes (token expires in ~3600s but we refresh early)
  cachedToken = {
    token: data.id_token,
    expiresAt: Date.now() + 10 * 60 * 1000,
  }

  return data
}

/**
 * Get the current app key (needed for frontend SDK init).
 */
export function getAppKey(): string {
  return BKASH_APP_KEY
}

/**
 * Get the bKash environment (sandbox/production).
 */
export function getBkashEnv(): string {
  return BKASH_ENV
}

/**
 * Step 2: Create a bKash payment.
 * Returns paymentID for the frontend to use with the bKash SDK.
 */
export async function createPayment(params: {
  amount: string
  currency?: string
  intent?: string
  merchantInvoiceNumber: string
}): Promise<BkashCreatePaymentResponse> {
  const tokenData = await grantToken()

  const res = await fetch(`${BASE_URL}/payment/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: tokenData.id_token,
      "X-APP-Key": BKASH_APP_KEY,
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency || "BDT",
      intent: params.intent || "sale",
      merchantInvoiceNumber: params.merchantInvoiceNumber,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`bKash Create Payment failed (${res.status}): ${text}`)
  }

  return res.json()
}

/**
 * Step 3: Execute a bKash payment after customer PIN verification.
 * Returns transaction details including trxID.
 */
export async function executePayment(
  paymentID: string,
): Promise<BkashExecutePaymentResponse> {
  const tokenData = await grantToken()

  const res = await fetch(`${BASE_URL}/payment/execute/${paymentID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: tokenData.id_token,
      "X-APP-Key": BKASH_APP_KEY,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`bKash Execute Payment failed (${res.status}): ${text}`)
  }

  return res.json()
}

/**
 * Step 4: Query payment status for verification.
 */
export async function queryPayment(
  paymentID: string,
): Promise<BkashQueryPaymentResponse> {
  const tokenData = await grantToken()

  const res = await fetch(`${BASE_URL}/payment/status/${paymentID}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: tokenData.id_token,
      "X-APP-Key": BKASH_APP_KEY,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`bKash Query Payment failed (${res.status}): ${text}`)
  }

  return res.json()
}

/**
 * Generate a unique invoice number for bKash.
 * Format: BKS-{timestamp}-{random4}
 */
export function generateInvoiceNumber(): string {
  const ts = Date.now()
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `BKS-${ts}-${rand}`
}
