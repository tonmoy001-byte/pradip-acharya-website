import { NextResponse } from "next/server"

export async function GET() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_INSFORGE_URL || "https://cpd9mnqf.ap-southeast.insforge.app"}/rest/v1/rpc/get_site_settings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || "",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || ""}`,
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
