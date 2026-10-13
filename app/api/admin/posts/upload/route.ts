// app/api/admin/posts/upload/route.ts
// POST: Upload a blog post cover image to the book-covers bucket.
//
// Validation chain: admin only, same-origin, file present, extension allowlist,
// size cap, and magic-byte sniffing (PNG / JPEG / WebP). The storage key is
// built server-side with crypto.randomUUID(), so the user's filename can never
// influence the path.

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { assertSameOrigin } from "@/lib/origin-check"
import { serverError } from "@/lib/http-errors"

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MiB
const ALLOWED_IMAGE_EXTS = ["png", "jpg", "jpeg", "webp"] as const

function sniffImage(head: Uint8Array): boolean {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return true
  // JPEG: FF D8 FF
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return true
  // WebP: "RIFF" .... "WEBP"
  if (
    head.length >= 12 &&
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
  ) {
    return true
  }
  return false
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req)
    await requireAdmin()
    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "File is empty or too large" }, { status: 400 })
    }

    const ext = (file.name.split(".").pop() || "").toLowerCase()
    if (!(ALLOWED_IMAGE_EXTS as readonly string[]).includes(ext)) {
      return NextResponse.json(
        { error: `Image type not allowed. Allowed: ${ALLOWED_IMAGE_EXTS.join(", ")}` },
        { status: 400 },
      )
    }

    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
    if (!sniffImage(head)) {
      return NextResponse.json({ error: "File is not a valid image" }, { status: 400 })
    }

    const client = await createServerClient()
    const filename = `posts/${Date.now()}-${crypto.randomUUID()}.${ext}`

    const { error } = await client.storage.from("book-covers").upload(filename, file)
    if (error) {
      console.error("[posts upload] storage error:", error.message)
      return NextResponse.json({ error: "Upload failed" }, { status: 500 })
    }

    return NextResponse.json({ path: filename })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    return serverError("posts upload", err)
  }
}