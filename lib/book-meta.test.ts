// lib/book-meta.test.ts
// The book meta description must come from the book record, so adding a book
// can never inherit another book's title, author or price.

import { describe, it, expect } from "vitest"
import { bookMetaDescription } from "./book-meta"

const base = {
  title: "ছেঁড়া পুষ্প",
  author: "প্রদীপ কুমার আচার্য্য",
  description: "“ছেঁড়া পুষ্প” একটি সামাজিক উপন্যাস — বাস্তব ও কাল্পনিক কাহিনীর সমন্বয়ে রচিত।",
  ebook: { price: 50, available: true },
}

describe("bookMetaDescription", () => {
  it("uses the book's own description and live price", () => {
    const desc = bookMetaDescription(base)
    expect(desc).toContain("সামাজিক উপন্যাস")
    expect(desc).toContain("৳ ৫০")
    expect(desc).toContain("PDF")
  })

  it("truncates long descriptions at a word boundary", () => {
    const long = { ...base, description: "অ আ ".repeat(100).trim() }
    const desc = bookMetaDescription(long)
    expect(desc.length).toBeLessThanOrEqual(150 + 40)
    // No split word: the char right after the snippet cut is a space or end.
    expect(desc).not.toMatch(/\S{30,}/)
  })

  it("falls back to a generic template when description is empty", () => {
    const desc = bookMetaDescription({ ...base, description: "   " })
    expect(desc).toContain("ছেঁড়া পুষ্প")
    expect(desc).toContain("প্রদীপ কুমার আচার্য্য")
    expect(desc).toContain("৳ ৫০")
  })

  it("reflects a different book's data, not the old hardcoded text", () => {
    const other = {
      ...base,
      title: "নতুন বই",
      author: "অন্য লেখক",
      description: "একটি ভিন্ন বইয়ের বিবরণ।",
      ebook: { price: 120, available: true },
    }
    const desc = bookMetaDescription(other)
    expect(desc).toContain("ভিন্ন বইয়ের বিবরণ")
    expect(desc).toContain("৳ ১২০")
    expect(desc).not.toContain("ছেঁড়া পুষ্প")
    expect(desc).not.toContain("৳ ৫০")
  })
})
