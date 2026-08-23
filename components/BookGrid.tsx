import type { Book } from "@/lib/data"
import BookCard from "./BookCard"

interface BookGridProps {
  books: Book[]
}

export default function BookGrid({ books }: BookGridProps) {
  if (books.length === 0) {
    return (
      <div className="cart-empty">
        <p>কোনো বই পাওয়া যায়নি।</p>
      </div>
    )
  }

  return (
    <div className="book-grid">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  )
}
