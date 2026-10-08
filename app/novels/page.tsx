import { getCachedBooks } from "@/lib/public-cache"
import { BOOK_CATEGORY } from "@/lib/data"
import { pageMetadata } from "@/lib/seo"
import { breadcrumbList } from "@/lib/structured-data"
import JsonLd from "@/components/JsonLd"
import BookGrid from "@/components/BookGrid"
import SortSelect from "../books/SortSelect"

export const metadata = pageMetadata({
  title: "প্রদীপ কুমার আচার্য্যের উপন্যাস সংকলন | বাংলা সামাজিক উপন্যাস",
  description:
    "প্রদীপ কুমার আচার্য্যের বাংলা সামাজিক উপন্যাস সংকলন। “ছেঁড়া পুষ্প” উপন্যাসের কাহিনি, ইবুকের বিবরণ ও সংগ্রহের তথ্য এখানে পাওয়া যাবে।",
  path: "/novels",
  keywords: ["বাংলা সামাজিক উপন্যাস", "ছেঁড়া পুষ্প উপন্যাস", "উপন্যাস সংগ্রহ", "প্রদীপ কুমার আচার্য্য"],
})

interface PageProps {
  searchParams: Promise<{ sort?: string }>
}

export default async function NovelsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const sort = (params.sort as "featured" | "price-asc" | "price-desc" | "newest") || "featured"

  // `novels` is the store's only category; this route is its canonical page.
  const books = await getCachedBooks({ category: BOOK_CATEGORY, sort })

  return (
    <div className="container section-padding">
      <JsonLd
        data={breadcrumbList([
          { name: "হোম", path: "/" },
          { name: "সকল বই", path: "/books" },
          { name: "উপন্যাস", path: "/novels" },
        ])}
      />
      <div className="page-header">
        <h1>প্রদীপ কুমার আচার্য্যের উপন্যাস</h1>
        <p>
          প্রদীপ কুমার আচার্য্য লেখেন জীবনের গভীরতা, মানবিক অনুভূতি ও সমসাময়িক
          বাস্তবতায় ভরা বাংলা সামাজিক উপন্যাস। এই পাতায় তাঁর উপন্যাসগুলোর তালিকা ও
          সংগ্রহের তথ্য রয়েছে।
        </p>
      </div>

      <section aria-labelledby="novels-list-heading">
        <h2 id="novels-list-heading">উপন্যাসের তালিকা</h2>
        <SortSelect activeSort={sort} />
        <BookGrid books={books} />
      </section>
    </div>
  )
}
