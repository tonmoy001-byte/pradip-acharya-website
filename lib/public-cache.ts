// lib/public-cache.ts
// Server-only cache wrappers for public site data (previous Next.js caching model).
// Do NOT import from client components — next/cache is server-only.

import { unstable_cache, revalidateTag, revalidatePath } from "next/cache"
import {
  getBooks,
  getBookById,
  getFeatured,
  getNewReleases,
  getTrending,
  getRelated,
  getSiteSettings,
  getPublishedPosts,
  getPostBySlug,
  type GetBooksParams,
  type SiteSettings,
  type Post,
} from "./api"
import { withUncachedFallback, nullOnFailure } from "./cache-utils"
import type { Book } from "./data"

export const CACHE_TAGS = {
  books: "books",
  posts: "posts",
  settings: "settings",
} as const

const REVALIDATE_SECONDS = 60

// Never persist a failure: unstable_cache stores resolved values only, so a
// thrown error is not written to the cache; withUncachedFallback retries the
// query uncached for this request, and throws only if that retry also fails.
const cachedBooksQuery = unstable_cache(
  (params: GetBooksParams = {}) => getBooks(params),
  ["books-query"],
  { tags: [CACHE_TAGS.books], revalidate: REVALIDATE_SECONDS },
)

export function getCachedBooks(params: GetBooksParams = {}): Promise<Book[]> {
  return withUncachedFallback(() => cachedBooksQuery(params), () => getBooks(params))
}

const cachedBookByIdQuery = unstable_cache(
  (id: string) => getBookById(id),
  ["book-by-id"],
  { tags: [CACHE_TAGS.books], revalidate: REVALIDATE_SECONDS },
)

// Never persist a failure: unstable_cache stores resolved values only, so a
// rejection falls through to an uncached direct query; if that also fails we
// serve null for THIS request without writing anything to the cache.
export async function getCachedBookById(id: string): Promise<Book | null> {
  return nullOnFailure(() =>
    withUncachedFallback(() => cachedBookByIdQuery(id), () => getBookById(id)),
  )
}

const cachedFeaturedQuery = unstable_cache(
  () => getFeatured(),
  ["featured"],
  { tags: [CACHE_TAGS.books], revalidate: REVALIDATE_SECONDS },
)

export function getCachedFeatured(): Promise<Book[]> {
  return withUncachedFallback(() => cachedFeaturedQuery(), () => getFeatured())
}

const cachedNewReleasesQuery = unstable_cache(
  () => getNewReleases(),
  ["new-releases"],
  { tags: [CACHE_TAGS.books], revalidate: REVALIDATE_SECONDS },
)

export function getCachedNewReleases(): Promise<Book[]> {
  return withUncachedFallback(() => cachedNewReleasesQuery(), () => getNewReleases())
}

const cachedTrendingQuery = unstable_cache(
  () => getTrending(),
  ["trending"],
  { tags: [CACHE_TAGS.books], revalidate: REVALIDATE_SECONDS },
)

export function getCachedTrending(): Promise<Book[]> {
  return withUncachedFallback(() => cachedTrendingQuery(), () => getTrending())
}

const cachedRelatedQuery = unstable_cache(
  (id: string) => getRelated(id),
  ["related"],
  { tags: [CACHE_TAGS.books], revalidate: REVALIDATE_SECONDS },
)

export function getCachedRelated(id: string): Promise<Book[]> {
  return withUncachedFallback(() => cachedRelatedQuery(id), () => getRelated(id))
}

export const getCachedSiteSettings = unstable_cache(
  () => getSiteSettings(),
  ["site-settings"],
  { tags: [CACHE_TAGS.settings], revalidate: REVALIDATE_SECONDS },
)

export const getCachedPublishedPosts = unstable_cache(
  () => getPublishedPosts(),
  ["published-posts"],
  { tags: [CACHE_TAGS.posts], revalidate: REVALIDATE_SECONDS },
)

export const getCachedPostBySlug = unstable_cache(
  (slug: string) => getPostBySlug(slug),
  ["post-by-slug"],
  { tags: [CACHE_TAGS.posts], revalidate: REVALIDATE_SECONDS },
)

export function invalidateBooks(bookId?: string) {
  revalidateTag(CACHE_TAGS.books, "max")
  revalidatePath("/")
  revalidatePath("/books")
  revalidatePath("/novels")
  if (bookId) revalidatePath(`/book/${bookId}`)
}

export function invalidatePosts(slug?: string) {
  revalidateTag(CACHE_TAGS.posts, "max")
  revalidatePath("/blog")
  if (slug) revalidatePath(`/blog/${slug}`)
}

export function invalidateSettings() {
  revalidateTag(CACHE_TAGS.settings, "max")
  revalidatePath("/")
}
