import { describe, it, expect } from "vitest"
import {
  sanitizeContactText,
  validateContactInput,
  buildContactEmail,
  isBotSubmission,
  isRateLimited,
  recordRateLimitUse,
  type ContactPayload,
  type RateLimitStore,
} from "./contact-form"

const validPayload = {
  name: "রহিম আহমেদ",
  email: "rahim@example.com",
  subject: "বই অর্ডার",
  message: "আমি একটি বই অর্ডার করতে চাই।",
}

describe("sanitizeContactText", () => {
  it("strips CR and LF sequences (header-injection defense)", () => {
    expect(sanitizeContactText("Bcc: evil@x.com\r\nCc: bad@x.com")).toBe(
      "Bcc: evil@x.com Cc: bad@x.com",
    )
  })

  it("strips a lone CR and trims surrounding whitespace", () => {
    expect(sanitizeContactText("  line1\rline2  ")).toBe("line1 line2")
  })

  it("leaves plain text unchanged", () => {
    expect(sanitizeContactText("hello world")).toBe("hello world")
  })
})

describe("validateContactInput", () => {
  it("accepts a valid payload and trims fields", () => {
    const r = validateContactInput({ ...validPayload, name: "  রহিম আহমেদ  " })
    expect(r).toEqual({
      ok: true,
      data: {
        name: "রহিম আহমেদ",
        email: "rahim@example.com",
        subject: "বই অর্ডার",
        message: "আমি একটি বই অর্ডার করতে চাই।",
      },
    })
  })

  it("allows an empty subject", () => {
    const r = validateContactInput({ ...validPayload, subject: "" })
    expect(r.ok).toBe(true)
  })

  it("allows a missing subject", () => {
    const { subject: _omitted, ...rest } = validPayload
    const r = validateContactInput(rest)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.subject).toBe("")
  })

  it("rejects a name shorter than 2 chars", () => {
    const r = validateContactInput({ ...validPayload, name: "a" })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.name).toBeTruthy()
  })

  it("rejects a name longer than 100 chars", () => {
    const r = validateContactInput({ ...validPayload, name: "x".repeat(101) })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.name).toBeTruthy()
  })

  it("rejects a non-string name", () => {
    const r = validateContactInput({ ...validPayload, name: 42 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.name).toBeTruthy()
  })

  it("rejects a malformed email", () => {
    const r = validateContactInput({ ...validPayload, email: "not-an-email" })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.email).toBeTruthy()
  })

  it("rejects an email longer than 254 chars", () => {
    const r = validateContactInput({ ...validPayload, email: `${"a".repeat(250)}@x.co` })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.email).toBeTruthy()
  })

  it("rejects a message shorter than 10 chars", () => {
    const r = validateContactInput({ ...validPayload, message: "short" })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.message).toBeTruthy()
  })

  it("rejects a message longer than 5000 chars", () => {
    const r = validateContactInput({ ...validPayload, message: "x".repeat(5001) })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.message).toBeTruthy()
  })

  it("rejects a subject longer than 200 chars", () => {
    const r = validateContactInput({ ...validPayload, subject: "x".repeat(201) })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.subject).toBeTruthy()
  })

  it("reports errors for multiple bad fields at once", () => {
    const r = validateContactInput({ ...validPayload, name: "", email: "bad" })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.name).toBeTruthy()
      expect(r.errors.email).toBeTruthy()
    }
  })
})

