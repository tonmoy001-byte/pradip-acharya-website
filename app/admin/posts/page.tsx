"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Post {
  id: string
  title: string
  slug: string
  post_type: string
  status: string
  cover_image: string | null
  published_at: string | null
  created_at: string
}

const POST_TYPE_LABELS: Record<string, string> = {
  blog: "ব্লগ",
  page: "পেজ",
}

const STATUS_LABELS: Record<string, string> = {
  draft: "ড্রাফট",
  published: "প্রকাশিত",
  archived: "আর্কাইভ",
}

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteTitle, setDeleteTitle] = useState("")
  const router = useRouter()

  const fetchPosts = () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (statusFilter) params.set("status", statusFilter)
    if (typeFilter) params.set("post_type", typeFilter)

    fetch(`/api/admin/posts?${params}`)
      .then((r) => r.json())
      .then((d) => setPosts(d.posts || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPosts()
  }, [search, statusFilter, typeFilter])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/admin/posts/${deleteId}`, { method: "DELETE" })
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== deleteId))
        setDeleteId(null)
        setDeleteTitle("")
      }
    } catch {}
  }

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("bn-BD", { year: "numeric", month: "short", day: "numeric" }) : "—"

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="admin-page-title">পোস্ট ম্যানেজমেন্ট</h1>
            <p className="admin-page-subtitle">{posts.length} টি পোস্ট</p>
          </div>
          <Link href="/admin/posts/new" className="btn btn-primary">
            + নতুন পোস্ট
          </Link>
        </div>
      </div>

      <div className="admin-filters">
        <input
          type="text"
          className="admin-input"
          placeholder="পোস্ট খুঁজুন..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">সব স্ট্যাটাস</option>
          <option value="draft">ড্রাফট</option>
          <option value="published">প্রকাশিত</option>
          <option value="archived">আর্কাইভ</option>
        </select>
        <select className="admin-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">সব ধরন</option>
          <option value="blog">ব্লগ</option>
          <option value="page">পেজ</option>
        </select>
      </div>

      {loading ? (
        <p style={{ color: "var(--ink-muted)" }}>লোড হচ্ছে...</p>
      ) : posts.length === 0 ? (
        <div className="admin-empty">
          <p>কোনো পোস্ট পাওয়া যায়নি</p>
          <Link href="/admin/posts/new" className="btn btn-primary" style={{ marginTop: "var(--sp-4)" }}>
            প্রথম পোস্ট লিখুন
          </Link>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>শিরোনাম</th>
                <th>ধরন</th>
                <th>স্ট্যাটাস</th>
                <th>প্রকাশিত</th>
                <th>তৈরি</th>
                <th>কাজ</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td style={{ fontWeight: 500 }}>{post.title}</td>
                  <td>
                    <span className={`admin-badge ${post.post_type === "blog" ? "admin-badge-published" : "admin-badge-admin"}`}>
                      {POST_TYPE_LABELS[post.post_type] || post.post_type}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge ${post.status === "published" ? "admin-badge-published" : "admin-badge-draft"}`}>
                      {STATUS_LABELS[post.status] || post.status}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.8125rem" }}>{formatDate(post.published_at)}</td>
                  <td style={{ fontSize: "0.8125rem" }}>{formatDate(post.created_at)}</td>
                  <td>
                    <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                      <button className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => router.push(`/admin/posts/${post.id}/edit`)}>
                        এডিট
                      </button>
                      <button className="btn btn-danger" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => { setDeleteId(post.id); setDeleteTitle(post.title) }}>
                        ডিলিট
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteId && (
        <div className="admin-modal-backdrop" onClick={() => setDeleteId(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--sp-4)" }}>পোস্ট ডিলিট করুন?</h3>
            <p style={{ color: "var(--ink-muted)", marginBottom: "var(--sp-5)", fontSize: "0.875rem" }}>
              &ldquo;{deleteTitle}&rdquo; মুছে ফেলা হবে। এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।
            </p>
            <div style={{ display: "flex", gap: "var(--sp-3)", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>বাতিল</button>
              <button className="btn btn-danger" onClick={handleDelete}>ডিলিট</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
