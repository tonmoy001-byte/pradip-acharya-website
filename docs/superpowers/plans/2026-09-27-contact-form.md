# Contact Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public contact form at `/contact` whose submissions are emailed to the admin-configured Gmail inbox via server-side SMTP, with honeypot + min-time + rate-limit spam protection and zero database writes.

**Architecture:** Client component `ContactForm` POSTs JSON to `app/api/contact/route.ts` (Node runtime). The route runs pure gate/validation/sanitize logic from `lib/contact-form.ts`, reads the recipient from `site_settings.contact_email` (non-cached `getSiteSettings()`), and sends via nodemailer → smtp.gmail.com:587 with `GMAIL_USER`/`GMAIL_APP_PASSWORD`. The About page's `ইমেইল` button becomes an internal link to `/contact`, and `toGmailComposeUrl` is deleted.

**Tech Stack:** Next.js 16 App Router (route handler), React 19 client component, nodemailer + @types/nodemailer, vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-27-contact-form-design.md`

**Repo rules (override skill defaults):**
- **All changes stay UNCOMMITTED — there are no `git commit` steps in this plan.** Never commit or push. HEAD must remain `3d6241f`.
- Do not edit `.gitignore` or `.superpowers/`.
- PowerShell 5.1: chain with `;` (never `&&`). HTTP probes use `curl.exe`.
- No lint script exists — at verification time report "lint unavailable" instead of inventing a command.
- Vitest must run with the env preamble (Step "Test preamble" below). Run every test command from `H:\website`.

**Test preamble (prepend to every vitest invocation):**

```powershell
$env:NEXT_PUBLIC_INSFORGE_URL="https://cpd9mnqf.ap-southeast.insforge.app"; $env:NEXT_PUBLIC_INSFORGE_ANON_KEY="anon_34290d5cd8a56b6f0a9885ad57385af0fe4d38bd8fe02104e94f3f36d8b705e2"; npx vitest run <file>
```

---

### Task 1: `lib/contact-form.ts` — sanitize + validate (TDD)

**Files:**
- Create: `lib/contact-form.test.ts`
- Create: `lib/contact-form.ts`

- [ ] **Step 1: Write the failing tests (sanitize + validation)**

Create `lib/contact-form.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { sanitizeContactText, validateContactInput } from "./contact-form"

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
```

- [ ] **Step 2: Run the tests to verify they fail**

```powershell
$env:NEXT_PUBLIC_INSFORGE_URL="https://cpd9mnqf.ap-southeast.insforge.app"; $env:NEXT_PUBLIC_INSFORGE_ANON_KEY="anon_34290d5cd8a56b6f0a9885ad57385af0fe4d38bd8fe02104e94f3f36d8b705e2"; npx vitest run lib/contact-form.test.ts
```

Expected: FAIL — module `./contact-form` not found (or `sanitizeContactText is not a function`).

- [ ] **Step 3: Write the minimal implementation**

Create `lib/contact-form.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Same command as Step 2. Expected: PASS — 13 passed, 0 failed.

- [ ] **Step 5: No commit (repo rule — leave all changes uncommitted)**

---

### Task 2: `buildContactEmail` (TDD)

**Files:**
- Modify: `lib/contact-form.test.ts` (append)
- Modify: `lib/contact-form.ts` (append)

- [ ] **Step 1: Append the failing tests**

Append to `lib/contact-form.test.ts` (keep existing imports; add `buildContactEmail` to the import from `./contact-form`):

```ts
import { sanitizeContactText, validateContactInput, buildContactEmail } from "./contact-form"

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
```

Also extend the `import { describe, it, expect } from "vitest"` line is unchanged; add `type ContactPayload` import: `import { ..., type ContactPayload } from "./contact-form"`.

- [ ] **Step 2: Run the tests to verify they fail**

Same preamble command as Task 1 Step 2. Expected: FAIL — `buildContactEmail is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `lib/contact-form.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Same preamble command. Expected: PASS — 17 passed (13 + 4), 0 failed.

