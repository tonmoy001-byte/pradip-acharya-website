"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"

// The store has a single category (উপন্যাস), so there is nothing to filter by.
// Only the sort order remains a user choice on the listing pages.

interface SortSelectProps {
  activeSort: string
}

function SortSelectInner({ activeSort }: SortSelectProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateSort(value: string) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set("sort", value)
    router.push(`?${sp.toString()}`)
  }

  return (
    <div className="filter-bar">
      <select
        className="sort-select"
        value={activeSort}
        onChange={(e) => updateSort(e.target.value)}
        aria-label="সাজানো"
      >
        <option value="featured">বিশেষ</option>
        <option value="price-asc">মূল্য: কম থেকে বেশি</option>
        <option value="price-desc">মূল্য: বেশি থেকে কম</option>
        <option value="newest">নতুন</option>
      </select>
    </div>
  )
}

export default function SortSelect(props: SortSelectProps) {
  return (
    <Suspense fallback={null}>
      <SortSelectInner {...props} />
    </Suspense>
  )
}
