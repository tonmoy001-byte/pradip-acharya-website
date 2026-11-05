// app/api/admin/debug-ip/route.ts  (TEMPORARY - delete after verification)
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const xff = req.headers.get("x-forwarded-for")
  const xri = req.headers.get("x-real-ip")
  const cf = req.headers.get("cf-connecting-ip")
  const parts = (xff ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  return NextResponse.json({
    has_xff: xff !== null,
    has_xri: xri !== null,
    has_cf: cf !== null,
    xff_count: parts.length,
    first_is_forged_203: parts.length > 0 && parts[0] === "203.0.113.9",
    last_is_forged_203: parts.length > 0 && parts[parts.length - 1] === "203.0.113.9",
  })
}