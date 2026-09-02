// lib/insforge-server.ts
// Server-side InsForge client using SSR helpers for Next.js App Router.
// Uses cookies() from next/headers to read the access-token cookie.
// ONLY import this in API routes and Server Components — NOT in Client Components.

import { cookies } from "next/headers"
import { createServerClient as createSSRServerClient } from "@insforge/sdk/ssr"

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL || "https://cpd9mnqf.ap-southeast.insforge.app"
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || "anon_34290d5cd8a56b6f0a9885ad57385af0fe4d38bd8fe02104e94f3f36d8b705e2"

export async function createServerClient() {
  const cookieStore = await cookies()
  return createSSRServerClient({
    cookies: cookieStore,
    baseUrl: INSFORGE_URL,
    anonKey: INSFORGE_ANON_KEY,
  })
}
