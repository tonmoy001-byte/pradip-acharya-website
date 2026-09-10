"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import BookForm from "@/components/admin/BookForm"

interface BookFormatInput {
  name: string
  price: string
  compareAtPrice: string
  delivery_type: string
  available: boolean
}

interface BookData {
  id: string
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
  book_formats: Array<{
    format_name: string
    price: number
    compare_at_price: number | null
    delivery_type: string
    available: boolean
  }>
}

export default function AdminBookEditPage() {
  const { id } = useParams()
  const router = useRouter()
  const [book, setBook] = useState<BookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/admin/books/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found")
        return r.json()
      })
      .then((d) => setBook(d.book))
      .catch(() => setError("বই খুঁজে পাওয়া যায়নি"))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">লোড হচ্ছে...</h1>
        </div>
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">ত্রুটি</h1>
        </div>
        <p style={{ color: "var(--error)" }}>{error || "বই পাওয়া যায়নি"}</p>
        <button className="btn btn-secondary" style={{ marginTop: "var(--sp-4)" }} onClick={() => router.back()}>
          ফিরে যান
        </button>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">বই এডিট করুন</h1>
        <p className="admin-page-subtitle">{book.title}</p>
      </div>
      <BookForm
        mode="edit"
        initial={{
          id: book.id,
          title: book.title,
          author: book.author,
          category: book.category,
          subcategory: book.subcategory,
          subcategory_slug: book.subcategory_slug,
          description: book.description,
          synopsis: book.synopsis,
          cover_primary: book.cover_primary,
          cover_hover: book.cover_hover,
          featured: book.featured,
          is_new: book.is_new,
          trending: book.trending,
          is_demo: book.is_demo,
          publication_date: book.publication_date,
          publisher: book.publisher,
          isbn: book.isbn,
          pages: book.pages,
          language: book.language,
          formats: book.book_formats.map((f) => ({
            name: f.format_name,
            price: String(f.price),
            compareAtPrice: f.compare_at_price ? String(f.compare_at_price) : "",
            delivery_type: f.delivery_type,
            available: f.available,
          })),
        }}
      />
    </div>
  )
}
