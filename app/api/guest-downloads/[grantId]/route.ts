// app/api/guest-downloads/[grantId]/route.ts
// GET: stream a guest's paid ebook.
//
// Authorization chain:
//   1. the httpOnly `go_<order>` cookie (set at checkout or by the email
//      exchange route) is present and well-formed
//   2. the service-only consume_guest_download() RPC accepts the token for the
//      grant's own order (uniform `forbidden` on every failure)
//   3. only then is the private storage object downloaded with the same
//      server-side project_admin client
//
// The browser never calls the RPC directly. `order_id` is only used to pick
// which cookie to read; the RPC validates the token against the grant's order,
// not against the query string.
//
// Browser navigations get a 303 back to the guest order page; fetch callers
// keep JSON.

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServiceClient } from "@/lib/insforge-service"
import { sha256hex } from "@/lib/guest-token"
import { clientIpFirst, isRateLimited } from "@/lib/guest-rate-limit"
import { serverError } from "@/lib/http-errors"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isBrowserNavigation(req: Request): boolean {
  const dest = req.headers.get("sec-fetch-dest")
  if (dest === "document") return true
  const accept = req.headers.get("accept") || ""
  return accept.includes("text/html")
}

function denied(req: Request, orderId: string, code: string, message: string) {
  if (isBrowserNavigation(req)) {
    return new Response(null, {
      status: 303,
      headers: {
        Location: `/guest/order/${encodeURIComponent(orderId)}?dl_error=${code}`,
        ...NO_STORE,
      },
    })
  }
  return NextResponse.json({ error: message }, { status: 403, headers: NO_STORE })
}

type RouteParams = { params: Promise<{ grantId: string }> }

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { grantId } = await params
    const url = new URL(req.url)
    const rawOrderId = url.searchParams.get("order_id") ?? ""
    const orderId = UUID_RE.test(rawOrderId) ? rawOrderId : "unknown"

    // Rate limit first (fail open): buyer has already paid.
    try {
      const ip = clientIpFirst(req)
      const limited = await isRateLimited({
        scope: "guest-download",
        key: `${rawOrderId}:${ip}`,
        limit: 30,
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
      console.warn("[rate-limit-open] guest-download limiter failed:", err instanceof Error ? err.message : err)
    }

    if (!UUID_RE.test(grantId) || !UUID_RE.test(rawOrderId)) {
      return denied(req, orderId, "not_found", "ডাউনলোড অনুমোদিত নয়")
    }

    const token = (await cookies()).get(`go_${orderId}`)?.value
    if (!token || !TOKEN_RE.test(token)) {
      return denied(req, orderId, "not_found", "ডাউনলোড অনুমোদিত নয়")
    }

    const service = createServiceClient()

    // Authorization gate (no increment, no lock). Returns storage key + title.
    const { data, error } = await service.database.rpc("authorize_guest_download", {
      p_grant_id: grantId,
      p_order_id: rawOrderId,
      p_token_hash: sha256hex(token),
    })

    const result = (data ?? {}) as { storage_key?: string; title?: string }
    const storageKey = typeof result.storage_key === "string" ? result.storage_key : ""

    if (error || !storageKey) {
      return denied(req, orderId, "not_found", "ডাউনলোড অনুমোদিত নয়")
    }

    const { data: blob, error: storageError } = await service.storage
      .from("digital-books")
      .download(storageKey)

    if (storageError || !blob) {
      console.error("[guest-download] storage download failed", {
        order_id: orderId,
        message: storageError?.message,
      })
      return denied(req, orderId, "storage", "ফাইলটি এখন পাওয়া যাচ্ছে না")
    }

    // Record the download only after a successful storage fetch.
    try {
      await service.database.rpc("record_guest_download", { p_grant_id: grantId })
    } catch (err) {
      console.error("[guest-download] record failed", { order_id: orderId })
    }

    const baseTitle =
      String(result.title || "")
        .replace(/["\\\r\n]/g, "")
        .replace(/\.pdf$/i, "")
        .trim() || "ebook"
    const asciiName = `${baseTitle.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_")}.pdf`
    const utf8Name = encodeURIComponent(`${baseTitle}.pdf`)

    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    }
    if (typeof blob.size === "number" && Number.isFinite(blob.size)) {
      headers["Content-Length"] = String(blob.size)
    }

    return new Response(blob, { headers })
  } catch (err: unknown) {
    if (err instanceof Response) {
      return new Response(err.body, {
        status: err.status,
        headers: { ...Object.fromEntries(err.headers), ...NO_STORE },
      })
    }
    return serverError("guest download", err, { headers: NO_STORE })
  }
}
