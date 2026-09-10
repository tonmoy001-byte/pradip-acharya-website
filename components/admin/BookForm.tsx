"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { resolveCoverImage } from "@/lib/api"

interface BookFormatInput {
  name: string
  price: string
  compareAtPrice: string
  delivery_type: string
  available: boolean
}

interface BookFormProps {
  initial?: {
    id?: string
    title: string
    author: string
    category: string
    subcategory: string
    subcategory_slug: string
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
    formats: BookFormatInput[]
  }
  mode: "create" | "edit"
}

const DEFAULT_FORMATS: BookFormatInput[] = [
  { name: "Paperback", price: "", compareAtPrice: "", delivery_type: "physical", available: true },
]

export default function BookForm({ initial, mode }: BookFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [title, setTitle] = useState(initial?.title || "")
  const [author, setAuthor] = useState(initial?.author || "প্রদীপ কুমার আচার্য্য")
  const [category, setCategory] = useState(initial?.category || "novels")
  const [subcategory, setSubcategory] = useState(initial?.subcategory || "")
  const [subcategorySlug, setSubcategorySlug] = useState(initial?.subcategory_slug || "")
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
  const [formats, setFormats] = useState<BookFormatInput[]>(
    initial?.formats || DEFAULT_FORMATS
  )
  const [uploading, setUploading] = useState(false)

  const addFormat = () => {
    setFormats((prev) => [
      ...prev,
      { name: "", price: "", compareAtPrice: "", delivery_type: "physical", available: true },
    ])
  }

  const updateFormat = (i: number, field: keyof BookFormatInput, value: any) => {
    setFormats((prev) => prev.map((f, idx) => (idx === i ? { ...f, [field]: value } : f)))
  }

  const removeFormat = (i: number) => {
    setFormats((prev) => prev.filter((_, idx) => idx !== i))
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "books")
      const res = await fetch("/api/admin/books/upload", { method: "POST", body: fd })
      const d = await res.json()
      if (d.path) {
        setCoverPrimary(d.path)
      }
    } catch {}
    setUploading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)

    try {
      const payload = {
        title,
        author,
        category,
        subcategory,
        subcategory_slug: subcategorySlug,
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
        formats: formats
          .filter((f) => f.name && f.price)
          .map((f) => ({
            name: f.name,
            price: parseFloat(f.price) || 0,
            compareAtPrice: f.compareAtPrice || null,
            delivery_type: f.delivery_type,
            available: f.available,
          })),
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
          <label className="admin-label">ক্যাটাগরি *</label>
          <select className="admin-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="novels">উপন্যাস</option>
            <option value="books">বই</option>
          </select>
        </div>

        <div className="admin-form-group">
          <label className="admin-label">সাবক্যাটাগরি</label>
          <input className="admin-input" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="যেমন: সমসাময়িক" />
        </div>

        <div className="admin-form-group">
          <label className="admin-label">সাবক্যাটাগরি স্লাগ</label>
          <input className="admin-input" value={subcategorySlug} onChange={(e) => setSubcategorySlug(e.target.value)} placeholder="যেমন: contemporary" />
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
                <Image
                  src={resolveCoverImage(coverPrimary)}
                  alt="Cover"
                  fill
                  style={{ objectFit: "cover", borderRadius: 4 }}
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

        {/* Formats */}
        <div className="admin-form-group admin-form-span-2">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-3)" }}>
            <label className="admin-label" style={{ marginBottom: 0 }}>ফরম্যাট</label>
            <button type="button" className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={addFormat}>
              + ফরম্যাট যোগ করুন
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            {formats.map((fmt, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 120px 40px", gap: "var(--sp-2)", alignItems: "end" }}>
                <div>
                  <label className="admin-label" style={{ fontSize: "0.75rem" }}>নাম</label>
                  <input className="admin-input" value={fmt.name} onChange={(e) => updateFormat(i, "name", e.target.value)} placeholder="Paperback" />
                </div>
                <div>
                  <label className="admin-label" style={{ fontSize: "0.75rem" }}>মূল্য (৳)</label>
                  <input className="admin-input" type="number" value={fmt.price} onChange={(e) => updateFormat(i, "price", e.target.value)} />
                </div>
                <div>
                  <label className="admin-label" style={{ fontSize: "0.75rem" }}>তুলনামূল্য (৳)</label>
                  <input className="admin-input" type="number" value={fmt.compareAtPrice} onChange={(e) => updateFormat(i, "compareAtPrice", e.target.value)} />
                </div>
                <div>
                  <label className="admin-label" style={{ fontSize: "0.75rem" }}>ডেলিভারি</label>
                  <select className="admin-select" value={fmt.delivery_type} onChange={(e) => updateFormat(i, "delivery_type", e.target.value)}>
                    <option value="physical">ফিজিক্যাল</option>
                    <option value="digital">ডিজিটাল</option>
                  </select>
                </div>
                <div style={{ paddingBottom: 4 }}>
                  {formats.length > 1 && (
                    <button type="button" className="btn btn-danger" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => removeFormat(i)}>
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
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
