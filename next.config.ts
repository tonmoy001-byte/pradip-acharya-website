import type { NextConfig } from "next"

function insforgeImagePattern() {
  const raw = process.env.NEXT_PUBLIC_INSFORGE_URL
  if (!raw) return null
  try {
    const u = new URL(raw)
    return {
      protocol: (u.protocol.replace(":", "") as "http" | "https"),
      hostname: u.hostname,
      port: u.port || "",
      pathname: "/api/storage/buckets/**",
    } as const
  } catch {
    return null
  }
}

const insforgePattern = insforgeImagePattern()
// The InsForge origin is needed inside the CSP for storage image fetches and
// for the authenticated API client used by server routes.
const INSFORGE_ORIGIN = insforgePattern
  ? `${insforgePattern.protocol}://${insforgePattern.hostname}${insforgePattern.port ? `:${insforgePattern.port}` : ""}`
  : ""

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `img-src 'self' data: blob: ${INSFORGE_ORIGIN}`.trim(),
  "media-src 'self'",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // No analytics and no inline scripts beyond what Next.js injects at build
  // time. 'unsafe-inline' is required by Next.js until nonce support is added;
  // tighten to 'self' + a nonce later.
  "script-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${INSFORGE_ORIGIN}`.trim(),
  "worker-src 'self' blob:",
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
]

const nextConfig: NextConfig = {
  images: {
    remotePatterns: insforgePattern ? [insforgePattern] : [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig