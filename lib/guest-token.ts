import crypto from "node:crypto"

export const newToken = (): string => crypto.randomBytes(32).toString("base64url")

export const sha256hex = (s: string): string => crypto.createHash("sha256").update(s).digest("hex")

export function hashMatches(token: string | undefined, storedHex: string | null): boolean {
  if (!token || !storedHex) return false
  const a = Buffer.from(sha256hex(token), "hex")
  const b = Buffer.from(storedHex, "hex")
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
