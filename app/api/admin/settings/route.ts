import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { invalidateSettings } from "@/lib/public-cache"

export async function GET() {
  try {
    await requireAdmin()
    const client = await createServerClient()

    const { data, error } = await client.database
      .from("site_settings")
      .select("*")
      .order("category", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settings: data || [] })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    await requireAdmin()
    const body = await req.json()
    const client = await createServerClient()

    for (const [key, entry] of Object.entries(body.settings || {})) {
      const setting = entry as { value: any; category: string }
      const { error } = await client.database.rpc("admin_upsert_setting", {
        p_key: key,
        p_value: setting.value,
        p_category: setting.category || "general",
      })
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    invalidateSettings()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
