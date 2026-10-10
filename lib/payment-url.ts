const ALLOWED_PAYMENT_HOSTS = ["secure-pay.nagorikpay.com", "sandbox-api.nagorikpay.com"]

export function isAllowedPaymentUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    const u = new URL(value)
    return u.protocol === "https:" && ALLOWED_PAYMENT_HOSTS.includes(u.hostname)
  } catch {
    return false
  }
}