import { describe, it, expect } from "vitest"
import { cleanPostHtml } from "@/lib/sanitize-html"

describe("cleanPostHtml", () => {
  it("passes through plain text paragraphs", () => {
    const out = cleanPostHtml("<p>Hello world</p>")
    expect(out).toContain("Hello world")
    expect(out).toContain("<p>")
  })

  it("strips script tags entirely", () => {
    const out = cleanPostHtml("<p>hi</p><script>alert(1)</script>")
    expect(out).not.toContain("alert")
    expect(out).not.toContain("<script")
  })

  it("strips inline event handlers", () => {
    const out = cleanPostHtml('<img src="x.png" onerror="alert(1)">')
    expect(out).not.toContain("onerror")
    expect(out).toContain("<img")
  })

  it("strips javascript: links", () => {
    const out = cleanPostHtml('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toMatch(/javascript:/i)
  })

  it("adds rel=noopener noreferrer to external links", () => {
    const out = cleanPostHtml('<a href="https://example.com">ex</a>')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it("allows images with http/https src only", () => {
    const out = cleanPostHtml('<img src="https://example.com/a.png" alt="a">')
    expect(out).toContain('src="https://example.com/a.png"')
    expect(out).toContain('alt="a"')
  })

  it("drops an image with a javascript: src", () => {
    const out = cleanPostHtml('<img src="javascript:alert(1)">')
    expect(out).not.toMatch(/javascript:/i)
  })

  it("keeps headings and lists", () => {
    const out = cleanPostHtml("<h2>Title</h2><ul><li>one</li></ul>")
    expect(out).toContain("<h2>")
    expect(out).toContain("<li>")
  })

  it("returns empty string for empty input", () => {
    expect(cleanPostHtml("")).toBe("")
  })
})