- [ ] **Step 5: No commit (repo rule)**

---

### Task 3: spam gates — honeypot/timing + rate limiter (TDD)

**Files:**
- Modify: `lib/contact-form.test.ts` (append)
- Modify: `lib/contact-form.ts` (append)

- [ ] **Step 1: Append the failing tests**

Append to `lib/contact-form.test.ts` (add `isBotSubmission`, `isRateLimited`, `recordRateLimitUse`, `type RateLimitStore` to the `./contact-form` import):

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Same preamble command. Expected: FAIL — `isBotSubmission is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `lib/contact-form.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Same preamble command. Expected: PASS — 28 passed (17 + 11), 0 failed.

- [ ] **Step 5: No commit (repo rule)**

---

### Task 4: Install nodemailer

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install runtime + type packages**

```powershell
npm install nodemailer; if ($?) { npm install -D @types/nodemailer }
```

- [ ] **Step 2: Verify both landed in package.json**

```powershell
node -e "const p=require('./package.json'); console.log('nodemailer:', p.dependencies.nodemailer, '| types:', p.devDependencies['@types/nodemailer'])"
```

Expected output: `nodemailer: ^7.x.x | types: ^7.x.x` (versions may differ; both must be non-undefined).

- [ ] **Step 3: No commit (repo rule)**

---

### Task 5: API route `app/api/contact/route.ts`

**Files:**
- Create: `app/api/contact/route.ts`

No unit test (route wiring is covered by the live integration tests in Task 10; all logic it delegates to is unit-tested). Type-safety is the gate for this task.

- [ ] **Step 1: Create the route**

```ts
// app/api/contact/route.ts
// POST /api/contact — validate, gate spam, and email the submission to the
// admin-configured contact inbox via Gmail SMTP. Nothing is stored.

import { NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { getSiteSettings } from "@/lib/api"
import {
  isBotSubmission,
  isRateLimited,
  recordRateLimitUse,
  validateContactInput,
  sanitizeContactText,
  buildContactEmail,
  type RateLimitStore,
} from "@/lib/contact-form"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const
const MAX_BODY_BYTES = 10 * 1024
const RATE_LIMIT = 3
const RATE_WINDOW_MS = 10 * 60 * 1000

// Module-level in-memory store: resets on cold start (accepted — no DB).
const rateStore: RateLimitStore = new Map()

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (!forwarded) return "unknown"
  return forwarded.split(",")[0].trim() || "unknown"
}

export async function POST(req: Request) {
  try {
    const contentLength = Number(req.headers.get("content-length") ?? "0")
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "বার্তাটি খুব বড়।" },
        { status: 400, headers: NO_STORE },
      )
    }

    let payload: unknown
    try {
      payload = await req.json()
    } catch {
      return NextResponse.json(
        { ok: false, error: "ভুল অনুরোধ।" },
        { status: 400, headers: NO_STORE },
      )
    }
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json(
        { ok: false, error: "ভুল অনুরোধ।" },
        { status: 400, headers: NO_STORE },
      )
    }
    const body = payload as Record<string, unknown>

    // 1. Spam gates — always fake success so bots learn nothing.
    const nowMs = Date.now()
    if (isBotSubmission({ honeypot: body.website, startedAt: body.startedAt, nowMs })) {
      return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE })
    }

    // 2. Validation — never trust the browser.
    const validated = validateContactInput(body)
    if (!validated.ok) {
      const error = Object.values(validated.errors)[0] ?? "তথ্যগুলো সঠিকভাবে পূরণ করুন।"
      return NextResponse.json({ ok: false, error }, { status: 400, headers: NO_STORE })
    }

    // 3. Rate limit per IP (checked before sending; recorded only on success).
    const ip = clientIp(req)
    if (isRateLimited(rateStore, ip, nowMs, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json(
        { ok: false, error: "অনেকবার চেষ্টা করেছেন। কিছুক্ষণ পরে আবার চেষ্টা করুন।" },
        { status: 429, headers: NO_STORE },
      )
    }

    // 4. Recipient — admin-configurable site setting (non-cached read).
    const settings = await getSiteSettings()
    const recipient =
      typeof settings.contact_email === "string" ? settings.contact_email.trim() : ""
    if (!recipient) {
      return NextResponse.json(
        { ok: false, error: "যোগাযোগ ইমেইল সেটআপ করা হয়নি।" },
        { status: 503, headers: NO_STORE },
      )
    }

    const user = process.env.GMAIL_USER
    const pass = process.env.GMAIL_APP_PASSWORD
    if (!user || !pass) {
      console.error("contact: GMAIL_USER / GMAIL_APP_PASSWORD not configured")
      return NextResponse.json(
        { ok: false, error: "ইমেইল পাঠানো সাময়িকভাবে বন্ধ আছে।" },
        { status: 503, headers: NO_STORE },
      )
    }

    // 5. Sanitize (strip CR/LF — header-injection defense) and build the mail.
    const data = {
      name: sanitizeContactText(validated.data.name),
      email: sanitizeContactText(validated.data.email),
      subject: sanitizeContactText(validated.data.subject),
      message: sanitizeContactText(validated.data.message),
    }
    const mail = buildContactEmail(data)

    // 6. Send via Gmail SMTP.
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    })

    await transporter.sendMail({
      from: `"প্রদীপ কুমার আচার্য্য - Website" <${user}>`,
      to: recipient,
      replyTo: data.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })

    recordRateLimitUse(rateStore, ip, nowMs)
    return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE })
  } catch (err) {
    // Log the reason only — never credentials or message bodies.
    console.error("contact: send failed:", err instanceof Error ? err.message : "unknown error")
    return NextResponse.json(
      { ok: false, error: "পাঠানো যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।" },
      { status: 502, headers: NO_STORE },
    )
  }
}
```

