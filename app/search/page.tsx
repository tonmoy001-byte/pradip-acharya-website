"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { getBooks } from "@/lib/api"
import type { Book } from "@/lib/data"
import BookGrid from "@/components/BookGrid"
import { Suspense } from "react"

function SearchInner() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get("q") || ""
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<Book[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    getBooks({ query: query.trim() }).then((books) => {
      setResults(books)
      setLoading(false)
    })
  }, [query])

  return (
    <div className="container section-padding">
      <div className="page-header">
        <h1>অনুসন্ধান</h1>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto var(--sp-8)" }}>
        <input
          type="search"
          className="form-input"
          placeholder="বইয়ের নাম বা লেখকের নাম লিখুন..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%", fontSize: "1.0625rem" }}
          aria-label="অনুসন্ধান"
          autoFocus
        />
      </div>

      {loading && <p style={{ textAlign: "center" }}>অনুসন্ধান করা হচ্ছে...</p>}

      {!loading && query.trim() && results.length === 0 && (
        <p style={{ textAlign: "center", color: "var(--stone)" }}>
          &ldquo;{query}&rdquo; এর জন্য কোনো ফলাফল পাওয়া যায়নি।
        </p>
      )}

      {!loading && results.length > 0 && <BookGrid books={results} />}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container section-padding"><p style={{ textAlign: "center" }}>লোড হচ্ছে...</p></div>}>
      <SearchInner />
    </Suspense>
  )
}
