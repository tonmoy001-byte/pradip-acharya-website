// lib/category.test.ts
// Single-category invariants for the ebook store.
//
// The store publishes exactly one book category. These tests lock that in so
// the retired multi-category taxonomy (fiction / literature / poetry / essay /
// memoir / contemporary / travel / children) cannot creep back into either the
// application logic or the rendered UI.

import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { BOOK_CATEGORY, BOOK_CATEGORY_LABEL, type BookCategory } from "./data"

/** Category values that must never exist in application code again. */
const RETIRED_CATEGORY_VALUES = [
  "fiction",
  "literature",
  "poetry",
  "essay",
  "memoir",
  "contemporary",
  "travel",
  "children",
]

const SCAN_ROOTS = ["app", "components", "lib"]
const SCAN_SKIP = new Set(["node_modules", ".next", ".kilo", ".git"])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SCAN_SKIP.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(full)) out.push(full)
  }
  return out
}

function sourceFiles(): string[] {
  return SCAN_ROOTS.flatMap((root) =>
    // Skip test files: this file necessarily spells out the retired values it
    // guards against, and would otherwise always match itself.
    walk(join(process.cwd(), root)).filter((f) => !/\.test\.tsx?$/.test(f)),
  )
}

function relative(file: string): string {
  return file.replace(process.cwd() + "\\", "")
}

describe("single book category", () => {
  it("uses `novels` as the only internal key", () => {
    expect(BOOK_CATEGORY).toBe("novels")
  })

  it("uses উপন্যাস as the user-facing label", () => {
    expect(BOOK_CATEGORY_LABEL).toBe("উপন্যাস")
  })

  it("exposes a label that is not the raw English key", () => {
    expect(BOOK_CATEGORY_LABEL).not.toBe(BOOK_CATEGORY)
    // A Bengali label must not be ASCII-only, or it would render as English.
    expect(BOOK_CATEGORY_LABEL).not.toMatch(/^[\x00-\x7F]+$/)
  })

  it("types BookCategory as the single `novels` literal", () => {
    // Compile-time assertion: only "novels" satisfies BookCategory.
    const only: BookCategory = "novels"
    expect(only).toBe(BOOK_CATEGORY)
  })
})

describe("retired category values are gone from application logic", () => {
  it("no source file references a retired category value as a data value", () => {
    const offenders: string[] = []

    for (const file of sourceFiles()) {
      const src = readFileSync(file, "utf8")
      for (const value of RETIRED_CATEGORY_VALUES) {
        // Match a quoted literal (string value or option value), not a substring
        // of an unrelated word or a prose comment.
        const pattern = new RegExp(`["'\`]${value}["'\`]`)
        if (pattern.test(src)) offenders.push(`${relative(file)} :: ${value}`)
      }
    }

    expect(offenders).toEqual([])
  })

  it("no component renders a raw category key to users", () => {
    const offenders: string[] = []

    for (const file of sourceFiles()) {
      const src = readFileSync(file, "utf8")
      // `{book.category}` / `{book.subcategory}` leak the raw English key.
      // `book.categoryLabel` is the intended display field, so exclude it via
      // the negative lookahead on the bare `category` alternative.
      if (/\{\s*book\.(?:category|subcategory|subcategorySlug)(?!Label)\s*\}/.test(src)) {
        offenders.push(relative(file))
      }
    }

    expect(offenders).toEqual([])
  })

  it("keeps only the novels category in the admin book form payload", () => {
    const src = readFileSync(join(process.cwd(), "components/admin/BookForm.tsx"), "utf8")
    expect(src).toContain("category: BOOK_CATEGORY")
    expect(src).toContain("subcategory: BOOK_CATEGORY_LABEL")
    expect(src).toContain("subcategory_slug: BOOK_CATEGORY")
  })

  it("has no category filter UI on the public listing routes", () => {
    for (const page of ["app/books/page.tsx", "app/novels/page.tsx"]) {
      const src = readFileSync(join(process.cwd(), page), "utf8")
      // `?subcategory=` filtering only existed to serve multiple categories.
      expect(src, `${page} still reads a subcategory param`).not.toMatch(/subcategory/)
      expect(src, `${page} still renders category filter pills`).not.toMatch(/filter-pill/)
    }
  })
})