- [ ] **Step 2: Type-check the whole project**

```powershell
npx tsc --noEmit
```

Expected: no output, exit 0. If it fails, fix only type errors in the new route.

- [ ] **Step 3: No commit (repo rule)**

---

### Task 6: `components/ContactForm.tsx`

**Files:**
- Create: `components/ContactForm.tsx`

Follows the login page's form conventions (`form-group` / `form-label` / `form-input`, role-tagged alerts, `submitting` flag).

- [ ] **Step 1: Create the component**

```tsx
"use client"

import { useEffect, useRef, useState } from "react"

type SubmitState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "success" }
  | { status: "error"; message: string }

export default function ContactForm() {
  const startedAtRef = useRef<number | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [website, setWebsite] = useState("") // honeypot — humans never see or fill this
  const [state, setState] = useState<SubmitState>({ status: "idle" })

  useEffect(() => {
    startedAtRef.current = Date.now()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state.status === "pending") return
    setState({ status: "pending" })

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          subject,
          message,
          website,
          startedAt: startedAtRef.current,
        }),
      })
      const data = await res.json().catch(() => null)

      if (res.ok && data?.ok) {
        setState({ status: "success" })
        setName("")
        setEmail("")
        setSubject("")
        setMessage("")
        setWebsite("")
        startedAtRef.current = Date.now()
      } else {
        setState({
          status: "error",
          message: data?.error || "পাঠানো যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।",
        })
      }
    } catch {
      setState({
        status: "error",
        message: "নেটওয়ার্ক সমস্যা হয়েছে। আবার চেষ্টা করুন।",
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate={false}>
      {state.status === "success" && (
        <div
          role="status"
          style={{
            padding: "var(--sp-3) var(--sp-4)",
            marginBottom: "var(--sp-4)",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "var(--radius)",
            color: "#166534",
            fontSize: "0.875rem",
          }}
        >
          আপনার বার্তা পাঠানো হয়েছে। ধন্যবাদ!
        </div>
      )}

      {state.status === "error" && (
        <div
          role="alert"
          style={{
            padding: "var(--sp-3) var(--sp-4)",
            marginBottom: "var(--sp-4)",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "var(--radius)",
            color: "#991b1b",
            fontSize: "0.875rem",
          }}
        >
          {state.message}
        </div>
      )}

      <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
        <label className="form-label" htmlFor="contact-name">
          নাম *
        </label>
        <input
          id="contact-name"
          className="form-input"
          style={{ width: "100%" }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
        />
      </div>

      <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
        <label className="form-label" htmlFor="contact-email">
          ইমেইল *
        </label>
        <input
          id="contact-email"
          type="email"
          className="form-input"
          style={{ width: "100%" }}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={254}
          autoComplete="email"
        />
      </div>

      <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
        <label className="form-label" htmlFor="contact-subject">
          বিষয়
        </label>
        <input
          id="contact-subject"
          className="form-input"
          style={{ width: "100%" }}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
        />
      </div>

      <div className="form-group" style={{ marginBottom: "var(--sp-6)" }}>
        <label className="form-label" htmlFor="contact-message">
          বার্তা *
        </label>
        <textarea
          id="contact-message"
          className="form-input"
          style={{ width: "100%", minHeight: 140, resize: "vertical" }}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={5000}
          rows={6}
        />
      </div>

      {/* Honeypot — off-screen, unreachable by keyboard/AT */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
        }}
      />

      <button type="submit" className="btn btn-primary" disabled={state.status === "pending"}>
        {state.status === "pending" ? "পাঠানো হচ্ছে…" : "বার্তা পাঠান"}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Type-check**

```powershell
npx tsc --noEmit
```

Expected: no output, exit 0.

- [ ] **Step 3: No commit (repo rule)**

---

### Task 7: Replace `/contact` page content with the form

**Files:**
- Modify: `app/contact/page.tsx` (full replacement — current file is 35 lines of static placeholder incl. fake email)

- [ ] **Step 1: Replace the whole file**

```tsx
import type { Metadata } from "next"
import ContactForm from "@/components/ContactForm"

