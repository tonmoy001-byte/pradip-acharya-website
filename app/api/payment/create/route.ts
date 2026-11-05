// app/api/payment/create/route.ts
// POST: Initiate NagorikPay payment for an order.
//
// Idempotent: reuses a live payment attempt, rejects paid/terminal orders,
// and atomically claims a new attempt via begin_payment_attempt() (signed-in)
// or begin_guest_payment_attempt() (guest) so parallel requests cannot create
// two gateway sessions.
//
// Guest requests are authorized only by the httpOnly `go_<order>` cookie set
// at checkout. The browser never calls the guest RPC directly: this route
// checks the cookie locally, then uses the server-side project_admin client
// for the authorization RPC. Every guest rejection is the same 403 so an
// unknown order id and a wrong token are indistinguishable.

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getOptionalUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { createServiceClient } from "@/lib/insforge-service"
import { createNagorikPayPayment, formatNagorikPayAmount } from "@/lib/nagorikpay"
import { paymentUrls } from "@/lib/payment-urls"
import { assertSameOrigin } from "@/lib/origin-check"
import { sha256hex } from "@/lib/guest-token"

export const dynamic = "force-dynamic"

/** Last path segment of a URL (the gateway's execute/transaction id). */
function lastPathSegment(url: string): string | null {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean)
    return segments.length > 0 ? segments[segments.length - 1] : null
  } catch {
    return null
  }
}

interface OrderRow {
  id: string
  user_id: string | null
  total: number
  payment_status: string
  contact: { name: string; email: string; phone: string }
}

interface ClaimRow {
  action: string
  attempt_id?: string
  payment_url?: string
  reason?: string
  order_id?: string
  total?: number
  currency?: string
  contact?: { name: string; email: string; phone: string }
}

const GUEST_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

function guestForbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req)

    const body = await req.json()
    const { order_id } = body as { order_id: string }

    if (!order_id) {
      return NextResponse.json({ error: "order_id required" }, { status: 400 })
    }

    const user = await getOptionalUser()

    let claim: unknown
    let claimError: { message?: string; code?: string } | null = null
    let paymentOrder: { total: number; contact: OrderRow["contact"] }

    if (user) {
      // ---- Signed-in buyer: unchanged behaviour ----
      const client = await createServerClient()

      const { data: order, error: orderError } = await client.database
        .from("orders")
        .select("id, user_id, total, payment_status, contact")
        .eq("id", order_id)
        .single()

      if (orderError || !order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 })
      }

      const orderRow = order as OrderRow

      if (orderRow.user_id !== user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }

      if (orderRow.payment_status !== "pending_payment" && orderRow.payment_status !== "payment_review") {
        return NextResponse.json({ error: "Order already processed" }, { status: 409 })
      }

      if (!(Number(orderRow.total) > 0)) {
        return NextResponse.json({ error: "Nothing to pay for this order" }, { status: 400 })
      }

      const { data, error } = await client.database.rpc("begin_payment_attempt", {
        p_order_id: order_id,
      })
      claim = data
      claimError = error

      paymentOrder = { total: Number(orderRow.total), contact: orderRow.contact }
    } else {
      // ---- Guest buyer ----
      const token = (await cookies()).get(`go_${order_id}`)?.value
      if (!token || !GUEST_TOKEN_RE.test(token)) return guestForbidden()

      const service = createServiceClient()
      const { data, error } = await service.database.rpc("begin_guest_payment_attempt", {
        p_order_id: order_id,
        p_guest_token_hash: sha256hex(token),
      })
      claim = data
      claimError = error

      // Filled from the RPC once the attempt is claimed; the service client
      // never reads the order directly for a guest.
      paymentOrder = { total: 0, contact: { name: "", email: "", phone: "" } }
    }

    if (claimError) {
      console.error("[payment] begin attempt failed", {
        order_id,
        guest: !user,
        message: claimError.message,
      })
      if (!user && (claimError.code === "42501" || /forbidden/i.test(claimError.message ?? ""))) {
        return guestForbidden()
      }
      return NextResponse.json(
        { error: "Payment could not be started. Please try again." },
        { status: 500 },
      )
    }

    if (!claim) {
      if (!user) return guestForbidden()
      return NextResponse.json(
        { error: "Payment could not be started. Please try again." },
        { status: 500 },
      )
    }

    const claimRow = claim as ClaimRow

    if (claimRow.action === "reuse" && claimRow.payment_url) {
      return NextResponse.json({ payment_url: claimRow.payment_url })
    }

    if (claimRow.action === "in_progress") {
      return NextResponse.json({ error: "payment_in_progress", order_id }, { status: 409 })
    }

    if (claimRow.action === "rejected") {
      return NextResponse.json({ error: "Order already processed" }, { status: 409 })
    }

    if (claimRow.action !== "claimed" || !claimRow.attempt_id) {
      if (!user) return guestForbidden()
      return NextResponse.json(
        { error: "Payment could not be started. Please try again." },
        { status: 500 },
      )
    }

    const attemptId = claimRow.attempt_id

    if (!user) {
      // begin_guest_payment_attempt returns the server-owned pricing/contact
      // with the claim, so no extra table read is needed.
      paymentOrder = {
        total: Number(claimRow.total ?? 0),
        contact: claimRow.contact ?? { name: "", email: "", phone: "" },
      }
      if (!(paymentOrder.total > 0)) {
        return NextResponse.json({ error: "Order already processed" }, { status: 409 })
      }
    }

    const urls = paymentUrls(order_id)

    let payment
    try {
      payment = await createNagorikPayPayment({
        cus_name: paymentOrder.contact.name,
        cus_email: paymentOrder.contact.email,
        amount: formatNagorikPayAmount(paymentOrder.total),
        success_url: urls.success,
        cancel_url: urls.cancel,
        webhook_url: urls.webhook,
        order_id,
        // Never send a null user id or the guest email to the gateway.
        metadata: {
          order_id,
          attempt_id: attemptId,
          ...(user ? { user_id: user.id } : {}),
        },
      })
    } catch (err) {
      // Mark the claimed attempt failed so a retry is possible.
      const serviceClient = createServiceClient()
      await serviceClient.database
        .from("payment_attempts")
        .update({ status: "failed" })
        .eq("id", attemptId)
        .eq("status", "pending")
      throw err
    }

    const gatewayRef = lastPathSegment(payment.payment_url)

    const serviceClient = createServiceClient()
    const updatePayload: Record<string, unknown> = {
      status: "pending",
      payment_url: payment.payment_url,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }
    if (gatewayRef) updatePayload.provider_transaction_id = gatewayRef
    await serviceClient.database
      .from("payment_attempts")
      .update(updatePayload)
      .eq("id", attemptId)

    // Backward-compat: keep orders.payment_reference while unpaid so legacy
    // settlement (no attempt row) can still resolve. Never overwrite on paid.
    if (gatewayRef) {
      await serviceClient.database
        .from("orders")
        .update({ payment_reference: gatewayRef })
        .eq("id", order_id)
        .eq("payment_status", "pending_payment")
    }

    return NextResponse.json({ payment_url: payment.payment_url })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    console.error("[payment] create failed:", err)
    return NextResponse.json({ error: "Payment could not be started. Please try again." }, { status: 502 })
  }
}
