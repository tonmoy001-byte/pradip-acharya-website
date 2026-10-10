// lib/http-errors.ts
// Uniform 500 handler: log the real reason server-side, return a generic
// message to the browser. Database, gateway and SDK error strings can contain
// table names, column names, connection details and stack fragments — none of
// which belong in an HTTP response body.

import { NextResponse } from "next/server"

export function serverError(context: string, err: unknown, init?: { headers?: HeadersInit; status?: number }) {
  console.error(`[${context}]`, err instanceof Error ? err.message : err)
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: init?.status ?? 500, headers: init?.headers },
  )
}