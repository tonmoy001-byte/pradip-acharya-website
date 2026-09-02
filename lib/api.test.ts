import { describe, it, expect } from "vitest"
import { resolveCoverImage } from "./api"

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
