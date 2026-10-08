"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { resolveCoverImage } from "@/lib/api"
import { EBOOK_FORMAT_NAME, EBOOK_DELIVERY_TYPE, BOOK_CATEGORY, BOOK_CATEGORY_LABEL } from "@/lib/data"

interface BookFormProps {
  initial?: {
    id?: string
    title: string
    author: string
    description: string
    synopsis: string
    cover_primary: string | null
    cover_hover: string | null
    featured: boolean
    is_new: boolean
    trending: boolean
    is_demo: boolean
    publication_date: string | null
    publisher: string | null
    isbn: string | null
    pages: number | null
    language: string | null
    price: string
    compareAtPrice: string
    available: boolean
    storageKey: string | null
  }
  mode: "create" | "edit"
}

export default function BookForm({ initial, mode }: BookFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [title, setTitle] = useState(initial?.title || "")
  const [author, setAuthor] = useState(initial?.author || "প্রদীপ কুমার আচার্য্য")
  const [description, setDescription] = useState(initial?.description || "")
  const [synopsis, setSynopsis] = useState(initial?.synopsis || "")
  const [coverPrimary, setCoverPrimary] = useState(initial?.cover_primary || "")
  const [coverHover, setCoverHover] = useState(initial?.cover_hover || "")
  const [featured, setFeatured] = useState(initial?.featured || false)
  const [isNew, setIsNew] = useState(initial?.is_new || false)
  const [trending, setTrending] = useState(initial?.trending || false)
  const [isDemo, setIsDemo] = useState(initial?.is_demo || false)
  const [publicationDate, setPublicationDate] = useState(initial?.publication_date || "")
  const [publisher, setPublisher] = useState(initial?.publisher || "")
  const [isbn, setIsbn] = useState(initial?.isbn || "")
  const [pages, setPages] = useState(initial?.pages || "")
  const [language, setLanguage] = useState(initial?.language || "Bengali")

  // The ebook is the only product: one price, one availability flag, one PDF.
  const [price, setPrice] = useState(initial?.price || "")
  const [compareAtPrice, setCompareAtPrice] = useState(initial?.compareAtPrice || "")
  const [available, setAvailable] = useState(initial?.available ?? true)
  const [storageKey, setStorageKey] = useState<string | null>(initial?.storageKey ?? null)

  const [uploading, setUploading] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [uploadError, setUploadError] = useState("")

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "books")
      const res = await fetch("/api/admin/books/upload", { method: "POST", body: fd })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.path) {
        setUploadError(d.error || `Upload failed (${res.status})`)
        return
      }
      setCoverPrimary(d.path)
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const [uploadingHover, setUploadingHover] = useState(false)

  const handleCoverHoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingHover(true)
    setUploadError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "books")
      const res = await fetch("/api/admin/books/upload", { method: "POST", body: fd })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.path) {
        setUploadError(d.error || `Upload failed (${res.status})`)
        return
      }
      setCoverHover(d.path)
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed")
    } finally {
      setUploadingHover(false)
    }
  }

  const handleEbookUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPdf(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/books/upload-pdf", { method: "POST", body: fd })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || "ইবুক আপলোড ব্যর্থ")
      if (d.storageKey) setStorageKey(d.storageKey)
    } catch (err: any) {
      setUploadError(err?.message || "ইবুক আপলোড ব্যর্থ")
    } finally {
      setUploadingPdf(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setUploadError("")

    if (!price || Number.isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      setError("ইবুকের মূল্য আবশ্যক")
      return
    }

    setSaving(true)

    try {
      const payload = {
        title,
        author,
        // Single-category store: the taxonomy is fixed, not operator-chosen.
        category: BOOK_CATEGORY,
        subcategory: BOOK_CATEGORY_LABEL,
        subcategory_slug: BOOK_CATEGORY,
        description,
        synopsis,
        cover_primary: coverPrimary || null,
        cover_hover: coverHover || null,
        featured,
        is_new: isNew,
        trending,
        is_demo: isDemo,
        publication_date: publicationDate || null,
        publisher: publisher || null,
        isbn: isbn || null,
        pages: pages ? parseInt(String(pages)) || null : null,
        language: language || null,
        // Ebook-only: exactly one digital format.
        formats: [
          {
            name: EBOOK_FORMAT_NAME,
            price: parseFloat(price) || 0,
            compareAtPrice: compareAtPrice || null,
            delivery_type: EBOOK_DELIVERY_TYPE,
            available,
          },
        ],
      }

      const url = mode === "create"
        ? "/api/admin/books"
        : `/api/admin/books/${initial?.id}`
      const method = mode === "create" ? "POST" : "PUT"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Failed to save")
      }

      const result = await res.json()
      const bookId = result.book_id || initial?.id

      // Attach the uploaded PDF to the book's ebook format
      if (bookId && storageKey) {
        const assetRes = await fetch(`/api/admin/books/${bookId}/digital-assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ formatName: EBOOK_FORMAT_NAME, storageKey }),
        })
        if (!assetRes.ok) {
          const assetData = await assetRes.json().catch(() => ({}))
          throw new Error(assetData.error || "ইবুক ফাইল সংরক্ষণ ব্যর্থ")
        }
      }

      router.push("/admin/books")
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Failed to save book")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      {error && <div className="admin-alert admin-alert-error">{error}</div>}
      {uploadError && <div className="admin-alert admin-alert-error">{uploadError}</div>}

      <div className="admin-form-grid">
        <div className="admin-form-group admin-form-span-2">
          <label className="admin-label">বইয়ের নাম *</label>
          <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div className="admin-form-group">
          <label className="admin-label">লেখক *</label>
          <input className="admin-input" value={author} onChange={(e) => setAuthor(e.target.value)} required />
        </div>

        <div className="admin-form-group">
          <label className="admin-label">ধরন</label>
          <input
            className="admin-input"
            value={`${BOOK_CATEGORY_LABEL} (${BOOK_CATEGORY})`}
            readOnly
            disabled
          />
          <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: 4 }}>
            এই সাইটে একটিই বই-ধরন আছে।
          </p>
        </div>

        <div className="admin-form-group admin-form-span-2">
          <label className="admin-label">বিবরণ</label>
          <textarea className="admin-input admin-textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>

        <div className="admin-form-group admin-form-span-2">
          <label className="admin-label">সিনোপসিস</label>
          <textarea className="admin-input admin-textarea" value={synopsis} onChange={(e) => setSynopsis(e.target.value)} rows={4} />
        </div>

        {/* Publication Details */}
        <div className="admin-form-group admin-form-span-2">
          <label className="admin-label">প্রকাশনার তথ্য</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--sp-3)" }}>
            <div>
              <label className="admin-label" style={{ fontSize: "0.75rem" }}>প্রকাশনার তারিখ</label>
              <input className="admin-input" type="date" value={publicationDate} onChange={(e) => setPublicationDate(e.target.value)} />
            </div>
            <div>
              <label className="admin-label" style={{ fontSize: "0.75rem" }}>প্রকাশক</label>
              <input className="admin-input" value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="যেমন: প্রথমা প্রকাশনী" />
            </div>
            <div>
              <label className="admin-label" style={{ fontSize: "0.75rem" }}>ভাষা</label>
              <input className="admin-input" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Bengali" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)", marginTop: "var(--sp-3)" }}>
            <div>
              <label className="admin-label" style={{ fontSize: "0.75rem" }}>ISBN</label>
              <input className="admin-input" value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="978-..." />
            </div>
            <div>
              <label className="admin-label" style={{ fontSize: "0.75rem" }}>পৃষ্ঠা সংখ্যা</label>
              <input className="admin-input" type="number" value={pages} onChange={(e) => setPages(e.target.value)} placeholder="যেমন: 320" />
            </div>
          </div>
        </div>

        {/* Cover Image */}
        <div className="admin-form-group admin-form-span-2">
          <label className="admin-label">কভার ইমেজ</label>
          <div style={{ display: "flex", gap: "var(--sp-4)", alignItems: "flex-start" }}>
            {coverPrimary && (
              <div style={{ position: "relative", width: 120, height: 160 }}>
                <img
                  src={resolveCoverImage(coverPrimary)}
                  alt="Cover"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: 4 }}
                />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <input type="file" accept="image/*" onChange={handleCoverUpload} className="admin-input" />
              {uploading && <p style={{ color: "var(--ink-muted)", fontSize: "0.8125rem", marginTop: "var(--sp-2)" }}>আপলোড হচ্ছে...</p>}
              <div style={{ marginTop: "var(--sp-2)" }}>
                <label className="admin-label" style={{ fontSize: "0.8125rem" }}>অথবা URL:</label>
                <input className="admin-input" value={coverPrimary} onChange={(e) => setCoverPrimary(e.target.value)} placeholder="/images/books/..." />
              </div>
            </div>
          </div>
        </div>

        {/* Cover Hover Image */}
        <div className="admin-form-group admin-form-span-2">
          <label className="admin-label">কভার হোভার ইমেজ (ঐচ্ছিক)</label>
          <div style={{ display: "flex", gap: "var(--sp-4)", alignItems: "flex-start" }}>
            {coverHover && (
              <div style={{ position: "relative", width: 120, height: 160 }}>
                <img
                  src={resolveCoverImage(coverHover)}
                  alt="Cover Hover"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: 4 }}
                />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <input type="file" accept="image/*" onChange={handleCoverHoverUpload} className="admin-input" />
              {uploadingHover && <p style={{ color: "var(--ink-muted)", fontSize: "0.8125rem", marginTop: "var(--sp-2)" }}>আপলোড হচ্ছে...</p>}
              <div style={{ marginTop: "var(--sp-2)" }}>
                <label className="admin-label" style={{ fontSize: "0.8125rem" }}>অথবা URL:</label>
                <input className="admin-input" value={coverHover} onChange={(e) => setCoverHover(e.target.value)} placeholder="/images/books/..." />
              </div>
            </div>
          </div>
        </div>

        {/* Flags */}
        <div className="admin-form-group admin-form-span-2">
          <label className="admin-label">বৈশিষ্ট্য</label>
          <div style={{ display: "flex", gap: "var(--sp-5)", flexWrap: "wrap" }}>
            <label className="admin-checkbox-label">
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
              <span>বৈশিষ্ট্যযুক্ত</span>
            </label>
            <label className="admin-checkbox-label">
              <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} />
              <span>নতুন</span>
            </label>
            <label className="admin-checkbox-label">
              <input type="checkbox" checked={trending} onChange={(e) => setTrending(e.target.checked)} />
              <span>ট্রেন্ডিং</span>
            </label>
            <label className="admin-checkbox-label">
              <input type="checkbox" checked={isDemo} onChange={(e) => setIsDemo(e.target.checked)} />
              <span>ডেমো</span>
            </label>
          </div>
        </div>

        {/* Ebook product — the only format this store sells */}
        <div className="admin-form-group admin-form-span-2">
          <label className="admin-label" style={{ marginBottom: "var(--sp-3)" }}>ইবুক (ডিজিটাল PDF)</label>
          <div style={{ display: "grid", gridTemplateColumns: "160px 160px 120px", gap: "var(--sp-3)", alignItems: "end" }}>
            <div>
              <label className="admin-label" style={{ fontSize: "0.75rem" }}>মূল্য (৳) *</label>
              <input className="admin-input" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <label className="admin-label" style={{ fontSize: "0.75rem" }}>তুলনামূল্য (৳)</label>
              <input className="admin-input" type="number" min="0" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} />
            </div>
            <div>
              <label className="admin-label" style={{ fontSize: "0.75rem" }}>বিক্রয় চালু</label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", height: 36 }}>
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                />
              </label>
            </div>
          </div>

          <div style={{ marginTop: "var(--sp-3)", padding: "var(--sp-3)", background: "var(--bg-secondary, #f5f5f5)", borderRadius: 6 }}>
            <label className="admin-label" style={{ fontSize: "0.75rem", marginBottom: "var(--sp-1)", display: "block" }}>ইবুক PDF ফাইল</label>
            {storageKey && (
              <p style={{ fontSize: "0.8125rem", color: "var(--ink-muted)", marginBottom: "var(--sp-2)" }}>
                বর্তমান ফাইল: {storageKey.split("/").pop()}
              </p>
            )}
            <input
              type="file"
              accept=".pdf"
              onChange={handleEbookUpload}
              className="admin-input"
              disabled={uploadingPdf}
            />
            {uploadingPdf && (
              <p style={{ color: "var(--ink-muted)", fontSize: "0.75rem", marginTop: "var(--sp-1)" }}>আপলোড হচ্ছে...</p>
            )}
            <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: "var(--sp-2)" }}>
              PDF ফাইলটি ব্যক্তিগত স্টোরেজে সংরক্ষিত থাকে এবং শুধু অনুমোদিত গ্রাহকরা ডাউনলোড করতে পারেন।
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-6)" }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "সেভ হচ্ছে..." : mode === "create" ? "বই তৈরি করুন" : "আপডেট করুন"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
          বাতিল
        </button>
      </div>
    </form>
  )
}
