/** Returns a same-origin, path-only redirect target, or `fallback`. Blocks open redirects. */
export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || typeof raw !== "string") return fallback
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback
  try {
    const url = new URL(raw, "http://local.invalid")
    if (url.origin !== "http://local.invalid") return fallback
    const out = url.pathname + url.search
    if (out.startsWith("//")) return fallback
    return out
  } catch {
    return fallback
  }
}