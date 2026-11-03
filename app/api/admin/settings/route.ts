import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { invalidateSettings } from "@/lib/public-cache"
import { serverError } from "@/lib/http-errors"
import { assertSameOrigin } from "@/lib/origin-check"

export async function GET() {
  try {
    await requireAdmin()
    const client = await createServerClient()

    const { data, error } = await client.database
      .from("site_settings")
      .select("*")
      .order("category", { ascending: true })

    if (error) {
      console.error("[admin settings] list failed:", error.message)
      return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
    }

    return NextResponse.json({ settings: data || [] })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    return serverError("admin settings GET", err)
  }
}

export async function PUT(req: Request) {
  try {
    assertSameOrigin(req)
    await requireAdmin()
    const body = await req.json()
    const client = await createServerClient()

    const failed: string[] = []
    for (const [key, entry] of Object.entries(body.settings || {})) {
      const setting = entry as { value: unknown; category?: string }
      const { error } = await client.database.rpc("admin_upsert_setting", {
        p_key: key,
        p_value: setting.value,
        p_category: setting.category || "general",
      })
      if (error) {
        console.error("[settings] save failed:", key, error.message)
        failed.push(key)
      }
    }

    invalidateSettings()
    if (failed.length) {
      return NextResponse.json(
        { error: "Some settings could not be saved", failed },
        { status: 207 },
      )
    }
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    return serverError("admin settings PUT", err)
  }
}
