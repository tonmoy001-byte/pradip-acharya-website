// app/api/bkash/create-payment/route.ts
// Backend creates a bKash payment and returns the paymentID.
// The frontend uses this paymentID to trigger the bKash SDK popup.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createPayment, generateInvoiceNumber } from "@/lib/bkash"
import { createServerClient } from "@/lib/insforge-server"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const body = await req.json()
    const { amount } = body

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    // Generate unique invoice number
    const invoiceNumber = generateInvoiceNumber()

    // Create payment with bKash
    const payment = await createPayment({
      amount: String(amount),
      merchantInvoiceNumber: invoiceNumber,
    })

    // Optionally store the pending payment in the order
    // (the order is created first, then updated after execution)
    if (body.order_id) {
      const client = await createServerClient()
      await client.database
        .from("orders")
        .update({
          payment_method: "bkash",
          bkash_trx_id: payment.paymentID,
        })
        .eq("id", body.order_id)
    }

    return NextResponse.json({
      paymentID: payment.paymentID,
      invoiceNumber: payment.merchantInvoiceNumber,
      amount: payment.amount,
      status: payment.status,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Payment creation failed" }, { status: 500 })
  }
}