describe("buildContactEmail", () => {
  const base: ContactPayload = {
    name: "Rahim Ahmed",
    email: "rahim@gmail.com",
    subject: "",
    message: "Hello, I would like to discuss a website project.",
  }

  it("builds the owner's exact text format without a subject", () => {
    const mail = buildContactEmail(base)
    expect(mail.subject).toBe("Website Contact: (no subject)")
    expect(mail.text).toBe(
      "Name: Rahim Ahmed\nEmail: rahim@gmail.com\n\nMessage:\n\nHello, I would like to discuss a website project.",
    )
  })

  it("includes a Subject line and prefixed subject when a subject exists", () => {
    const mail = buildContactEmail({ ...base, subject: "Order question" })
    expect(mail.subject).toBe("Website Contact: Order question")
    expect(mail.text).toBe(
      "Name: Rahim Ahmed\nEmail: rahim@gmail.com\nSubject: Order question\n\nMessage:\n\nHello, I would like to discuss a website project.",
    )
  })

  it("HTML-escapes dangerous characters", () => {
    const mail = buildContactEmail({
      ...base,
      name: `<script>alert("x")</script> & 'quotes'`,
    })
    expect(mail.html).not.toContain("<script>")
    expect(mail.html).toContain("&lt;script&gt;")
    expect(mail.html).toContain("&amp;")
    expect(mail.html).toContain("&#39;quotes&#39;")
  })

  it("HTML includes all four fields", () => {
    const mail = buildContactEmail({ ...base, subject: "Hi" })
    expect(mail.html).toContain("Rahim Ahmed")
    expect(mail.html).toContain("rahim@gmail.com")
    expect(mail.html).toContain("Hi")
    expect(mail.html).toContain("Hello, I would like to discuss a website project.")
  })
})

describe("isBotSubmission", () => {
  const now = 1_760_000_000_000

  it("passes a normal submission (empty honeypot, started 5s ago)", () => {
    expect(
      isBotSubmission({ honeypot: "", startedAt: now - 5000, nowMs: now }),
    ).toBe(false)
  })

  it("flags a filled honeypot", () => {
    expect(
      isBotSubmission({ honeypot: "  http://spam  ", startedAt: now - 5000, nowMs: now }),
    ).toBe(true)
  })

  it("flags a missing startedAt", () => {
    expect(isBotSubmission({ honeypot: "", nowMs: now })).toBe(true)
  })

  it("flags a non-numeric startedAt", () => {
    expect(isBotSubmission({ honeypot: "", startedAt: "123", nowMs: now })).toBe(true)
  })

  it("flags a submission faster than 3 seconds", () => {
    expect(isBotSubmission({ honeypot: "", startedAt: now - 2000, nowMs: now })).toBe(true)
  })

  it("flags a future startedAt (clock skew / tampering)", () => {
    expect(isBotSubmission({ honeypot: "", startedAt: now + 60_000, nowMs: now })).toBe(true)
  })
})

describe("rate limiter", () => {
  const t0 = 1_760_000_000_000
  const LIMIT = 3
  const WINDOW = 10 * 60 * 1000

  it("stays open below the limit", () => {
    const store: RateLimitStore = new Map()
    expect(isRateLimited(store, "ip1", t0, LIMIT, WINDOW)).toBe(false)
    recordRateLimitUse(store, "ip1", t0)
    recordRateLimitUse(store, "ip1", t0)
    expect(isRateLimited(store, "ip1", t0, LIMIT, WINDOW)).toBe(false)
  })

  it("blocks at the limit", () => {
    const store: RateLimitStore = new Map()
    recordRateLimitUse(store, "ip1", t0)
    recordRateLimitUse(store, "ip1", t0)
    recordRateLimitUse(store, "ip1", t0)
    expect(isRateLimited(store, "ip1", t0, LIMIT, WINDOW)).toBe(true)
  })

  it("does not record by itself (checking twice still allows)", () => {
    const store: RateLimitStore = new Map()
    expect(isRateLimited(store, "ip1", t0, LIMIT, WINDOW)).toBe(false)
    expect(isRateLimited(store, "ip1", t0, LIMIT, WINDOW)).toBe(false)
  })

  it("keeps keys independent", () => {
    const store: RateLimitStore = new Map()
    recordRateLimitUse(store, "ip1", t0)
    recordRateLimitUse(store, "ip1", t0)
    recordRateLimitUse(store, "ip1", t0)
    expect(isRateLimited(store, "ip1", t0, LIMIT, WINDOW)).toBe(true)
    expect(isRateLimited(store, "ip2", t0, LIMIT, WINDOW)).toBe(false)
  })

  it("frees up after the window slides past", () => {
    const store: RateLimitStore = new Map()
    recordRateLimitUse(store, "ip1", t0)
    recordRateLimitUse(store, "ip1", t0)
    recordRateLimitUse(store, "ip1", t0)
    expect(isRateLimited(store, "ip1", t0 + WINDOW + 1, LIMIT, WINDOW)).toBe(false)
  })
})
