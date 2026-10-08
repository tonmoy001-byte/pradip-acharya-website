// lib/insforge-service.ts
// Service-role InsForge client — bypasses RLS.
//
// ONLY use this from server routes that are not acting on behalf of a signed-in
// customer, and only where the correctness of the flow depends on writing rows
// the caller's role cannot touch. Today that is the payment settlement path:
// `orders` has no non-admin UPDATE policy, so the verify/webhook handlers must
// escalate to mark a payment settled and release download grants.
//
// Never import this into a Client Component or a Server Component that renders
// customer-facing data — it would expose the ability to read and write every
// row in the database. The key is server-only and lives in .env.local.

import { createClient } from "@insforge/sdk"

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!
const INSFORGE_SERVICE_KEY = process.env.INSFORGE_SERVICE_KEY!

let cached: ReturnType<typeof createClient> | null = null

export function createServiceClient() {
  if (!INSFORGE_SERVICE_KEY) {
    throw new Error("INSFORGE_SERVICE_KEY is not configured")
  }
  if (!cached) {
    cached = createClient({
      baseUrl: INSFORGE_URL,
      // A static bearer token fixes the identity for every request and disables
      // the cookie-driven refresh, which is exactly what a server-side
      // service client needs.
      accessToken: INSFORGE_SERVICE_KEY,
    })
  }
  return cached
}
