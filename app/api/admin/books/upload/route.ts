// app/api/admin/books/upload/route.ts
// POST: Upload a cover image (or PDF) to the book-covers bucket.
//
// Validation chain: admin only, same-origin, file present, non-empty, size cap,
// extension allowlist, and magic-byte sniffing (PNG / JPEG / WebP / PDF).
// The storage key is built server-side with crypto.randomUUID(), so the user's
// filename can never influence the path.

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { assertSameOrigin } from "@/lib/origin-check"
import { serverError } from "@/lib/http-errors"

const ALLOWED_FOLDERS = ["books", "covers", "posts", "avatars"] as const
const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "pdf"] as const
const MAX_BYTES = 10 * 1024 * 1024 // 10 MiB

function sniffFile(head: Uint8Array): boolean {
  // PNG
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return true
  // JPEG
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return true
  // WebP: "RIFF" .... "WEBP"
  if (
    head.length >= 12 &&
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
  ) {
    return true
  }
  // PDF: "%PDF-"
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d) {
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
    const folder = (formData.get("folder") as string) || "books"

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    if (!(ALLOWED_FOLDERS as readonly string[]).includes(folder)) {
      return NextResponse.json({ error: "Invalid folder" }, { status: 400 })
    }
    if (file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File is empty or too large (max 10MB)" }, { status: 400 })
    }

    const ext = (file.name.split(".").pop() || "").toLowerCase()
    if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
      return NextResponse.json(
        { error: `File type not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 },
      )
    }

    // Sniff enough bytes to cover every format we allow.
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
    if (!sniffFile(head)) {
      return NextResponse.json({ error: "File is not a valid image or PDF" }, { status: 400 })
    }

    const client = await createServerClient()
    const filename = `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`

    const { error } = await client.storage.from("book-covers").upload(filename, file)
    if (error) {
      console.error("[books upload] storage error:", error.message)
      return NextResponse.json({ error: "Upload failed" }, { status: 500 })
    }

    return NextResponse.json({ path: filename })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    return serverError("books upload", err)
  }
}