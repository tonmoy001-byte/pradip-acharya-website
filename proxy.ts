// proxy.ts
// Emits `X-Robots-Tag: noindex, nofollow` for every private or transactional
// route.
//
// Why a header instead of a <meta> tag: several private screens
// (/verify, /payment/success, /my-downloads, /account/orders) are client
// components that use `useSearchParams` or gate on auth with early returns.
// Those pages ship no meaningful server HTML, so a <meta name="robots"> — even
// when the component containing it would otherwise render — never reaches the
// crawler's initial fetch. A response header is emitted for every request
// regardless of how the body is rendered, which makes it the only directive
// here that can actually be relied on.
//
// robots.txt `Disallow` is deliberately not used as the substitute: a blocked
// URL can still be indexed as a bare link with no snippet, because Google never
// fetches the page and therefore never sees a noindex. Blocking and noindexing
// are complementary, so both are sent.

import { NextResponse, type NextRequest } from "next/server"

/** Routes that must never appear in a search index. */
const PRIVATE_PREFIXES = [
  "/account",
  "/admin",
  "/checkout",
  "/payment",
  "/my-downloads",
  "/my-orders",
  "/login",
  "/logout",
  "/verify",
  "/forgot-password",
  "/reset-password",
] as const

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPrivate = PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  const isApi = pathname === "/api" || pathname.startsWith("/api/")

  if (!isPrivate && !isApi) return NextResponse.next()

  const response = NextResponse.next()
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
  return response
}

export const config = {
  // Only private pages need the header, so the matcher stays narrow and static
  // assets, images and public routes skip the proxy entirely.
  matcher: [
    "/account/:path*",
    "/admin/:path*",
    "/checkout/:path*",
    "/payment/:path*",
    "/my-downloads/:path*",
    "/my-orders/:path*",
    "/api/:path*",
    "/login",
    "/logout",
    "/verify",
    "/forgot-password",
    "/reset-password",
  ],
}