export const metadata: Metadata = {
  title: "যোগাযোগ | প্রদীপ কুমার আচার্য্য",
  description: "আমাদের সাথে যোগাযোগ করুন।",
}

export default function ContactPage() {
  return (
    <div className="container section-padding" style={{ maxWidth: 600, marginInline: "auto" }}>
      <div className="page-header">
        <h1>যোগাযোগ</h1>
      </div>
      <ContactForm />
    </div>
  )
}
```

(The পাঠক সহায়তা / অর্ডার সহায়তা sections and the placeholder `info@pradeep-acharya.example.com` block are removed by this replacement.)

- [ ] **Step 2: Type-check**

```powershell
npx tsc --noEmit
```

Expected: no output, exit 0.

- [ ] **Step 3: No commit (repo rule)**

---

### Task 8: About page email button → `/contact`, delete `toGmailComposeUrl`

**Files:**
- Modify: `app/about/page.tsx:5,21,44-67` (import, `emailUrl` calc, button JSX)
- Modify: `lib/contact.ts` (delete `toGmailComposeUrl`)
- Modify: `lib/contact.test.ts` (delete its describe block, lines ~37-54)

- [ ] **Step 1: Update the About page import (line 5)**

Change:

```tsx
import { toGmailComposeUrl, toWhatsAppUrl } from "@/lib/contact"
```

To:

```tsx
import { toWhatsAppUrl } from "@/lib/contact"
import Link from "next/link"
```

- [ ] **Step 2: Remove the `emailUrl` computation (line 21)**

Change:

```tsx
  const whatsappUrl = toWhatsAppUrl(settings.contact_whatsapp)
  const emailUrl = toGmailComposeUrl(settings.contact_email)
```

To:

```tsx
  const whatsappUrl = toWhatsAppUrl(settings.contact_whatsapp)
