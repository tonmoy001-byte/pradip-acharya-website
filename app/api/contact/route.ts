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
  extractContactEmail,
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
    // site_settings.value is JSONB, so a stored email can arrive either as
    // the plain string the route expects or as a JSON object such as
    // {"email": "..."} written by an admin tool. Normalise both rather than
    // rejecting the object form, which would otherwise surface as the
    // misleading "যোগাযোগ ইমেইল সেটআপ করা হয়নি।" error.
    const recipient = extractContactEmail(settings.contact_email)
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
      from: `"Pradipkumarwebsite" <${user}>`,
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
