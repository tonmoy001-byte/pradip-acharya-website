// app/api/bkash/execute-payment/route.ts
// Backend executes a bKash payment after customer PIN verification.
// On success, updates the order payment_status to "paid" and stores the trxID.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { executePayment } from "@/lib/bkash"
import { createServerClient } from "@/lib/insforge-server"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const body = await req.json()
    const { paymentID, orderId } = body

    if (!paymentID) {
      return NextResponse.json({ error: "paymentID required" }, { status: 400 })
    }

    // Execute the payment with bKash
    const result = await executePayment(paymentID)

    // Update order if orderId is provided
    if (orderId) {
      const client = await createServerClient()
      const updateData: Record<string, any> = {
        payment_method: "bkash",
      }

      if (result.transactionStatus === "Completed" && result.trxID) {
        updateData.payment_status = "paid"
        updateData.bkash_trx_id = result.trxID
      } else {
        updateData.payment_status = "failed"
      }

      await client.database
        .from("orders")
        .update(updateData)
        .eq("id", orderId)
    }

    return NextResponse.json({
      paymentID: result.paymentID,
      trxID: result.trxID,
      status: result.transactionStatus,
      amount: result.amount,
      executedAt: result.paymentExecuteTime,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Payment execution failed" }, { status: 500 })
  }
}
