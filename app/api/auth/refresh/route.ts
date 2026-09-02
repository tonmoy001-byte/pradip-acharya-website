// app/api/auth/refresh/route.ts
// Token refresh endpoint for InsForge SSR auth.
// The browser client calls this automatically when the access token expires.

import { createRefreshAuthRouter } from "@insforge/sdk/ssr"

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL || "https://cpd9mnqf.ap-southeast.insforge.app"
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || "anon_34290d5cd8a56b6f0a9885ad57385af0fe4d38bd8fe02104e94f3f36d8b705e2"

export const { POST } = createRefreshAuthRouter({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY,
})
