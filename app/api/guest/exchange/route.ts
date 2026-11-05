// app/api/guest/exchange/route.ts
// GET: turn an emailed guest token into an httpOnly cookie, then send the
// buyer to their guest order page.
//
// The email link is the only place the raw token appears. This route removes
// it from the address bar and never puts it in a Referer header.

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServiceClient } from "@/lib/insforge-service"
import { sha256hex } from "@/lib/guest-token"
import { clientIpFirst, isRateLimited } from "@/lib/guest-rate-limit"

export const dynamic = "force-dynamic"

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/
const ORDER_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: Request) {
  // Rate limit (fail open): buyer has already paid; do not block on infra errors.
  try {
    const limited = await isRateLimited({
      scope: "guest-exchange",
      key: clientIpFirst(req),
      limit: 10,
      windowMs: 10 * 60 * 1000,
    })
    if (limited) {
      return new NextResponse(
        JSON.stringify({ error: "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।" }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "600",
            "Cache-Control": "no-store",
          },
        },
      )
    }
  } catch (err) {
    console.warn("[rate-limit-open] guest-exchange limiter failed:", err instanceof Error ? err.message : err)
  }

  const url = new URL(req.url)
  const rawOrderId = url.searchParams.get("order_id") ?? ""
  const token = url.searchParams.get("t") ?? ""

  const orderId = ORDER_RE.test(rawOrderId) ? rawOrderId : "unknown"

  if (!ORDER_RE.test(rawOrderId) || !TOKEN_RE.test(token)) {
    return NextResponse.redirect(
      new URL(`/guest/order/${encodeURIComponent(orderId)}?invalid=1`, req.url),
    )
  }

  // The RPC is the authorization check: it only returns a row when the token
  // belongs to this guest order.
  const service = createServiceClient()
  const { data, error } = await service.database.rpc("get_guest_order", {
    p_order_id: rawOrderId,
    p_token_hash: sha256hex(token),
  })

  if (error || !data) {
    return NextResponse.redirect(
      new URL(`/guest/order/${encodeURIComponent(orderId)}?invalid=1`, req.url),
    )
  }

  const res = NextResponse.redirect(
    new URL(`/guest/order/${encodeURIComponent(orderId)}`, req.url),
  )
  res.cookies.set(`go_${orderId}`, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  })
  res.headers.set("Referrer-Policy", "no-referrer")
  res.headers.set("Cache-Control", "no-store")
  return res
}
