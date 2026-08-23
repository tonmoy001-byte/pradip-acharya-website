"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"

interface FilterBarProps {
  subcategories: { slug: string; label: string }[]
  activeSubcategory?: string
  activeSort: string
}

function FilterBarInner({ subcategories, activeSubcategory, activeSort }: FilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string) {
    const sp = new URLSearchParams(searchParams.toString())
    if (value) {
      sp.set(key, value)
    } else {
      sp.delete(key)
    }
    router.push(`?${sp.toString()}`)
  }

  return (
    <div className="filter-bar">
      <button
        className={`filter-pill ${!activeSubcategory ? "active" : ""}`}
        onClick={() => updateParam("subcategory", "")}
      >
        সকল
      </button>
      {subcategories.map((sub) => (
        <button
          key={sub.slug}
          className={`filter-pill ${activeSubcategory === sub.slug ? "active" : ""}`}
          onClick={() => updateParam("subcategory", sub.slug)}
        >
          {sub.label}
        </button>
      ))}

      <select
        className="sort-select"
        value={activeSort}
        onChange={(e) => updateParam("sort", e.target.value)}
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

export default function FilterBar(props: FilterBarProps) {
  return (
    <Suspense fallback={null}>
      <FilterBarInner {...props} />
    </Suspense>
  )
}
