import { describe, it, expect } from "vitest"
import { resolveCoverImage, resolveHoverImage, resolveRows, resolveSingleRow } from "./api"

const INSFORGE_URL = "https://cpd9mnqf.ap-southeast.insforge.app"
const FALLBACK = "/images/books/placeholder.png"

describe("resolveCoverImage", () => {
  // Test 1: Complete URL values
  it("returns complete https:// URL unchanged", () => {
    const url = "https://example.com/covers/book.png"
    expect(resolveCoverImage(url)).toBe(url)
  })

  it("returns complete http:// URL unchanged", () => {
    const url = "http://example.com/covers/book.png"
    expect(resolveCoverImage(url)).toBe(url)
  })

  // Test 2: Local public image paths
  it("returns local /images/ path unchanged", () => {
    expect(resolveCoverImage("/images/books/chhera-pushpo-1.png")).toBe(
      "/images/books/chhera-pushpo-1.png"
    )
  })

  it("returns local path with leading slash unchanged", () => {
    expect(resolveCoverImage("/images/books/placeholder.png")).toBe(
      "/images/books/placeholder.png"
    )
  })

  // Test 3: Normalized InsForge object keys
  it("builds storage URL for bare object key", () => {
    expect(resolveCoverImage("books/cover.png")).toBe(
      `${INSFORGE_URL}/api/storage/buckets/book-covers/objects/books/cover.png`
    )
  })

  it("builds storage URL for object key without path separator", () => {
    expect(resolveCoverImage("cover.png")).toBe(
      `${INSFORGE_URL}/api/storage/buckets/book-covers/objects/cover.png`
    )
  })

  // Test 4: Legacy leading-slash values
  it("treats legacy /images/books/cover.png as local path", () => {
    expect(resolveCoverImage("/images/books/cover.png")).toBe(
      "/images/books/cover.png"
    )
  })

  // Test 5: Missing image fallback
  it("returns fallback for null", () => {
    expect(resolveCoverImage(null)).toBe(FALLBACK)
  })

  it("returns fallback for undefined", () => {
    expect(resolveCoverImage(undefined)).toBe(FALLBACK)
  })

  it("returns fallback for empty string", () => {
    expect(resolveCoverImage("")).toBe(FALLBACK)
  })

  it("returns fallback for whitespace-only string", () => {
    expect(resolveCoverImage("   ")).toBe(FALLBACK)
  })

  it("returns fallback for non-string type", () => {
    expect(resolveCoverImage(123 as any)).toBe(FALLBACK)
  })
})

describe("resolveHoverImage", () => {
  // A missing hover cover must stay missing. Falling back to the placeholder
  // here would stack a second image over the real cover in every book card.
  it("returns undefined for null instead of the placeholder", () => {
    expect(resolveHoverImage(null)).toBeUndefined()
  })

  it("returns undefined for undefined", () => {
    expect(resolveHoverImage(undefined)).toBeUndefined()
  })

  it("returns undefined for empty string", () => {
    expect(resolveHoverImage("")).toBeUndefined()
  })

  it("returns undefined for whitespace-only string", () => {
    expect(resolveHoverImage("   ")).toBeUndefined()
  })

  it("resolves a real hover cover like the primary cover", () => {
    expect(resolveHoverImage("/images/books/chhera-pushpo-2.png")).toBe(
      "/images/books/chhera-pushpo-2.png"
    )
    expect(resolveHoverImage("books/cover.png")).toBe(
      `${INSFORGE_URL}/api/storage/buckets/book-covers/objects/books/cover.png`
    )
  })
})

describe("resolveSingleRow (single-row query result handling)", () => {
  const row = { id: "chhera-pushpo", title: "ছেঁড়া পুষ্প" }

  it("returns data when there is no error", () => {
    expect(resolveSingleRow({ data: row, error: null }, "ctx")).toBe(row)
  })

  it("returns null for a true miss (no data, no error)", () => {
    expect(resolveSingleRow({ data: null, error: null }, "ctx")).toBe(null)
  })

  it("throws (does not return null) on error", () => {
    expect(() =>
      resolveSingleRow({ data: null, error: { message: "connection reset" } }, "getBookById(x)"),
    ).toThrow("getBookById(x): connection reset")
  })
})

describe("resolveRows (list query result handling)", () => {
  const rows = [{ id: "a" }, { id: "b" }]

  it("returns the rows when there is no error", () => {
    expect(resolveRows({ data: rows, error: null }, "ctx")).toBe(rows)
  })

  it("returns [] for a genuine empty database result (no error, empty array)", () => {
    expect(resolveRows({ data: [], error: null }, "ctx")).toEqual([])
  })

  it("throws (does not return []) on error", () => {
    expect(() =>
      resolveRows({ data: null, error: { message: "socket hang up" } }, "getBooks()"),
    ).toThrow("getBooks(): socket hang up")
  })

  it("throws when data is missing without an error (not a legitimate empty result)", () => {
    expect(() => resolveRows({ data: null, error: null }, "getBooks()")).toThrow(
      "getBooks(): no data returned",
    )
  })
})
