// lib/seo.ts
// Single source of truth for canonical URLs and social metadata.
//
// Every canonical, Open Graph and JSON-LD URL must be absolute HTTPS. Building
// them from one constant avoids the common failure where a relative path is
// emitted and Google silently ignores the page.

import type { Metadata } from "next"

const RAW_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL

/** The site's real public origin. */
const CANONICAL_ORIGIN = "https://cpd9mnqf.insforge.site"

/**
 * Resolve the canonical origin, refusing anything Google would reject.
 *
 * NEXT_PUBLIC_SITE_URL is routinely left as `http://localhost:3000` for local
 * development and is forwarded to production builds. Emitting that verbatim
 * produces canonical tags, Open Graph URLs and a sitemap full of
 * `http://localhost:3000` — every one of which Google discards, which silently
 * voids the entire SEO effort. A non-HTTPS or loopback origin is therefore
 * always replaced with the real public origin.
 */
function resolveSiteUrl(): string {
  if (!RAW_SITE_URL) return CANONICAL_ORIGIN
  try {
    const url = new URL(RAW_SITE_URL)
    if (url.protocol !== "https:") return CANONICAL_ORIGIN
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "0.0.0.0") {
      return CANONICAL_ORIGIN
    }
    return url.origin
  } catch {
    return CANONICAL_ORIGIN
  }
}

/** Canonical origin, no trailing slash. */
export const SITE_URL = resolveSiteUrl()

export const SITE_NAME = "প্রদীপ কুমার আচার্য্য"
export const SITE_LOCALE = "bn_BD"
export const SITE_LANG = "bn-BD"

/** Turn a site-relative path into an absolute URL. */
export function absoluteUrl(path: string): string {
  if (!path) return SITE_URL
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`
}

/** Public page paths that belong in the sitemap. Kept explicit and small. */
export const PUBLIC_PATHS = [
  "/",
  "/books",
  "/novels",
  "/about",
  "/contact",
  "/privacy",
  "/blog",
] as const

/**
 * Path prefixes that must never appear in search results.
 *
 * These still return 200 and carry a `noindex` meta tag so Google can crawl
 * them and observe the directive — a page blocked in robots.txt alone can stay
 * indexed forever as a bare URL with no snippet.
 */
export const PRIVATE_PATH_PREFIXES = [
  "/account",
  "/admin",
  "/checkout",
  "/login",
  "/logout",
  "/register",
  "/verify",
  "/forgot-password",
  "/reset-password",
  "/change-password",
  "/my-downloads",
  "/my-orders",
  "/payment",
  "/api",
] as const

export function isPrivatePath(path: string): boolean {
  return PRIVATE_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}

/** Shared social image used when a page has no more specific one. */
export const DEFAULT_OG_IMAGE = "/images/books/chhera-pushpo-cover.jpg"
export const AUTHOR_OG_IMAGE = "/images/author.png"

export interface PageMetaInput {
  /** Page title WITHOUT the site suffix — the root template appends it. */
  title: string
  description: string
  /** Site-relative path, e.g. "/books". */
  path: string
  image?: string
  imageAlt?: string
  keywords?: string[]
  type?: "website" | "book" | "article"
  noindex?: boolean
}

/**
 * Build a consistent metadata object: self-referencing canonical, Open Graph
 * (url + absolute image) and Twitter card. Every indexable public page goes
 * through here so a page can never ship with a missing or relative canonical.
 */
export function pageMetadata(input: PageMetaInput): Metadata {
  const { title, description, path, image, keywords, type = "website", noindex } = input
  const url = absoluteUrl(path)
  const imageUrl = absoluteUrl(image || DEFAULT_OG_IMAGE)
  const imageAlt = input.imageAlt || "ছেঁড়া পুষ্প বাংলা উপন্যাসের প্রচ্ছদ"

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    ...(noindex
      ? { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } }
      : {}),
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  }
}

/** Metadata for private / transactional pages: reachable, but never indexed. */
export function noindexMetadata(title: string, description?: string): Metadata {
  return {
    title,
    ...(description ? { description } : {}),
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  }
}
