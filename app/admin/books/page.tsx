"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { money } from "@/lib/format"
import { resolveCoverImage } from "@/lib/api"
import { BOOK_CATEGORY_LABEL } from "@/lib/data"
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
  ebook: BookFormat | null
  created_at: string
}

export default function AdminBooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteTitle, setDeleteTitle] = useState("")
  const router = useRouter()

  // Ebook-only: surface the single digital format per book.
  const withEbook = (books: Book[]) =>
    books.map((b) => ({
      ...b,
      ebook:
        b.book_formats?.find((f) => f.delivery_type === "digital") ?? null,
    }))

  const fetchBooks = () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)

    fetch(`/api/admin/books?${params}`)
      .then((r) => r.json())
      .then((d) => setBooks(withEbook(d.books || [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchBooks()
  }, [search])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/admin/books/${deleteId}`, { method: "DELETE" })
      const data = await res.json()
      if (res.ok) {
        setBooks((prev) => prev.filter((b) => b.id !== deleteId))
        setDeleteId(null)
        setDeleteTitle("")
      } else {
        alert(data.error || "Failed to delete book")
      }
    } catch (err) {
      alert("Failed to delete book: " + (err instanceof Error ? err.message : String(err)))
    }
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
              <th>ইবুক</th>
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
                          src={resolveCoverImage(book.cover_primary)}
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
                  <td>{BOOK_CATEGORY_LABEL}</td>
                  <td>
                    {book.ebook ? (
                      <div style={{ fontSize: "0.8125rem" }}>
                        ডিজিটাল ইবুক (PDF) — {money(book.ebook.price)}
                        {!book.ebook.available && (
                          <span style={{ color: "var(--ink-muted)", marginLeft: 4 }}>(বন্ধ)</span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "var(--ink-muted)", fontSize: "0.8125rem" }}>
                        ইবুক নেই — বিক্রির জন্য ইবুক যোগ করুন
                      </span>
                    )}
                  </td>
                  <td style={{ fontFamily: "monospace" }}>
                    {book.ebook ? money(book.ebook.price) : "—"}
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
