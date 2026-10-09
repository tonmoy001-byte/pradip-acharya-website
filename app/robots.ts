// app/robots.ts
// Real robots.txt served from the app root.
//
// The Sitemap directive uses the canonical origin, never a preview host.

import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo"

export const dynamic = "force-static"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Keep this list minimal on purpose. Private pages (/account,
        // /checkout, /login, /my-downloads, /payment, …) must stay CRAWLABLE
        // so Google fetches them and sees the noindex directive (meta tag +
        // X-Robots-Tag from proxy.ts). A URL blocked here can stay indexed
        // forever as a bare link with no snippet. Query-parameter duplicates
        // (?sort=, ?utm_=) are handled by self-referencing absolute
        // canonicals, not by blocking.
        allow: "/",
        disallow: ["/api/", "/admin"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
