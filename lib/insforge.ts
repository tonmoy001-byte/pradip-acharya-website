// lib/insforge.ts
// Browser-side InsForge client using SSR helpers.
// Reads the access-token cookie (httpOnly: false) and uses the refresh route.

import { createBrowserClient } from "@insforge/sdk/ssr"

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL || "https://cpd9mnqf.ap-southeast.insforge.app"
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || "anon_34290d5cd8a56b6f0a9885ad57385af0fe4d38bd8fe02104e94f3f36d8b705e2"

export const insforge = createBrowserClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY,
  refreshUrl: "/api/auth/refresh",
})