```

- [ ] **Step 3: Replace the conditional + email anchor (lines 44-67)**

Change:

```tsx
            {(whatsappUrl || emailUrl) && (
              <div className="about-contact">
                {whatsappUrl && (
                  <a
                    className="about-contact-btn about-contact-whatsapp"
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    হোয়াটসঅ্যাপ
                  </a>
                )}
                {emailUrl && (
                  <a
                    className="about-contact-btn about-contact-email"
                    href={emailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ইমেইল
                  </a>
                )}
              </div>
            )}
```

To:

```tsx
            <div className="about-contact">
              {whatsappUrl && (
                <a
                  className="about-contact-btn about-contact-whatsapp"
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  হোয়াটসঅ্যাপ
                </a>
              )}
              <Link href="/contact" className="about-contact-btn about-contact-email">
                ইমেইল
              </Link>
            </div>
```

(Email button now renders unconditionally, same-tab internal navigation, no `target="_blank"`.)

- [ ] **Step 4: Delete `toGmailComposeUrl` from `lib/contact.ts`**

Remove lines 15-19 (the whole function) so `lib/contact.ts` ends after `toWhatsAppUrl`:

```ts
export function toWhatsAppUrl(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "")
  if (digits.length < 7) return null
  let normalized: string
  if (digits.startsWith("880")) {
    normalized = digits
  } else if (digits.startsWith("0")) {
    normalized = `880${digits.slice(1)}`
  } else {
    normalized = digits
  }
  return `https://wa.me/${normalized}`
}
```

- [ ] **Step 5: Delete the `toGmailComposeUrl` describe block from `lib/contact.test.ts`**

Remove the entire block (starting `describe("toGmailComposeUrl", () => {` through its closing `})`) — 3 tests. The `toWhatsAppUrl` describe block (6 tests) stays.

- [ ] **Step 6: Run the full test suite + type-check**

```powershell
$env:NEXT_PUBLIC_INSFORGE_URL="https://cpd9mnqf.ap-southeast.insforge.app"; $env:NEXT_PUBLIC_INSFORGE_ANON_KEY="anon_34290d5cd8a56b6f0a9885ad57385af0fe4d38bd8fe02104e94f3f36d8b705e2"; npx vitest run
```

Expected: PASS — all files green (suite = previous 50 − 3 gmail tests + 28 new = 75, ±0 if counts shifted — the requirement is **0 failed**).

```powershell
npx tsc --noEmit
```

Expected: no output, exit 0 (proves no lingering `toGmailComposeUrl` references).

- [ ] **Step 7: No commit (repo rule)**

---

### Task 9: Full verification — tests, types, build

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

```powershell
$env:NEXT_PUBLIC_INSFORGE_URL="https://cpd9mnqf.ap-southeast.insforge.app"; $env:NEXT_PUBLIC_INSFORGE_ANON_KEY="anon_34290d5cd8a56b6f0a9885ad57385af0fe4d38bd8fe02104e94f3f36d8b705e2"; npx vitest run
```

Expected: 0 failed.

- [ ] **Step 2: Type-check**

```powershell
npx tsc --noEmit
```

Expected: no output, exit 0.

- [ ] **Step 3: Production build**

```powershell
npm run build
```

Expected: build succeeds (route `app/api/contact` present as a static/dynamic route in output; no type errors). If the build fails, stop and fix before deploying.

- [ ] **Step 4: Lint check (report availability)**

```powershell
npm run lint --if-present
```

Expected: "lint unavailable" (no `lint` script in package.json — report this, do not invent a command).

- [ ] **Step 5: No commit (repo rule)**

---

### Task 10: Gmail secrets, deploy, live verification

**Files:**
- Modify: `.env.local` (append two lines, local dev parity)
- Deployment env via InsForge CLI

This task requires **user interaction** (Step 1). Stop and ask the user when you reach it.

- [ ] **Step 1: Obtain Gmail App Password (USER INTERACTION — pause here)**

Tell the user:

> To send email I need two server-side secrets:
> 1. Your Gmail address (`GMAIL_USER`) — e.g. `itay89640@gmail.com`
> 2. A Gmail **App Password** (`GMAIL_APP_PASSWORD`, 16 chars, different from your login password):
>    - Open https://myaccount.google.com/security
>    - Turn ON **2-Step Verification** (required first), then return to that page
>    - Search "App Passwords" (or open https://myaccount.google.com/apppasswords)
>    - Create one named "website contact form" and copy the 16-char value

Wait for the user to provide both values. **Never print them to logs or commit them.**

- [ ] **Step 2: Set deployment environment variables**

```powershell
npx -y @insforge/cli deployments env set GMAIL_USER "<gmail-address-from-user>" --json
npx -y @insforge/cli deployments env set GMAIL_APP_PASSWORD "<16-char-app-password-from-user>" --json
```

Expected: both return success JSON. Verify with:

```powershell
npx -y @insforge/cli deployments env list --json
```

Expected: both keys listed (values masked or shown per CLI output — fine either way).

- [ ] **Step 3: Append the same vars to `.env.local` (local dev parity)**

Append (do not overwrite existing lines):

```
GMAIL_USER=<gmail-address-from-user>
GMAIL_APP_PASSWORD=<16-char-app-password-from-user>
```

- [ ] **Step 4: Deploy**

```powershell
npx -y @insforge/cli deployments deploy . --json
```

Timeout: 600000 ms. Expected: deployment ID + status READY (poll `npx -y @insforge/cli deployments status <id> --json` if not immediately READY).

- [ ] **Step 5: Wait out the settings cache, then smoke-test the page HTML**

```powershell
Start-Sleep -Seconds 75; curl.exe -s https://cpd9mnqf.insforge.site/contact | Out-File -Encoding utf8 $env:TEMP\contact.html; curl.exe -s https://cpd9mnqf.insforge.site/about | Out-File -Encoding utf8 $env:TEMP\about.html
Select-String -Path $env:TEMP\contact.html -Pattern "contact-name" -Quiet
Select-String -Path $env:TEMP\contact.html -Pattern "pradeep-acharya.example.com" -Quiet
Select-String -Path $env:TEMP\about.html -Pattern "mail.google.com" -Quiet
Select-String -Path $env:TEMP\about.html -Pattern "/contact" -Quiet
```

Expected (four True/False lines): `True`, `False` (placeholder gone), `False` (gmail-compose gone), `True` (about links to /contact).

- [ ] **Step 6: API behavior — validation and honeypot (no real emails sent)**

```powershell
curl.exe -s -o - -w "HTTP %{http_code}`n" -X POST https://cpd9mnqf.insforge.site/api/contact -H "Content-Type: application/json" -d "{\"name\":\"a\",\"email\":\"bad\",\"message\":\"short\"}"
```

Expected: `HTTP 400` with a Bengali `error`.

```powershell
curl.exe -s -o - -w "HTTP %{http_code}`n" -X POST https://cpd9mnqf.insforge.site/api/contact -H "Content-Type: application/json" -d "{\"name\":\"Bot\",\"email\":\"bot@x.com\",\"message\":\"spam message here\",\"website\":\"http://spam\",\"startedAt\":$( [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - 60000 )}"
```

Expected: `HTTP 200` `{"ok":true}` — and **no email arrives** (user confirms inbox unchanged).

- [ ] **Step 7: Real submission — email must arrive (USER CONFIRMATION)**

```powershell
curl.exe -s -o - -w "HTTP %{http_code}`n" -X POST https://cpd9mnqf.insforge.site/api/contact -H "Content-Type: application/json" -d "{\"name\":\"Test Visitor\",\"email\":\"test-visitor@example.com\",\"subject\":\"Plan live test\",\"message\":\"This is a live verification submission from the contact form.\",\"startedAt\":$( [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - 60000 )}"
```

Expected: `HTTP 200` `{"ok":true}`.

**Ask the user to confirm in Gmail:** a new email with subject `Website Contact: Plan live test`, body starting `Name: Test Visitor`, sent to their contact inbox, and **Reply-To = test-visitor@example.com** (visible in Gmail's "Show original" / reply header). Stop here until the user confirms.

- [ ] **Step 8: Rate limit — 3 more sends, then 429**

```powershell
1..3 | ForEach-Object { curl.exe -s -o - -w "HTTP %{http_code}`n" -X POST https://cpd9mnqf.insforge.site/api/contact -H "Content-Type: application/json" -d "{\"name\":\"Rate Test\",\"email\":\"rate@example.com\",\"subject\":\"Rate $_\",\"message\":\"Rate limit verification message $_.\",\"startedAt\":$( [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - 60000 )}" }
```

Expected: three × `HTTP 200` (two more real emails arrive). Then the 4th:

```powershell
curl.exe -s -o - -w "HTTP %{http_code}`n" -X POST https://cpd9mnqf.insforge.site/api/contact -H "Content-Type: application/json" -d "{\"name\":\"Rate Test\",\"email\":\"rate@example.com\",\"subject\":\"Rate 4\",\"message\":\"Rate limit verification message four.\",\"startedAt\":$( [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - 60000 )}"
```

Expected: `HTTP 429` with the Bengali try-later message. (Note: the live server's cold-start may have already reset the store — if the 4th returns 200, repeat the batch once; if it still won't block, the unit tests are the guarantee and this is accepted as a cold-start artifact.)

- [ ] **Step 9: About → contact navigation (real browser)**

Run a dev-browser script (temp file under `%TEMP%\opencode\`, screenshot path relative):

```js
// navigate to /about, click the ইমেইল button, expect landed on /contact
await page.goto("https://cpd9mnqf.insforge.site/about", { waitUntil: "domcontentloaded" });
const emailBtn = page.locator("a.about-contact-email");
await emailBtn.click();
await page.waitForURL("**/contact", { timeout: 15000 });
await page.screenshot({ path: "contact-form-live.png", fullPage: true });
```

Expected: URL becomes `https://cpd9mnqf.insforge.site/contact`; screenshot shows the Bengali form (নাম / ইমেইল / বিষয় / বার্তা + submit button). View the screenshot to confirm layout renders correctly.

- [ ] **Step 10: Admin recipient-change check (USER INTERACTION — optional but in spec)**

Ask the user to: change অ্যাডমিন → সেটিংস → সেধারণ → ইমেইল to a different inbox they control, save, then run Step 7's curl once more — the new email must arrive at the **new** address (no redeploy needed). Afterwards, restore `contact_email = itay89640@gmail.com` via the admin panel. Skip this step if the user declines.

- [ ] **Step 11: Final report + no commit (repo rule)**

Summarize: files created/changed, test totals, deploy ID, live check outcomes, and confirm nothing was committed. Do NOT run any git commands that modify state.

---

## Self-Review (plan vs spec)

1. **Spec coverage:**
   - Frontend form fields/limits/labels → Task 6 ✓; page replacement → Task 7 ✓; About button → Task 8 ✓
   - API route order (parse → gates → validate → rate → recipient → sanitize → build → send) → Task 5 ✓; response codes 200/400/429/502/503 → Task 5 ✓
   - Pure functions (validate/sanitize/build/bot/rate) → Tasks 1-3 ✓ with the spec's exact test list (incl. `\r\n` regression, sliding-window tests) ✓
   - `site_settings.contact_email` non-cached read → Task 5 (`getSiteSettings` from `lib/api.ts`) ✓
   - nodemailer dep → Task 4 ✓; env vars → Task 10 ✓; no DB ✓
   - Integration list (arrival/Reply-To, honeypot-silent, 429, admin recipient change, about navigation, tsc/vitest/build/lint-report) → Task 10 ✓
2. **Placeholder scan:** No TBD/TODO; the only "user-supplied" values are the Gmail secrets (Step 10 is an explicit interaction step with exact commands). ✓
3. **Type consistency:** `validateContactInput` → `ValidationResult.data: ContactPayload`; `buildContactEmail(data: ContactPayload)`; route uses `validated.data.*` ✓. `RateLimitStore = Map<string, number[]>` used by both functions and route ✓. About page after Step 3 no longer references `emailUrl` ✓ (tsc in Step 6 enforces).
