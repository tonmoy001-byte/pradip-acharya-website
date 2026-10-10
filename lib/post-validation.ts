// lib/post-validation.ts
// Shared validation for admin post create/update payloads.
//
// Kept separate from the HTML sanitizer so the routes can validate before
// sanitizing and so the rules have one source of truth.

const SLUG_RE = /^[a-z0-9-]{1,120}$/
const MAX_TITLE_LEN = 200
const MAX_TAG_LEN = 40
const MAX_TAGS = 20

export function validatePostBody(body: Record<string, unknown>): string | null {
  const title = body.title
  if (typeof title !== "string" || title.trim().length === 0 || title.length > MAX_TITLE_LEN) {
    return "Title is required (max 200 characters)"
  }
  const slug = body.slug
  if (typeof slug !== "string" || !SLUG_RE.test(slug)) {
    return "Slug must be 1-120 lowercase letters, digits and hyphens"
  }
  const tags = body.tags
  if (tags !== undefined && tags !== null) {
    if (!Array.isArray(tags)) return "Tags must be an array"
    if (tags.length > MAX_TAGS) return `At most ${MAX_TAGS} tags are allowed`
    for (const t of tags) {
      if (typeof t !== "string" || t.length > MAX_TAG_LEN) {
        return `Each tag must be a string of at most ${MAX_TAG_LEN} characters`
      }
    }
  }
  return null
}