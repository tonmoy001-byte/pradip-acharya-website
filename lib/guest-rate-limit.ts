// lib/guest-rate-limit.ts
// Persistent, fail-closed rate limit for guest order creation.
//
// The table is service-only (RLS on, no policies). Raw IP / email are never
// stored: only SHA-256 hashes salted with a server-side secret.
//
// Fail closed: if the store is unavailable or a count fails, the caller is
// treated as rate-limited. A broken limiter must not open an unlimited order
// creation endpoint.

import { createHash } from "node:crypto"
import { createServiceClient } from "./insforge-service"

const IP_LIMIT = 10
const IP_WINDOW_MS = 10 * 60 * 1000
const EMAIL_LIMIT = 5
const EMAIL_WINDOW_MS = 30 * 60 * 1000
const SCOPE = "order"

const SALT =
  process.env.GUEST_RATE_LIMIT_SALT ||
  process.env.INSFORGE_SERVICE_KEY ||
  "pradipbooks-guest-checkout-salt"

function hash(value: string): string {
  return createHash("sha256").update(value + "|" + SALT).digest("hex")
}

/**
 * Prefer the proxy's own header, then the last x-forwarded-for entry (added by
 * our trusted proxy). The first entry is client-controlled.
 */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")
  if (real) return real.trim()
  const parts = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length ? parts[parts.length - 1] : "unknown"
}

/**
 * First (client-supplied) value of X-Forwarded-For. Used by the Phase 2
 * limiters per spec. Less trustworthy than clientIp() but matches the
 * required behaviour for exchange/download throttling.
 */
export function clientIpFirst(req: Request): string {
  const parts = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length ? parts[0] : "unknown"
}

/**
 * Generic single-key rate limiter. Throws on infrastructure errors so the
 * caller can decide fail-open vs fail-closed.
 */
export async function isRateLimited(args: {
  scope: string
  key: string
  limit: number
  windowMs: number
}): Promise<boolean> {
  const client = createServiceClient()
  const keyHash = hash(args.key)

  const { error: insertError } = await client.database
    .from("guest_checkout_rate_limits")
    .insert([{ ip_hash: keyHash, email_hash: keyHash, scope: args.scope }])

  if (insertError) {
    throw new Error(insertError.message)
  }

  const cutoff = new Date(Date.now() - args.windowMs).toISOString()
  const { count, error } = await client.database
    .from("guest_checkout_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", keyHash)
    .eq("scope", args.scope)
    .gte("created_at", cutoff)

  if (error) {
    throw new Error(error.message)
  }
  return (count ?? 0) > args.limit
}

export async function isGuestOrderRateLimited(args: {
  ip: string
  email: string
}): Promise<boolean> {
  let client: ReturnType<typeof createServiceClient>
  try {
    client = createServiceClient()
  } catch (err) {
    console.error("guest-checkout: rate-limit client unavailable", err)
    return true
  }

  const ipHash = hash(args.ip)
  const emailHash = hash(args.email.trim().toLowerCase())

  // Record the attempt first, then count. A concurrent burst therefore
  // over-counts rather than under-counts (fail closed).
  const { error: insertError } = await client.database
    .from("guest_checkout_rate_limits")
    .insert([{ ip_hash: ipHash, email_hash: emailHash, scope: SCOPE }])

  if (insertError) {
    console.error("guest-checkout: rate-limit insert failed:", insertError.message)
    return true
  }

  const ipCutoff = new Date(Date.now() - IP_WINDOW_MS).toISOString()
  const { count: ipCount, error: ipError } = await client.database
    .from("guest_checkout_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .eq("scope", SCOPE)
    .gte("created_at", ipCutoff)

  if (ipError) {
    console.error("guest-checkout: rate-limit count failed:", ipError.message)
    return true
  }
  if ((ipCount ?? 0) > IP_LIMIT) return true

  const emailCutoff = new Date(Date.now() - EMAIL_WINDOW_MS).toISOString()
  const { count: emailCount, error: emailError } = await client.database
    .from("guest_checkout_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("email_hash", emailHash)
    .eq("scope", SCOPE)
    .gte("created_at", emailCutoff)

  if (emailError) {
    console.error("guest-checkout: rate-limit count failed:", emailError.message)
    return true
  }
  if ((emailCount ?? 0) > EMAIL_LIMIT) return true

  return false
}
