import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

const ALLOWED_FOLDERS = ["books", "covers", "posts", "avatars"] as const
const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "pdf"] as const

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const folder = (formData.get("folder") as string) || "books"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Allowlist folder to prevent path traversal
    if (!(ALLOWED_FOLDERS as readonly string[]).includes(folder)) {
      return NextResponse.json({ error: "Invalid folder" }, { status: 400 })
    }

    // Allowlist file extension
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
      return NextResponse.json(
        { error: `File type not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 },
      )
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 })
    }

    const client = await createServerClient()
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error } = await client.storage
      .from("book-covers")
      .upload(filename, file)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ path: filename })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
