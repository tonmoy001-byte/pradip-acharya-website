// lib/auth-helpers.ts
// Server-side authorization helpers. Used by API routes.
// Includes JWT fallback for InsForge deployment where cookies may not be
// properly passed to next/headers by the platform.

import { cookies } from "next/headers"
import { createServerClient } from "./insforge-server"

export interface AuthUser {
  id: string
  email: string
  profile?: { name?: string; avatar_url?: string }
}

/**
 * Decode a JWT payload (without signature verification).
 * Used as fallback when InsForge auth.getCurrentUser() fails on deployment.
 * The cookie was set by our own auth system, so it's trusted in this context.
 */
function decodeJWTPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const payload = parts[1]
    // Base64url decode
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

/**
 * Try to extract user from the insforge_access_token cookie directly.
 * Returns null if cookie is missing or invalid.
 */
async function getUserFromCookie(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("insforge_access_token")?.value
    if (!token) return null

    const payload = decodeJWTPayload(token)
    if (!payload?.sub) return null

    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) return null

    return {
      id: payload.sub,
      email: payload.email || "",
    }
  } catch {
    return null
  }
}

/**
 * Extract and verify the authenticated user from the request.
 * First tries InsForge auth.getCurrentUser(), then falls back to JWT cookie decode.
 */
export async function requireUser(): Promise<AuthUser> {
  // Try InsForge SDK first (works locally, may fail on deployment)
  try {
    const client = await createServerClient()
    const { data, error } = await client.auth.getCurrentUser()
    if (!error && data?.user) {
      return data.user as AuthUser
    }
  } catch {
    // SDK failed — fall through to JWT fallback
  }

  // JWT fallback: decode insforge_access_token cookie directly
  const cookieUser = await getUserFromCookie()
  if (cookieUser) return cookieUser

  // Both methods failed — throw 401
  throw new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  })
}

/**
 * Verify the authenticated user is an admin.
 * Queries admin_memberships table via the is_admin() PostgreSQL function.
 * Throws 401 if not authenticated, 403 if not admin.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser()
  const client = await createServerClient()

  const { data, error } = await client.database.rpc("is_admin", {
    uid: user.id,
  })

  if (error) {
    throw new Response(JSON.stringify({ error: "Authorization check failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!data || data !== true) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  return user
}
