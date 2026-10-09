// app/sitemap.ts
// XML sitemap built from live data, so publishing a new book adds its page
// automatically. Only canonical, indexable public URLs are included.

import type { MetadataRoute } from "next"
import { getCachedBooks } from "@/lib/public-cache"
import { absoluteUrl, PUBLIC_PATHS } from "@/lib/seo"

export const dynamic = "force-dynamic"
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A sitemap failure must never 500: fall back to static public routes only.
  let bookPaths: string[] = []
  try {
    const books = await getCachedBooks()
    bookPaths = books.map((b) => `/book/${b.id}`)
  } catch {
    bookPaths = []
  }

  // No lastModified anywhere: the Book type has no updated-at field and
  // static pages carry no change signal — stamping "now" on every request
  // would be a false freshness signal, so the field is omitted entirely.
  // Higher priority for the money and identity pages a Bengali reader is
  // most likely to search for.
  const PRIORITY: Record<string, number> = {
    "/": 1,
    "/books": 0.8,
    "/novels": 0.8,
    "/about": 0.7,
    "/blog": 0.5,
    "/contact": 0.4,
    "/privacy": 0.2,
    "/refund-policy": 0.2,
    "/terms": 0.2,
  }

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_PATHS.map((path) => ({
    url: absoluteUrl(path),
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: PRIORITY[path] ?? 0.5,
  }))

  const bookEntries: MetadataRoute.Sitemap = bookPaths.map((path) => ({
    url: absoluteUrl(path),
    changeFrequency: "weekly",
    priority: 0.9,
  }))

  return [...staticEntries, ...bookEntries]
}
