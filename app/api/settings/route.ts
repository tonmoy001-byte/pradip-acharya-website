import { NextResponse } from "next/server"

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!
    const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!
    const res = await fetch(
      `${baseUrl}/rest/v1/rpc/get_site_settings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: "{}",
      }
    )
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({})
  }
}
