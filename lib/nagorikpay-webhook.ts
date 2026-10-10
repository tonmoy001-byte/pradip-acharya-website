import { createHmac, timingSafeEqual } from "node:crypto"

const REPLAY_WINDOW_SECONDS = 300

/**
 * Verify NagorikPay HMAC-SHA256 webhook signature.
 * Signed message is `timestamp + "." + rawBody` (form-urlencoded bytes).
 * Returns false if secret is missing (fail-closed).
 */
export function verifyWebhookSignature(
  rawBody: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
  secret?: string | null,
): boolean {
  if (!secret) {
    return false
  }
  if (!timestampHeader || !signatureHeader) return false

  const timestamp = Number(timestampHeader)
  if (!Number.isFinite(timestamp)) return false
  if (Math.abs(Date.now() / 1000 - timestamp) > REPLAY_WINDOW_SECONDS) return false

  // Header format: sha256=<hex>
  const givenHex = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader

  const expected = createHmac("sha256", secret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest("hex")

  if (givenHex.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(givenHex, "utf8"), Buffer.from(expected, "utf8"))
}