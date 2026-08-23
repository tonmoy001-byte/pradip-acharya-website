import { getBooks } from "@/lib/api"
import BookGrid from "@/components/BookGrid"
import FilterBar from "../books/FilterBar"

export const metadata = {
  title: "উপন্যাস | প্রদীপ কুমার আচার্য্য",
  description: "প্রদীপ কুমার আচার্য্যের উপন্যাস সংকলন।",
}

interface PageProps {
  searchParams: Promise<{ subcategory?: string; sort?: string }>
}

export default async function NovelsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const subcategorySlug = params.subcategory
  const sort = (params.sort as "featured" | "price-asc" | "price-desc" | "newest") || "featured"

  const books = await getBooks({ category: "novels", subcategorySlug, sort })

  return (
    <div className="container section-padding">
      <div className="page-header">
        <h1>উপন্যাস</h1>
        <p>প্রদীপ কুমার আচার্য্যের উপন্যাস সংকলন।</p>
      </div>

      <FilterBar
        subcategories={[]}
        activeSubcategory={subcategorySlug}
        activeSort={sort}
      />

      <BookGrid books={books} />
    </div>
  )
}
