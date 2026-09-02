// app/api/bkash/query-payment/route.ts
// Query bKash payment status for verification.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { queryPayment } from "@/lib/bkash"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    await requireUser()
    const { searchParams } = new URL(req.url)
    const paymentID = searchParams.get("paymentID")

    if (!paymentID) {
      return NextResponse.json({ error: "paymentID required" }, { status: 400 })
    }

    const result = await queryPayment(paymentID)

    return NextResponse.json({
      paymentID: result.paymentID,
      trxID: result.trxID,
      status: result.transactionStatus,
      amount: result.amount,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Query failed" }, { status: 500 })
  }
}
