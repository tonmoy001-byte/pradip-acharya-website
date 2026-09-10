import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const client = await createServerClient()
    const ext = file.name.split(".").pop() || "pdf"
    const filename = `ebooks/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error } = await client.storage
      .from("digital-books")
      .upload(filename, file)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ storageKey: filename })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
