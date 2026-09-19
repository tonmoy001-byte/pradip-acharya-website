// app/api/auth/refresh/route.ts
// Token refresh endpoint for InsForge SSR auth.
// The browser client calls this automatically when the access token expires.

import { createRefreshAuthRouter } from "@insforge/sdk/ssr"

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!

export const { POST } = createRefreshAuthRouter({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY,
})
