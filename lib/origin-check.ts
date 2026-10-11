// lib/origin-check.ts
// CSRF defense for cookie-authenticated POST routes.
//
// A state-changing request from another website is rejected with 403. Two
// signals are checked:
//   1. `Sec-Fetch-Site` — when the browser sends it, anything other than
//      "same-origin" or "none" (e.g. "cross-site") means a fetch from another
//      origin. Older browsers and non-browser clients omit the header, so it
//      cannot be the only check.
//   2. `Origin` — when present, its host must match the request's own host.
//      `x-forwarded-host`/`host` is used because the edge may rewrite the host.
//
// Server Actions are not covered here: Next.js checks the origin itself.
// The webhook route is not covered here: it is server-to-server and is
// authenticated by its HMAC signature instead.

function deny(): never {
  throw new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  })
}

/** Throws a 403 Response if a state-changing request comes from another site. */
export function assertSameOrigin(req: Request): void {
  const fetchSite = req.headers.get("sec-fetch-site")
  const origin = req.headers.get("origin")
  const forwardedHost = req.headers.get("x-forwarded-host")
  const host = req.headers.get("host")

  // TEMPORARY DEBUG LOGGING — capture the exact header values so the 403
  // source can be identified. Remove once confirmed working.
  console.info("[origin-check] headers", {
    secFetchSite: fetchSite,
    origin,
    xForwardedHost: forwardedHost,
    host,
    url: req.url,
  })

  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    console.error("[origin-check] DENY: sec-fetch-site", { fetchSite })
    deny()
  }

  if (origin) {
    let originHost = ""
    try {
      originHost = new URL(origin).host
    } catch {
      console.error("[origin-check] DENY: unparseable origin", { origin })
      deny()
    }
    const effectiveHost = forwardedHost ?? host
    if (!effectiveHost || originHost !== effectiveHost) {
      console.error("[origin-check] DENY: origin mismatch", { originHost, effectiveHost, forwardedHost, host })
      deny()
    }
  }
}