// app/api/contact/route.ts
// POST /api/contact — validate, gate spam, and email the submission to the
// admin-configured contact inbox via Gmail SMTP. Nothing is stored.

import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import nodemailer from "nodemailer"
import { getSiteSettings } from "@/lib/api"
import {
  isBotSubmission,
  validateContactInput,
  sanitizeContactText,
  buildContactEmail,
  extractContactEmail,
} from "@/lib/contact-form"
import { assertSameOrigin } from "@/lib/origin-check"
import { createServerClient } from "@/lib/insforge-server"
import { createServiceClient } from "@/lib/insforge-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const
const MAX_BODY_BYTES = 10 * 1024
const RATE_LIMIT = 3
const RATE_WINDOW_MS = 10 * 60 * 1000

// Server-side salt so the raw client IP is never stored; only its hash is.
const IP_SALT = process.env.CONTACT_RATE_LIMIT_SALT || process.env.INSFORGE_SERVICE_KEY || "pradipbooks-contact-salt"

function ipHash(ip: string): string {
  return createHash("sha256").update(ip + "|" + IP_SALT).digest("hex")
}

/** Persistent rate limit backed by the contact_rate_limits table.
 *
 * Inserts a row, then counts rows for this IP hash in the window. If the count
 * exceeds the limit the row is rolled back and the caller is told to wait.
 * This survives cold starts and is per-IP across instances.
 */
async function isRateLimitedDb(ip: string): Promise<boolean> {
  // Service client: contact_rate_limits has RLS on with no policies
  // (017), so only the service key may read or write it.
  const client = createServiceClient()
  const hash = ipHash(ip)
  const { error: insertError } = await client.database
    .from("contact_rate_limits")
    .insert([{ ip_hash: hash }])
  if (insertError) {
    // If the table is missing or unreachable, fail open to keep the form
    // working rather than blocking every submission permanently.
    console.error("contact: rate-limit insert failed:", insertError.message)
    return false
  }
  const cutoff = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const { count, error: countError } = await client.database
    .from("contact_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", hash)
    .gte("submitted_at", cutoff)
  if (countError || (count ?? 0) <= RATE_LIMIT) return false
  // Roll back our own row so the window is not inflated by the rejected attempt.
  await client.database
    .from("contact_rate_limits")
    .delete()
    .eq("ip_hash", hash)
    .gte("submitted_at", cutoff)
    .lt("submitted_at", new Date().toISOString())
    .limit(1)
  return true
}

// The first x-forwarded-for value is client-controlled and spoofable. Prefer
// the proxy's own header first, then the last entry (added by our trusted
// proxy). Vercel strips x-forwarded-for for client requests, so we fall back
// to "unknown" rather than trusting a spoofed value.
function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")
  if (real) return real.trim()
  const parts = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length ? parts[parts.length - 1] : "unknown"
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req)

    // Read the body ourselves so the size limit cannot be bypassed by a
    // missing or false Content-Length header.
    const raw = await req.text()
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "বার্তাটি খুব বড়।" },
        { status: 400, headers: NO_STORE },
      )
    }

    let payload: unknown
    try {
      payload = JSON.parse(raw)
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

    // 3. Persistent rate limit per IP (checked before sending; recorded only on success).
    const ip = clientIp(req)
    if (await isRateLimitedDb(ip)) {
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

    // The rate-limit row was inserted up front; successful submissions count
    // toward the limit just like rejected ones.
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
