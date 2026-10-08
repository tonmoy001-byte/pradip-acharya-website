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
        allow: "/",
        disallow: [
          // Private, transactional and administrative areas. These are also
          // marked noindex in the page metadata.
          "/account",
          "/admin",
          "/checkout",
          "/login",
          "/verify",
          "/forgot-password",
          "/reset-password",
          "/change-password",
          "/my-downloads",
          "/my-orders",
          "/payment",
          "/api/",
          // Query-parameter duplicates of public pages (?sort=, ?subcategory=)
          // must not compete with the canonical URL.
          "/*?",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
