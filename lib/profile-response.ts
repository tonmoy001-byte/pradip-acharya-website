// lib/profile-response.ts
// Pure parser for GET /api/profile payloads — kept free of React/Next imports
// so it is unit-testable.

import type { AuthUser } from "./auth"

export function parseProfileResponse(json: unknown): AuthUser | null {
  if (!json || typeof json !== "object") return null
  const data = (json as { data?: unknown }).data
  if (!data || typeof data !== "object") return null

  const row = data as Record<string, unknown>
  const id = row.user_id
  if (typeof id !== "string" || !id) return null

  const email = typeof row.email === "string" ? row.email : ""
  const fullName = typeof row.full_name === "string" ? row.full_name : null
  const name = fullName || email.split("@")[0] || null

  return { id, email, name, isAdmin: row.is_admin === true }
}
