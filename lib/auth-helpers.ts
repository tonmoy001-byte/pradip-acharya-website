// lib/auth-helpers.ts
// Server-side authorization helpers. Used by API routes.
//
// SECURITY: Identity comes only from InsForge verified session
// (auth.getCurrentUser() via SSR cookie client). Never decode JWTs
// locally and never trust a client-supplied user id.
//
// Error mapping (P1):
//   401 — no session / invalid or expired credentials (client should log in)
//   403 — authenticated but not authorized (forbidden, not logged out)
//   500 — InsForge/DB/network failure (system error, never shown as logged out)

import { createServerClient } from "./insforge-server"

export interface AuthUser {
  id: string
  email: string
  profile?: { name?: string; avatar_url?: string }
}

function unauthorized(): never {
  throw new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  })
}

function forbidden(): never {
  throw new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  })
}

function systemError(): never {
  throw new Response(JSON.stringify({ error: "Authentication service unavailable" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  })
}

/**
 * Classify a getCurrentUser/auth error:
 * 401/403 → session problem (401); anything else (network, 5xx, unknown) → system (500).
 */
export function authFailureStatus(error: unknown): 401 | 500 {
  if (error && typeof error === "object" && "statusCode" in error) {
    const code = (error as { statusCode?: number }).statusCode
    if (code === 401 || code === 403) return 401
    return 500
  }
  return 500
}

/**
 * Resolve the authenticated user from the InsForge verified session only.
 * Throws 401 if there is no valid session; 500 on InsForge/network failure.
 */
export async function requireUser(): Promise<AuthUser> {
  let client: Awaited<ReturnType<typeof createServerClient>>
  try {
    client = await createServerClient()
  } catch {
    systemError()
  }

  try {
    const { data, error } = await client.auth.getCurrentUser()
    if (!error && data?.user?.id) {
      return data.user as AuthUser
    }
    if (error) {
      if (authFailureStatus(error) === 401) unauthorized()
      systemError()
    }
    // No session: user null, no error
    unauthorized()
  } catch (err) {
    if (err instanceof Response) throw err
    systemError()
  }
}

/**
 * Verify the authenticated session user is an admin.
 * is_admin() is hardened to authorize only auth.uid() (verified JWT subject),
 * so a caller-supplied uid cannot escalate privileges.
 * Throws 401 if not authenticated, 403 if not admin, 500 if the check fails.
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
    forbidden()
  }

  return user
}
