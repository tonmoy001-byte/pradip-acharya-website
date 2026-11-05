// app/api/payment/verify/route.ts
// GET: Verify a NagorikPay payment after the customer redirect.
// Thin wrapper around shared settlement logic.
//
// Anyone may trigger settlement (it re-verifies with the gateway and the
// money only ever unlocks the order's own files), but the response must not
// leak order details to anyone except the order's owner:
//   * signed-in owner  -> user_id must match
//   * guest order      -> the httpOnly `go_<order>` cookie must authorize the
//                         order through the service-only get_guest_order RPC

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getOptionalUser } from "@/lib/auth-helpers"
import { createServiceClient } from "@/lib/insforge-service"
import { verifyNagorikPayPayment } from "@/lib/nagorikpay"
import { settleNagorikPayTransaction } from "@/lib/payment-settlement"
import { sha256hex } from "@/lib/guest-token"
import { revalidatePath } from "next/cache"
import { serverError } from "@/lib/http-errors"

export const dynamic = "force-dynamic"

const GUEST_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

export async function GET(req: Request) {
  try {
    const user = await getOptionalUser()

    const { searchParams } = new URL(req.url)
    const transactionId =
      searchParams.get("transactionId") || searchParams.get("transaction_id")

    if (!transactionId) {
      return NextResponse.json({ error: "transactionId required" }, { status: 400 })
    }

    // Verify with NagorikPay
    let result
    try {
      result = await verifyNagorikPayPayment(transactionId)
    } catch (verifyErr) {
      console.error("NagorikPay verify unavailable:", verifyErr)
      return NextResponse.json(
        { status: "error", error: "verification_unavailable" },
        { status: 502 },
      )
    }

    const client = createServiceClient()
    const orderId =
      (typeof result.metadata?.order_id === "string" && result.metadata.order_id) ||
      searchParams.get("order_id") ||
      undefined

    // Replay guard: a transaction may settle only one order. If another order
    // already claims this payment_reference, reject before touching anything.
    if (orderId) {
      const { data: holder } = await client.database
        .from("orders").select("id").eq("payment_reference", transactionId).limit(1)
      if (holder && holder.length > 0 && holder[0].id !== orderId) {
        console.error("[payment] transaction replay blocked", {
          transactionId,
          order_id: orderId,
          held_by: holder[0].id,
        })
        return NextResponse.json({ error: "Transaction already used" }, { status: 409 })
      }
    }

    const outcome = await settleNagorikPayTransaction({
      client,
      transactionId,
      gateway: result,
      orderId,
    })

    // Only the order's owner (signed-in or guest cookie) may see the result.
    let isGuestOrder = false
    if ("order_id" in outcome) {
      const settledOrderId = outcome.order_id

      if (user) {
        const { data: owner } = await client.database
          .from("orders").select("user_id").eq("id", settledOrderId).limit(1)
        if (owner?.[0]?.user_id !== user.id) {
          return NextResponse.json({ error: "Order not found" }, { status: 404 })
        }
      } else {
        // Only treat as recovery when the order is actually paid.
        const { data: orderRows } = await client.database
          .from("orders")
          .select("payment_status")
          .eq("id", settledOrderId)
          .limit(1)
        const isPaid = orderRows?.[0]?.payment_status === "paid"

        const token = (await cookies()).get(`go_${settledOrderId}`)?.value
        if (!token || !GUEST_TOKEN_RE.test(token)) {
          if (isPaid) {
            return NextResponse.json(
              { status: "paid", order_id: settledOrderId, guest: true, recovery: true, download_ready: false },
              { status: 200 },
            )
          }
          return NextResponse.json({ error: "Order not found" }, { status: 404 })
        }
        const { data: guestOrder, error: guestError } = await client.database.rpc(
          "get_guest_order",
          { p_order_id: settledOrderId, p_token_hash: sha256hex(token) },
        )
        if (guestError || !guestOrder) {
          if (isPaid) {
            return NextResponse.json(
              { status: "paid", order_id: settledOrderId, guest: true, recovery: true, download_ready: false },
              { status: 200 },
            )
          }
          return NextResponse.json({ error: "Order not found" }, { status: 404 })
        }
        isGuestOrder = true
      }
    }

    // Map SettleOutcome to HTTP response
    switch (outcome.kind) {
      case "paid":
        try { revalidatePath("/account/orders") } catch {}
        try { revalidatePath("/account") } catch {}
        try { revalidatePath("/my-downloads") } catch {}
        return NextResponse.json({
          status: "paid",
          order_id: outcome.order_id,
          download_ready: outcome.download_ready,
          guest: isGuestOrder,
        })
      case "pending":
        return NextResponse.json({ status: "pending", order_id: outcome.order_id, guest: isGuestOrder })
      case "failed":
        return NextResponse.json({ status: "failed", order_id: outcome.order_id, guest: isGuestOrder })
      case "duplicate":
        return NextResponse.json({ status: "duplicate_payment", order_id: outcome.order_id, guest: isGuestOrder })
      case "amount_mismatch":
        return NextResponse.json({ error: "Payment amount does not match order total" }, { status: 400 })
      case "not_found":
        return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
  } catch (err: unknown) {
    if (err instanceof Response) return err
    return serverError("payment verify", err)
  }
}
