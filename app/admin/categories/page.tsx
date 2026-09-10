"use client"

import { useEffect, useState } from "react"

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  parent_id: string | null
  sort_order: number
  created_at: string
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [sortOrder, setSortOrder] = useState("0")

  const fetchCategories = () => {
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => setError("ক্যাটাগরি লোড করা যায়নি"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCategories() }, [])

  const autoSlug = (t: string) =>
    t.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 50)

  const openCreate = () => {
    setEditId(null)
    setName("")
    setSlug("")
    setDescription("")
    setSortOrder("0")
    setShowForm(true)
  }

  const openEdit = (cat: Category) => {
    setEditId(cat.id)
    setName(cat.name)
    setSlug(cat.slug)
    setDescription(cat.description || "")
    setSortOrder(String(cat.sort_order))
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")

    try {
      const payload = {
        name,
        slug: slug || autoSlug(name),
        description: description || null,
        sort_order: parseInt(sortOrder) || 0,
      }

      const url = editId ? `/api/admin/categories/${editId}` : "/api/admin/categories"
      const method = editId ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "সেভ করা যায়নি")
      }

      setShowForm(false)
      fetchCategories()
    } catch (err: any) {
      setError(err.message || "ত্রুটি")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }
      setDeleteId(null)
      fetchCategories()
    } catch (err: any) {
      setError(err.message || "ডিলিট করা যায়নি")
    }
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">ক্যাটাগরি</h1>
        </div>
        <p style={{ color: "var(--ink-muted)" }}>লোড হচ্ছে...</p>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">ক্যাটাগরি</h1>
          <p className="admin-page-subtitle">বইয়ের ক্যাটাগরি পরিচালনা করুন</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ ক্যাটাগরি যোগ করুন</button>
      </div>

      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      {showForm && (
        <div style={{ background: "var(--white)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", padding: "var(--sp-5)", marginBottom: "var(--sp-6)" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--sp-4)" }}>
            {editId ? "ক্যাটাগরি এডিট করুন" : "নতুন ক্যাটাগরি"}
          </h2>
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="admin-form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <div className="admin-form-group">
                <label className="admin-label">নাম *</label>
                <input className="admin-input" value={name} onChange={(e) => { setName(e.target.value); if (!editId) setSlug(autoSlug(e.target.value)) }} required />
              </div>
              <div className="admin-form-group">
                <label className="admin-label">স্লাগ *</label>
                <input className="admin-input" value={slug} onChange={(e) => setSlug(e.target.value)} required />
              </div>
              <div className="admin-form-group">
                <label className="admin-label">ক্রম</label>
                <input className="admin-input" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>
              <div className="admin-form-group admin-form-span-3">
                <label className="admin-label">বিবরণ</label>
                <input className="admin-input" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-4)" }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "সেভ হচ্ছে..." : editId ? "আপডেট করুন" : "তৈরি করুন"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>বাতিল</button>
            </div>
          </form>
        </div>
      )}

      {deleteId && (
        <div style={{ background: "var(--error-bg, #fef2f2)", border: "1px solid var(--error, #ef4444)", borderRadius: "var(--radius-md)", padding: "var(--sp-4)", marginBottom: "var(--sp-6)" }}>
          <p style={{ marginBottom: "var(--sp-3)", fontWeight: 500 }}>আপনি কি নিশ্চিত এই ক্যাটাগরি মুছে ফেলতে চান?</p>
          <div style={{ display: "flex", gap: "var(--sp-3)" }}>
            <button className="btn btn-danger" style={{ fontSize: "0.8125rem" }} onClick={() => handleDelete(deleteId)}>হ্যাঁ, মুছুন</button>
            <button className="btn btn-secondary" style={{ fontSize: "0.8125rem" }} onClick={() => setDeleteId(null)}>বাতিল</button>
          </div>
        </div>
      )}

      <div style={{ background: "var(--white)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", overflow: "hidden" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>নাম</th>
              <th>স্লাগ</th>
              <th>ক্রম</th>
              <th>তৈরি</th>
              <th style={{ width: 120 }}>কাজ</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--ink-muted)", padding: "var(--sp-8)" }}>কোনো ক্যাটাগরি নেই</td></tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id}>
                  <td style={{ fontWeight: 500 }}>{cat.name}</td>
                  <td><code style={{ fontSize: "0.8125rem" }}>{cat.slug}</code></td>
                  <td>{cat.sort_order}</td>
                  <td style={{ fontSize: "0.8125rem", color: "var(--ink-muted)" }}>{new Date(cat.created_at).toLocaleDateString("bn-BD")}</td>
                  <td>
                    <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                      <button className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => openEdit(cat)}>এডিট</button>
                      <button className="btn btn-danger" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => setDeleteId(cat.id)}>ডিলিট</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
