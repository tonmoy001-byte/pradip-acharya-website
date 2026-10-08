// lib/cache-utils.ts
// Async helpers for cache wrappers. A cache read failure must never be
// persisted (unstable_cache caches resolved values, not rejections) and must
// never crash the page: retry uncached, then degrade to null for this request.

export async function withUncachedFallback<T>(
  cached: () => Promise<T>,
  direct: () => Promise<T>,
): Promise<T> {
  try {
    return await cached()
  } catch (e) {
    console.error("[cache] cached read failed; retrying uncached", e)
    return direct()
  }
}

export async function nullOnFailure<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run()
  } catch (e) {
    console.error("[cache] read failed entirely; serving miss", e)
    return null
  }
}
