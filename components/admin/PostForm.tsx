"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { resolveCoverImage } from "@/lib/api"

interface PostFormProps {
  initial?: {
    id?: string
    title: string
    slug: string
    content: string
    excerpt: string
    cover_image: string | null
    post_type: string
    status: string
    tags: string[]
    meta_title: string
    meta_description: string
    author_name: string | null
  }
  mode: "create" | "edit"
}

export default function PostForm({ initial, mode }: PostFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [title, setTitle] = useState(initial?.title || "")
  const [slug, setSlug] = useState(initial?.slug || "")
  const [content, setContent] = useState(initial?.content || "")
  const [excerpt, setExcerpt] = useState(initial?.excerpt || "")
  const [coverImage, setCoverImage] = useState(initial?.cover_image || "")
  const [postType, setPostType] = useState(initial?.post_type || "blog")
  const [status, setStatus] = useState(initial?.status || "draft")
  const [tagsInput, setTagsInput] = useState((initial?.tags || []).join(", "))
  const [metaTitle, setMetaTitle] = useState(initial?.meta_title || "")
  const [metaDescription, setMetaDescription] = useState(initial?.meta_description || "")
  const [authorName, setAuthorName] = useState(initial?.author_name || "প্রদীপ কুমার আচার্য্য")
  const [uploading, setUploading] = useState(false)

  const autoSlug = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80)

  const handleTitleChange = (v: string) => {
    setTitle(v)
    if (mode === "create" && !slug) {
      setSlug(autoSlug(v))
    }
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/posts/upload", { method: "POST", body: fd })
      const d = await res.json()
      if (d.path) {
        setCoverImage(d.path)
      }
    } catch {}
    setUploading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)

    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)

      const payload = {
        title,
        slug,
        content,
        excerpt: excerpt || null,
        cover_image: coverImage || null,
        post_type: postType,
        status,
        tags,
        meta_title: metaTitle || null,
        meta_description: metaDescription || null,
        author_name: authorName || null,
      }

      const url = mode === "create"
        ? "/api/admin/posts"
        : `/api/admin/posts/${initial?.id}`
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

      router.push("/admin/posts")
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Failed to save post")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      <div className="admin-form-grid">
        <div className="admin-form-group admin-form-span-2">
          <label className="admin-label">শিরোনাম *</label>
          <input className="admin-input" value={title} onChange={(e) => handleTitleChange(e.target.value)} required />
        </div>

        <div className="admin-form-group admin-form-span-2">
          <label className="admin-label">স্লাগ *</label>
          <input className="admin-input" value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="auto-generated-from-title" />
        </div>

        <div className="admin-form-group">
          <label className="admin-label">ধরন</label>
          <select className="admin-select" value={postType} onChange={(e) => setPostType(e.target.value)}>
            <option value="blog">ব্লগ</option>
            <option value="page">পেজ</option>
          </select>
        </div>

        <div className="admin-form-group">
          <label className="admin-label">স্ট্যাটাস</label>
          <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">ড্রাফট</option>
            <option value="published">প্রকাশিত</option>
            <option value="archived">আর্কাইভ</option>
          </select>
        </div>

        <div className="admin-form-group admin-form-span-2">
          <label className="admin-label">লেখকের নাম</label>
          <input className="admin-input" value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="প্রদীপ কুমার আচার্য্য" />
        </div>

        <div className="admin-form-group admin-form-span-2">
          <label className="admin-label">সারসংক্ষেপ</label>
          <textarea className="admin-input admin-textarea" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} />
        </div>

        <div className="admin-form-group admin-form-span-2">
          <label className="admin-label">বিষয়বস্তু *</label>
          <textarea className="admin-input admin-textarea" value={content} onChange={(e) => setContent(e.target.value)} rows={12} required />
        </div>

        {/* Cover Image */}
        <div className="admin-form-group admin-form-span-2">
          <label className="admin-label">কভার ইমেজ</label>
          <div style={{ display: "flex", gap: "var(--sp-4)", alignItems: "flex-start" }}>
            {coverImage && (
              <div style={{ position: "relative", width: 160, height: 90 }}>
                <img
                  src={resolveCoverImage(coverImage)}
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
                <input className="admin-input" value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="/images/..." />
              </div>
            </div>
          </div>
        </div>

        <div className="admin-form-group admin-form-span-2">
          <label className="admin-label">ট্যাগ (কমা দিয়ে আলাদা করুন)</label>
          <input className="admin-input" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="সাহিত্য, উপন্যাস, বই" />
        </div>

        <div className="admin-form-group admin-form-span-2">
          <label className="admin-label">SEO শিরোনাম</label>
          <input className="admin-input" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} />
        </div>

        <div className="admin-form-group admin-form-span-2">
          <label className="admin-label">SEO বিবরণ</label>
          <textarea className="admin-input admin-textarea" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} />
        </div>
      </div>

      <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-6)" }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "সেভ হচ্ছে..." : mode === "create" ? "পোস্ট তৈরি করুন" : "আপডেট করুন"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
          বাতিল
        </button>
      </div>
    </form>
  )
}
