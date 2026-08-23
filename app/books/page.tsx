import { getBooks, getAllSubcategories } from "@/lib/api"
import { CATEGORIES } from "@/lib/data"
import BookGrid from "@/components/BookGrid"
import FilterBar from "./FilterBar"

export const metadata = {
  title: "সকল বই | প্রদীপ কুমার আচার্য্য",
  description: "প্রদীপ কুমার আচার্য্যের সকল বই এখানে পাওয়া যাচ্ছে।",
}

interface PageProps {
  searchParams: Promise<{ subcategory?: string; sort?: string }>
}

export default async function BooksPage({ searchParams }: PageProps) {
  const params = await searchParams
  const subcategorySlug = params.subcategory
  const sort = (params.sort as "featured" | "price-asc" | "price-desc" | "newest") || "featured"

  const [books, subcategories] = await Promise.all([
    getBooks({ subcategorySlug, sort }),
    getAllSubcategories(),
  ])

  return (
    <div className="container section-padding">
      <div className="page-header">
        <h1>সকল বই</h1>
        <p>প্রদীপ কুমার আচার্য্যের সাহিত্যকর্মের সম্পূর্ণ সংকলন।</p>
      </div>

      <FilterBar
        subcategories={subcategories}
        activeSubcategory={subcategorySlug}
        activeSort={sort}
      />

      <BookGrid books={books} />
    </div>
  )
}
