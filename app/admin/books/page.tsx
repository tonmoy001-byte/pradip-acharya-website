"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { money } from "@/lib/format"
import { useRouter } from "next/navigation"

interface BookFormat {
  id: string
  format_name: string
  price: number
  compare_at_price?: number | null
  available: boolean
  delivery_type: string
}

interface Book {
  id: string
  title: string
  author: string
  category: string
  subcategory: string
  cover_primary: string | null
  is_demo: boolean
  featured: boolean
  is_new: boolean
  trending: boolean
  book_formats: BookFormat[]
  created_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  novels: "উপন্যাস",
  books: "বই",
}

export default function AdminBooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteTitle, setDeleteTitle] = useState("")
  const router = useRouter()

  const fetchBooks = () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (categoryFilter) params.set("category", categoryFilter)

    fetch(`/api/admin/books?${params}`)
      .then((r) => r.json())
      .then((d) => setBooks(d.books || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchBooks()
  }, [search, categoryFilter])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/admin/books/${deleteId}`, { method: "DELETE" })
      if (res.ok) {
        setBooks((prev) => prev.filter((b) => b.id !== deleteId))
        setDeleteId(null)
        setDeleteTitle("")
      }
    } catch {}
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="admin-page-title">বই ম্যানেজমেন্ট</h1>
            <p className="admin-page-subtitle">{books.length} টি বই</p>
          </div>
          <Link href="/admin/books/new" className="btn btn-primary">
            + নতুন বই
          </Link>
        </div>
      </div>

      <div className="admin-filters">
        <input
          type="text"
          className="admin-input"
          placeholder="বই খুঁজুন..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <select
          className="admin-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">সব ক্যাটাগরি</option>
          <option value="novels">উপন্যাস</option>
          <option value="books">বই</option>
        </select>
      </div>

      {loading ? (
        <p style={{ color: "var(--ink-muted)" }}>লোড হচ্ছে...</p>
      ) : books.length === 0 ? (
        <div className="admin-empty">
          <p>কোনো বই পাওয়া যায়নি</p>
          <Link href="/admin/books/new" className="btn btn-primary" style={{ marginTop: "var(--sp-4)" }}>
            প্রথম বই যোগ করুন
          </Link>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>বই</th>
                <th>লেখক</th>
                <th>ক্যাটাগরি</th>
                <th>ফরম্যাট</th>
                <th>মূল্য</th>
                <th>বৈশিষ্ট্য</th>
                <th>কাজ</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr key={book.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
                      {book.cover_primary && (
                        <img
                          src={book.cover_primary}
                          alt={book.title}
                          style={{ width: 40, height: 56, objectFit: "cover", borderRadius: 4 }}
                        />
                      )}
                      <div>
                        <div style={{ fontWeight: 500 }}>{book.title}</div>
                        {book.is_demo && (
                          <span className="admin-badge admin-badge-draft" style={{ fontSize: "0.6875rem" }}>ডেমো</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{book.author}</td>
                  <td>{CATEGORY_LABELS[book.category] || book.category}</td>
                  <td>
                    {book.book_formats?.map((f) => (
                      <div key={f.id} style={{ fontSize: "0.8125rem" }}>
                        {f.format_name} — {money(f.price)}
                        {!f.available && <span style={{ color: "var(--ink-muted)", marginLeft: 4 }}>(বন্ধ)</span>}
                      </div>
                    ))}
                  </td>
                  <td style={{ fontFamily: "monospace" }}>
                    {book.book_formats?.[0] ? money(book.book_formats[0].price) : "—"}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {book.featured && <span className="admin-badge admin-badge-published" style={{ fontSize: "0.6875rem" }}>বৈশিষ্ট্যযুক্ত</span>}
                      {book.is_new && <span className="admin-badge admin-badge-admin" style={{ fontSize: "0.6875rem" }}>নতুন</span>}
                      {book.trending && <span className="admin-badge admin-badge-error" style={{ fontSize: "0.6875rem" }}>ট্রেন্ডিং</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                        onClick={() => router.push(`/admin/books/${book.id}/edit`)}
                      >
                        এডিট
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                        onClick={() => {
                          setDeleteId(book.id)
                          setDeleteTitle(book.title)
                        }}
                      >
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
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--sp-4)" }}>
              বই ডিলিট করুন?
            </h3>
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
