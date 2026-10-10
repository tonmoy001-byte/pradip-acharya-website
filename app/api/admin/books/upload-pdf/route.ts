// app/api/admin/books/upload-pdf/route.ts
// POST: Upload an ebook PDF to the private digital-books bucket.
//
// Validation chain (in order):
//   1. admin only
//   2. same-origin request (CSRF)
//   3. file present, non-empty, under the size cap
//   4. extension is .pdf (allowlist, not the user's extension alone)
//   5. magic bytes: real PDFs start with "%PDF-"
// The storage key is built server-side with crypto.randomUUID(), so the
// user's filename can never influence the path.

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { assertSameOrigin } from "@/lib/origin-check"
import { serverError } from "@/lib/http-errors"

const MAX_PDF_BYTES = 50 * 1024 * 1024 // 50 MiB — adjust to your largest ebook

export async function POST(req: Request) {
  try {
    assertSameOrigin(req)
    await requireAdmin()
    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    if (file.size === 0 || file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "File is empty or too large" }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only .pdf files are allowed" }, { status: 400 })
    }
    // Real PDFs start with the "%PDF-" magic header.
    const head = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer())
    if (head !== "%PDF-") {
      return NextResponse.json({ error: "File is not a valid PDF" }, { status: 400 })
    }

    const client = await createServerClient()
    // Never reuse the user's extension — the extension is validated above.
    const filename = `ebooks/${Date.now()}-${crypto.randomUUID()}.pdf`

    const { error } = await client.storage.from("digital-books").upload(filename, file)
    if (error) {
      console.error("[pdf upload] storage error:", error.message)
      return NextResponse.json({ error: "Upload failed" }, { status: 500 })
    }

    return NextResponse.json({ storageKey: filename })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    return serverError("pdf upload", err)
  }
}