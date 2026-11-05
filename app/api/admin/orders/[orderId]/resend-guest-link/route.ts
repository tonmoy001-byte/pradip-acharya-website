import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { createServiceClient } from "@/lib/insforge-service"
import { newToken, sha256hex } from "@/lib/guest-token"
import { sendGuestLinksEmail } from "@/lib/email"
import { guestExchangeUrl } from "@/lib/guest-delivery"
import { serverError } from "@/lib/http-errors"

export const dynamic = "force-dynamic"

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const user = await requireAdmin()
    const { orderId } = await params

    const service = createServiceClient()
    const { data: order } = await service.database
      .from("orders")
      .select("id, user_id, payment_status, contact")
      .eq("id", orderId)
      .single()

    if (!order || order.user_id !== null || order.payment_status !== "paid") {
      return NextResponse.json({ error: "শুধু পরিশোধিত অতিথি অর্ডারের জন্য।" }, { status: 400 })
    }

    const email = typeof order.contact?.email === "string" ? order.contact.email.trim().toLowerCase() : ""
    if (!email) {
      return NextResponse.json({ error: "ইমেইল পাওয়া যায়নি।" }, { status: 400 })
    }

    const token = newToken()
    const hash = sha256hex(token)
    await service.database
      .from("orders")
      .update({
        guest_email_token_hash: hash,
        delivery_email_claimed_at: new Date().toISOString(),
        delivery_emailed_at: null,
      })
      .eq("id", orderId)
      .is("user_id", null)
      .eq("payment_status", "paid")

    const link = guestExchangeUrl(orderId, token)
    try {
      await sendGuestLinksEmail(email, [link])
      await service.database
        .from("orders")
        .update({ delivery_emailed_at: new Date().toISOString() })
        .eq("id", orderId)

      await service.database.from("payment_events").insert({
        provider: "admin",
        provider_transaction_id: orderId,
        order_id: orderId,
        status: "resend_guest_link",
        verified: true,
        actor_id: user.id,
        raw_payload: { by: user.id } as any,
      })
    } catch (err) {
      console.error("[admin-resend] email failed", { order_id: orderId })
      return NextResponse.json({ error: "ইমেইল পাঠানো যায়নি।" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    return serverError("admin resend guest link", err)
  }
}