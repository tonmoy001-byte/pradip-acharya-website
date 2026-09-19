// lib/insforge.ts
// Browser-side InsForge client using SSR helpers.
// Reads the access-token cookie (httpOnly: false) and uses the refresh route.

import { createBrowserClient } from "@insforge/sdk/ssr"

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!

export const insforge = createBrowserClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY,
  refreshUrl: "/api/auth/refresh",
})
