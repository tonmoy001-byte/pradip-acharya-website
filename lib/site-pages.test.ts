// lib/site-pages.test.ts
// Guards the trust pages and llms.txt at source level: each legal page must
// keep its metadata, breadcrumb JSON-LD and owner-review marker, and llms.txt
// must keep its shape. Rendering tests would need a DB; these catch the
// one-line regressions (deleted metadata export, dropped OWNER REVIEW).

import { describe, it, expect } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), "utf8")

const LEGAL_PAGES = [
  { path: "app/privacy/page.tsx", route: "/privacy" },
  { path: "app/refund-policy/page.tsx", route: "/refund-policy" },
  { path: "app/terms/page.tsx", route: "/terms" },
] as const

describe("legal pages (privacy, refund-policy, terms)", () => {
  for (const { path, route } of LEGAL_PAGES) {
    it(`${route} exports metadata via pageMetadata`, () => {
      const src = read(path)
      expect(src).toContain("pageMetadata(")
      expect(src).toContain(`path: "${route}"`)
    })

    it(`${route} renders breadcrumb JSON-LD`, () => {
      const src = read(path)
      expect(src).toContain("breadcrumbList(")
      expect(src).toContain("JsonLd")
    })

    it(`${route} carries an OWNER REVIEW marker`, () => {
      expect(read(path)).toContain("OWNER REVIEW REQUIRED")
    })
  }

  it("refund policy and terms keep their TODO(owner) business decisions", () => {
    expect(read("app/refund-policy/page.tsx")).toContain("TODO(owner)")
    expect(read("app/terms/page.tsx")).toContain("TODO(owner)")
  })

  it("legal pages are in the footer and the sitemap source", () => {
    const footer = read("components/Footer.tsx")
    expect(footer).toContain("/refund-policy")
    expect(footer).toContain("/terms")
    const seo = read("lib/seo.ts")
    expect(seo).toContain('"/refund-policy"')
    expect(seo).toContain('"/terms"')
  })
})

describe("llms.txt route", () => {
  it("serves GET from live books with a static fallback", () => {
    const src = read("app/llms.txt/route.ts")
    expect(src).toContain("export async function GET()")
    expect(src).toContain("getCachedBooks()")
    expect(src).toContain("absoluteUrl(")
    expect(src).toContain("text/plain")
  })

  it("is not listed in the sitemap", () => {
    expect(read("app/sitemap.ts")).not.toContain("llms")
  })

  it("route file exists", () => {
    expect(existsSync(join(root, "app/llms.txt/route.ts"))).toBe(true)
  })
})
