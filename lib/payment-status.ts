export type GatewayOutcome = "paid" | "pending" | "failed"

/** NagorikPay verify returns COMPLETED | PENDING | ERROR; webhooks use lowercase. Be case-insensitive. */
export function classifyGatewayStatus(status: unknown): GatewayOutcome {
  const s = typeof status === "string" ? status.trim().toUpperCase() : ""
  if (s === "COMPLETED" || s === "SUCCESS") return "paid"
  if (s === "PENDING") return "pending"
  return "failed"
}