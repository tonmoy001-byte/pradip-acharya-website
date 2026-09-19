// lib/insforge-server.ts
// Server-side InsForge client using SSR helpers for Next.js App Router.
// Uses cookies() from next/headers to read the access-token cookie.
// ONLY import this in API routes and Server Components — NOT in Client Components.

import { cookies } from "next/headers"
import { createServerClient as createSSRServerClient } from "@insforge/sdk/ssr"

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!

export async function createServerClient() {
  const cookieStore = await cookies()
  return createSSRServerClient({
    cookies: cookieStore,
    baseUrl: INSFORGE_URL,
    anonKey: INSFORGE_ANON_KEY,
  })
}
