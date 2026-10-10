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
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") deny()

  const origin = req.headers.get("origin")
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
    let originHost = ""
    try {
      originHost = new URL(origin).host
    } catch {
      deny()
    }
    if (!host || originHost !== host) deny()
  }
}