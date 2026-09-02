// app/api/bkash/config/route.ts
// Returns the bKash app key and SDK script URL for the frontend.
// Credentials stay server-side — only the non-sensitive app key goes to client.

import { NextResponse } from "next/server"
import { getAppKey, getBkashEnv, BKASH_SCRIPT_URL } from "@/lib/bkash"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json({
      appKey: getAppKey(),
      env: getBkashEnv(),
      scriptUrl: BKASH_SCRIPT_URL,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
