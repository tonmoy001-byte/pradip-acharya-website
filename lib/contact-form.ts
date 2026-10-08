// lib/contact-form.ts
// Pure logic for the /contact form: sanitization, validation, email body
// building, spam gates, and rate limiting. No I/O — fully unit-testable.

export interface ContactPayload {
  name: string
  email: string
  subject: string
  message: string
}

export type ValidationResult =
  | { ok: true; data: ContactPayload }
  | { ok: false; errors: Record<string, string> }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function sanitizeContactText(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim()
}

/**
 * Pull an email address out of a site_settings value.
 *
 * The column is JSONB, so a stored email can arrive as a plain string or as a
 * JSON object such as `{"email": "..."}` written by an admin tool. The route
 * used to check `typeof === "string"` only, which made the object form surface
 * as the misleading "যোগাযোগ ইমেইল সেটআপ করা হয়নি।" error.
 */
export function extractContactEmail(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return ""
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>
        const inner = parsed.email ?? parsed.value ?? parsed.address
        return typeof inner === "string" ? inner.trim() : ""
      } catch {
        return ""
      }
    }
    return trimmed
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>
    const inner = obj.email ?? obj.value ?? obj.address
    return typeof inner === "string" ? inner.trim() : ""
  }
  return ""
}

export function validateContactInput(payload: Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {}

  const name = typeof payload.name === "string" ? payload.name.trim() : null
  if (name === null || name.length < 2 || name.length > 100) {
    errors.name = "নাম ২ থেকে ১০০ অক্ষরের হতে হবে।"
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : null
  if (email === null || email.length > 254 || !EMAIL_RE.test(email)) {
    errors.email = "সঠিক ইমেইল ঠিকানা দিন।"
  }

  let subject = ""
  if (payload.subject !== undefined && payload.subject !== null && payload.subject !== "") {
    if (typeof payload.subject !== "string") {
      errors.subject = "বিষয় সর্বোচ্চ ২০০ অক্ষরের হতে পারবে।"
    } else {
      subject = payload.subject.trim()
      if (subject.length > 200) {
        errors.subject = "বিষয় সর্বোচ্চ ২০০ অক্ষরের হতে পারবে।"
      }
    }
  }

  const message = typeof payload.message === "string" ? payload.message.trim() : null
  if (message === null || message.length < 10 || message.length > 5000) {
    errors.message = "বার্তা ১০ থেকে ৫০০০ অক্ষরের হতে হবে।"
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, data: { name: name!, email: email!, subject, message: message! } }
}

export const MIN_SUBMIT_MS = 3000

export function isBotSubmission(input: {
  honeypot?: unknown
  startedAt?: unknown
  nowMs: number
}): boolean {
  if (typeof input.honeypot === "string" && input.honeypot.trim() !== "") return true
  if (typeof input.startedAt !== "number" || !Number.isFinite(input.startedAt)) return true
  if (input.nowMs - input.startedAt < MIN_SUBMIT_MS) return true
  return false
}

export type RateLimitStore = Map<string, number[]>

export function isRateLimited(
  store: RateLimitStore,
  key: string,
  nowMs: number,
  limit: number,
  windowMs: number,
): boolean {
  const times = (store.get(key) ?? []).filter((t) => nowMs - t < windowMs)
  store.set(key, times)
  return times.length >= limit
}

export function recordRateLimitUse(store: RateLimitStore, key: string, nowMs: number): void {
  const times = store.get(key) ?? []
  times.push(nowMs)
  store.set(key, times)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function buildContactEmail(data: ContactPayload): {
  subject: string
  text: string
  html: string
} {
  const subject = data.subject ? `Website Contact: ${data.subject}` : "Website Contact: (no subject)"

  const textLines = [`Name: ${data.name}`, `Email: ${data.email}`]
  if (data.subject) textLines.push(`Subject: ${data.subject}`)
  textLines.push("", "Message:", "", data.message)

  const htmlLines = [
    `<p><strong>Name:</strong> ${escapeHtml(data.name)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(data.email)}</p>`,
  ]
  if (data.subject) htmlLines.push(`<p><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>`)
  htmlLines.push(
    `<p><strong>Message:</strong></p>`,
    `<p>${escapeHtml(data.message).replace(/\n/g, "<br>")}</p>`,
  )

  return { subject, text: textLines.join("\n"), html: htmlLines.join("\n") }
}
