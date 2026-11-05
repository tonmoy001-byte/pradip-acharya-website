// app/api/guest/resend/route.ts
// POST: resend guest download links to the email on file.
//
// Uniform response: never reveals whether an email has an order, and the mail
// is only ever sent to the address stored on a paid guest order (never to a
// request-supplied address). Work happens after the response via `after()` so
// response time does not leak existence.

import { NextResponse } from "next/server"
import { after } from "next/server"
import { createServiceClient } from "@/lib/insforge-service"
import { newToken, sha256hex } from "@/lib/guest-token"
import { clientIp, isRateLimited } from "@/lib/guest-rate-limit"
import { guestExchangeUrl } from "@/lib/guest-delivery"

export const dynamic = "force-dynamic"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NO_STORE = { "Cache-Control": "no-store" }

const SUCCESS = {
  ok: true,
  message: "যদি এই ইমেইলে কোনো পরিশোধিত অর্ডার থাকে, আমরা ডাউনলোড লিংক পাঠিয়েছি।",
}

export async function POST(req: Request) {
  let email = ""
  try {
    const body = await req.json().catch(() => ({}))
    const raw = (body as { email?: unknown })?.email
    if (typeof raw === "string") email = raw.trim().toLowerCase()
  } catch {
    email = ""
  }

  const ip = clientIp(req)

  // Schedule all work after the response so timing is uniform.
  const runWork = async () => {
    // Rate limits (both must pass). On hit, do nothing (still "success").
    let ipLimited = false
    let emailLimited = false
    try {
      ipLimited = await isRateLimited({
        scope: "guest-resend-ip",
        key: ip,
        limit: 5,
        windowMs: 60 * 60 * 1000,
      })
    } catch (err) {
      console.warn("[rate-limit-open] guest-resend-ip limiter failed:", err instanceof Error ? err.message : err)
      ipLimited = false
    }
    try {
      emailLimited = await isRateLimited({
        scope: "guest-resend-email",
        key: sha256hex(email),
        limit: 3,
        windowMs: 60 * 60 * 1000,
      })
    } catch (err) {
      console.warn("[rate-limit-open] guest-resend-email limiter failed:", err instanceof Error ? err.message : err)
      emailLimited = false
    }

    if (ipLimited || emailLimited) return
    if (!EMAIL_RE.test(email) || email.length > 254) return

    const service = createServiceClient()

    const { data: orders } = await service.database
      .from("orders")
      .select("id, contact")
      .is("user_id", null)
      .eq("payment_status", "paid")
      .order("created_at", { ascending: false })
      .limit(20)

    const matches = (orders ?? []).filter((o: any) => {
      const stored = typeof o?.contact?.email === "string" ? o.contact.email.trim().toLowerCase() : ""
      return stored === email
    }).slice(0, 5)

    if (matches.length === 0) return

    const links: string[] = []
    for (const order of matches) {
      const token = newToken()
      const hash = sha256hex(token)
      await service.database
        .from("orders")
        .update({
          guest_email_token_hash: hash,
          delivery_email_claimed_at: new Date().toISOString(),
          delivery_emailed_at: null,
        })
        .eq("id", order.id)
        .is("user_id", null)
        .eq("payment_status", "paid")
      links.push(guestExchangeUrl(order.id, token))
    }

    try {
      const { sendGuestLinksEmail } = await import("@/lib/email")
      await sendGuestLinksEmail(email, links)
      for (const order of matches) {
        await service.database
          .from("orders")
          .update({ delivery_emailed_at: new Date().toISOString() })
          .eq("id", order.id)
      }
    } catch (err) {
      console.error("[guest-resend] email failed")
    }
  }

  // Run after response when possible; fall back to fire-and-forget in tests.
  try {
    after(runWork)
  } catch {
    void runWork()
  }

  return NextResponse.json(SUCCESS, { headers: NO_STORE })
}