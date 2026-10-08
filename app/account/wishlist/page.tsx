"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth"
import { money } from "@/lib/format"
import { resolveCoverImage } from "@/lib/api"

interface WishlistItem {
  id: string
  book_id: string
  created_at: string
  books: {
    id: string
    title: string
    author: string
    cover_primary: string | null
    book_formats: { format_name: string; price: number; delivery_type: string; available: boolean }[]
  } | null
}

export default function AccountWishlistPage() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return

    async function fetchWishlist() {
      try {
        const res = await fetch("/api/wishlist", { credentials: "include" })
        const json = await res.json()

        if (!res.ok) {
          setError(json.error || "উইশলিস্ট লোড করা যায়নি")
          return
        }

        setItems(json.data || [])
      } catch {
        setError("উইশলিস্ট লোড করা যায়নি")
      } finally {
        setLoading(false)
      }
    }

    fetchWishlist()
  }, [user, authLoading])

  async function handleRemove(item: WishlistItem) {
    if (!item.books) return

    setRemovingId(item.id)
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ book_id: item.book_id }),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json.error || "সরানো যায়নি")
        return
      }

      setItems((prev) => prev.filter((w) => w.id !== item.id))
    } catch {
      setError("সরানো যায়নি")
    } finally {
      setRemovingId(null)
    }
  }

  /**
   * Ebook-only: a wishlist entry is buyable when the book has an available
   * digital format. Buying goes straight to checkout — nothing is carted.
   */
  function isEbookAvailable(item: WishlistItem): boolean {
    if (!item.books) return false
    const ebook = (item.books.book_formats || []).find(
      (f) => f.delivery_type === "digital",
    )
    return Boolean(ebook?.available)
  }

  if (authLoading || loading) {
    return (
      <div>
        <div className="page-header">
          <h1>পছন্দের তালিকা</h1>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "var(--sp-4)",
          }}
        >
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 280, borderRadius: "var(--radius-lg)" }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header" style={{ paddingBottom: "var(--sp-4)" }}>
        <h1>পছন্দের তালিকা</h1>
        <p style={{ color: "var(--ink-muted)", marginTop: "var(--sp-2)" }}>
          আপনার পছন্দের বইগুলো এখানে সংরক্ষিত আছে
        </p>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: "var(--sp-3) var(--sp-4)",
            background: "rgba(192, 57, 43, 0.06)",
            border: "1px solid rgba(192, 57, 43, 0.25)",
            borderRadius: "var(--radius-md)",
            color: "#991b1b",
            fontSize: "0.875rem",
            marginBottom: "var(--sp-6)",
          }}
        >
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="cart-empty">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--stone)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: "var(--sp-4)", opacity: 0.5 }}
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <p style={{ color: "var(--ink-muted)", marginBottom: "var(--sp-4)", fontSize: "1rem" }}>
            আপনার উইশলিস্ট খালি
          </p>
          <Link href="/books" className="btn btn-primary">
            সকল বই দেখুন
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(1, 1fr)",
            gap: "var(--sp-5)",
          }}
        >
          <style>{`
            @media (min-width: 640px) {
              .wishlist-grid { grid-template-columns: repeat(2, 1fr) !important; }
            }
            @media (min-width: 1024px) {
              .wishlist-grid { grid-template-columns: repeat(3, 1fr) !important; }
            }
          `}</style>
          <div className="wishlist-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "var(--sp-5)" }}>
            {items.map((item) => {
              const book = item.books
              if (!book) return null

              return (
                <div
                  key={item.id}
                  className="card"
                  style={{ padding: "var(--sp-4)", display: "flex", flexDirection: "column" }}
                >
                  {/* Cover Image */}
                  <Link
                    href={`/book/${book.id}`}
                    style={{ display: "block", marginBottom: "var(--sp-3)" }}
                  >
                    <img
                      src={resolveCoverImage(book.cover_primary)}
                      alt={book.title}
                      style={{
                        width: "100%",
                        aspectRatio: "2/3",
                        objectFit: "cover",
                        borderRadius: "var(--radius-md)",
                      }}
                    />
                  </Link>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <Link
                      href={`/book/${book.id}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <h3
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "1rem",
                          fontWeight: "var(--font-weight-bold)",
                          lineHeight: 1.4,
                          marginBottom: "var(--sp-1)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {book.title}
                      </h3>
                    </Link>
                    <p style={{ fontSize: "0.8125rem", color: "var(--ink-muted)", marginBottom: "var(--sp-2)" }}>
                      {book.author}
                    </p>
                    <p
                      style={{
                        fontSize: "1.125rem",
                        fontFamily: "var(--font-display)",
                        fontWeight: "var(--font-weight-bold)",
                        color: "var(--terracotta)",
                        marginBottom: "var(--sp-4)",
                      }}
                    >
                      {money(
                        (book.book_formats || []).find((f) => f.delivery_type === "digital")
                          ?.price || 0,
                      )}
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontFamily: "var(--font-body)",
                          fontWeight: 400,
                          color: "var(--stone)",
                          marginLeft: "var(--sp-2)",
                        }}
                      >
                        (ইবুক)
                      </span>
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                    <Link
                      href={
                        isEbookAvailable(item)
                          ? `/checkout?book=${encodeURIComponent(item.books!.id)}`
                          : "#"
                      }
                      onClick={(e) => {
                        if (!isEbookAvailable(item)) e.preventDefault()
                      }}
                      className="btn btn-primary"
                      style={{
                        flex: 1,
                        fontSize: "0.8125rem",
                        padding: "var(--sp-2) var(--sp-3)",
                        textAlign: "center",
                        opacity: isEbookAvailable(item) ? 1 : 0.6,
                      }}
                    >
                      ইবুক কিনুন
                    </Link>
                    <button
                      onClick={() => handleRemove(item)}
                      disabled={removingId === item.id}
                      className="btn btn-ghost"
                      style={{
                        fontSize: "0.8125rem",
                        padding: "var(--sp-2) var(--sp-3)",
                        color: removingId === item.id ? "var(--stone)" : "#991b1b",
                        flexShrink: 0,
                      }}
                    >
                      {removingId === item.id ? "..." : "সরান"}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
