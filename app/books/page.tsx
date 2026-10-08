import { getCachedBooks } from "@/lib/public-cache"
import { BOOK_CATEGORY_LABEL } from "@/lib/data"
import { pageMetadata } from "@/lib/seo"
import { breadcrumbList } from "@/lib/structured-data"
import JsonLd from "@/components/JsonLd"
import BookGrid from "@/components/BookGrid"
import SortSelect from "./SortSelect"

export const metadata = pageMetadata({
  title: "প্রদীপ কুমার আচার্য্যের বই ও বাংলা উপন্যাস | ইবুক সংগ্রহ",
  description:
    "প্রদীপ কুমার আচার্য্যের বাংলা সাহিত্যকর্ম ও উপন্যাসের তালিকা দেখুন। “ছেঁড়া পুষ্প” ইবুকের বিবরণ, মূল্য এবং সংগ্রহের তথ্য এখানে পাওয়া যাবে।",
  path: "/books",
  keywords: ["প্রদীপ কুমার আচার্য্যের বই", "বাংলা উপন্যাস", "বাংলা ইবুক", "ছেঁড়া পুষ্প"],
})

interface PageProps {
  searchParams: Promise<{ sort?: string }>
}

export default async function BooksPage({ searchParams }: PageProps) {
  const params = await searchParams
  const sort = (params.sort as "featured" | "price-asc" | "price-desc" | "newest") || "featured"

  const books = await getCachedBooks({ sort })

  return (
    <div className="container section-padding">
      <JsonLd
        data={breadcrumbList([
          { name: "হোম", path: "/" },
          { name: "সকল বই", path: "/books" },
        ])}
      />
      <div className="page-header">
        <h1>প্রদীপ কুমার আচার্য্যের বই</h1>
        <p>
          প্রদীপ কুমার আচার্য্যের সাহিত্যকর্মের সম্পূর্ণ সংকলন। বর্তমানে
          {` ${BOOK_CATEGORY_LABEL} `}
          শ্রেণিতে তাঁর ইবুকগুলো এখানে পাওয়া যাচ্ছে।
        </p>
      </div>

      <section aria-labelledby="books-list-heading">
        <h2 id="books-list-heading">সকল বই</h2>
        <SortSelect activeSort={sort} />
        <BookGrid books={books} />
      </section>
    </div>
  )
}
