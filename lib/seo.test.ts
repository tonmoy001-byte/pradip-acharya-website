// lib/seo.test.ts
// Guards the SEO contract that is easy to break silently: absolute canonicals,
// a real robots.txt and sitemap, and JSON-LD that actually parses.
//
// These are source-level assertions rather than rendering tests because the
// failure mode being guarded (a missing/relative canonical, a removed
// metadataBase) is a one-line edit that no unit test would otherwise notice.

import { describe, it, expect } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { absoluteUrl, isPrivatePath, pageMetadata, SITE_URL, PUBLIC_PATHS } from "./seo"

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), "utf8")

describe("absoluteUrl", () => {
  it("builds absolute HTTPS URLs from site-relative paths", () => {
    expect(absoluteUrl("/books")).toBe(`${SITE_URL}/books`)
    expect(absoluteUrl("books")).toBe(`${SITE_URL}/books`)
  })

  it("leaves already-absolute URLs untouched", () => {
    expect(absoluteUrl("https://example.com/a.pdf")).toBe("https://example.com/a.pdf")
  })

  it("uses an https origin and has no trailing slash", () => {
    expect(SITE_URL.startsWith("https://")).toBe(true)
    expect(SITE_URL.endsWith("/")).toBe(false)
  })
})

describe("pageMetadata", () => {
  const meta = pageMetadata({ title: "পরীক্ষা", description: "বর্ণনা", path: "/books" })

  it("emits a self-referencing absolute canonical", () => {
    expect(meta.alternates?.canonical).toBe(`${SITE_URL}/books`)
  })

  it("emits an absolute og:url and og:image", () => {
    const og = meta.openGraph as Record<string, unknown>
    expect(og.url).toBe(`${SITE_URL}/books`)
    const images = og.images as Array<{ url: string }>
    expect(images[0].url.startsWith("https://")).toBe(true)
  })

  it("does not set noindex on a normal public page", () => {
    expect((meta as { robots?: unknown }).robots).toBeUndefined()
  })

  it("sets noindex,nofollow when asked", () => {
    const priv = pageMetadata({ title: "x", description: "y", path: "/checkout", noindex: true })
    const robots = (priv as { robots: { index: boolean; follow: boolean } }).robots
    expect(robots.index).toBe(false)
    expect(robots.follow).toBe(false)
  })
})

describe("isPrivatePath", () => {
  it("classifies private and transaction routes", () => {
    for (const p of ["/login", "/checkout", "/account/orders", "/admin/books", "/payment/success", "/api/orders"]) {
      expect(isPrivatePath(p), p).toBe(true)
    }
  })

  it("never classifies a public page as private", () => {
    for (const p of PUBLIC_PATHS) {
      expect(isPrivatePath(p), p).toBe(false)
    }
    expect(isPrivatePath("/book/chhera-pushpo")).toBe(false)
  })
})

describe("robots.txt route", () => {
  it("exists and points at the canonical sitemap", () => {
    expect(existsSync(join(root, "app/robots.ts"))).toBe(true)
    const src = read("app/robots.ts")
    expect(src).toContain("/sitemap.xml")
  })
})

describe("sitemap route", () => {
  it("exists and derives book URLs from live data", () => {
    const src = read("app/sitemap.ts")
    expect(src).toContain("/book/")
    expect(src).toContain("getCachedBooks")
  })

  it("never emits localhost, preview or development URLs", () => {
    // Assert on the resolved origin, not on source text: lib/seo.ts
    // legitimately contains the word "localhost" in its own guard logic.
    expect(SITE_URL).not.toMatch(/localhost/)
    expect(SITE_URL).not.toMatch(/127\.0\.0\.1/)
    expect(SITE_URL).not.toMatch(/vercel\.app/)

    // Both routes must derive URLs from the shared helper rather than a
    // hand-written origin that could drift from the real one.
    expect(read("app/sitemap.ts"), "app/sitemap.ts").toContain("absoluteUrl")
    expect(read("app/robots.ts"), "app/robots.ts").toContain("SITE_URL")
  })
})

describe("root layout metadata", () => {
  const src = read("app/layout.tsx")

  it("sets metadataBase so relative URLs can resolve", () => {
    expect(src).toContain("metadataBase")
  })

  it("keeps the Google site-verification token", () => {
    expect(src).toContain("google-site-verification")
  })

  it("declares the Bengali document language", () => {
    expect(src).toContain('lang="bn-BD"')
  })
})

describe("public page metadata", () => {
  const pages: Array<[string, string]> = [
    ["app/page.tsx", "/"],
    ["app/books/page.tsx", "/books"],
    ["app/novels/page.tsx", "/novels"],
    ["app/blog/page.tsx", "/blog"],
    ["app/contact/page.tsx", "/contact"],
    ["app/privacy/page.tsx", "/privacy"],
    ["app/about/page.tsx", "/about"],
  ]

  it("builds metadata through the shared helper (canonical guaranteed)", () => {
    for (const [file] of pages) {
      expect(read(file), file).toContain("pageMetadata")
    }
  })

  it("declares a title and a non-empty description", () => {
    for (const [file] of pages) {
      const src = read(file)
      expect(src, file).toMatch(/title:\s*"/)
      expect(src, file).toMatch(/description:\s*\n?\s*"/)
    }
  })

  it("gives every public page exactly one H1", () => {
    for (const [file] of pages) {
      // The homepage's H1 is rendered by <Hero>, not by the page file.
      const src = file === "app/page.tsx" ? read("components/Hero.tsx") : read(file)
      const h1s = src.match(/<h1[\s>]/g) || []
      expect(h1s.length, `${file} has ${h1s.length} H1 tags`).toBe(1)
    }
  })
})

describe("Bengali copy integrity", () => {
  const src = (f: string) => read(f)

  it("never builds a genitive by concatenating এর onto a name", () => {
    // `{author}এর` renders আচার্য্যএর. আচার্য্য ends in ya-phala, a consonant
    // sound, so the marker must attach as ের instead.
    for (const file of [
      "components/Hero.tsx",
      "app/book/[id]/BookDetailClient.tsx",
      "app/book/[id]/page.tsx",
    ]) {
      expect(src(file), `${file} concatenates এর onto a name`).not.toMatch(/\}এর/)
    }
  })

  it("uses the possessive helper wherever a name is inflected", () => {
    for (const file of [
      "components/Hero.tsx",
      "app/book/[id]/BookDetailClient.tsx",
      "app/book/[id]/page.tsx",
    ]) {
      expect(src(file), `${file} must use possessive()`).toContain("possessive(")
    }
  })

  it("spells the author's name correctly everywhere", () => {
    // Three spellings exist in Bengali text; only one is correct here.
    const wrong = ["আচার্য্যএর", "আচার্য্যর", "আচার্যের"]
    const files = [
      "components/Hero.tsx",
      "components/Footer.tsx",
      "components/Navbar.tsx",
      "components/AnnouncementBar.tsx",
      "app/layout.tsx",
      "app/page.tsx",
      "app/books/page.tsx",
      "app/novels/page.tsx",
      "app/about/page.tsx",
      "app/blog/page.tsx",
      "app/contact/page.tsx",
      "app/privacy/page.tsx",
      "app/book/[id]/page.tsx",
      "app/book/[id]/BookDetailClient.tsx",
      "lib/seo.ts",
      "lib/structured-data.ts",
    ]
    for (const file of files) {
      const content = src(file)
      for (const w of wrong) {
        expect(content.includes(w), `${file} contains "${w}"`).toBe(false)
      }
    }
  })

  it("keeps the possessive helper covered by its own unit tests", () => {
    expect(read("lib/format.test.ts")).toContain("আচার্য্যএর")
  })
})

describe("heading hierarchy", () => {
  it("qualifies the book-card H3 so it is not a bare repeat of the title", () => {
    // The card heading used to be only book.title, which duplicated the H1 and
    // H2 word for word on the homepage.
    const card = read("components/BookCard.tsx")
    expect(card).toMatch(/book-card-title[\s\S]{0,200}qualifier/)
    expect(card).toContain("book.categoryLabel")
    expect(card).toContain("book.language")
  })

  it("feeds the hero headings from book data, not hardcoded strings", () => {
    // The title appearing in app/page.tsx metadata and the excerpt teaser is
    // correct. What must not happen is the heading markup hardcoding it, which
    // would break the moment the featured book changes.
    const page = read("app/page.tsx")
    expect(page).toMatch(/title=\{heroBook\?\.title\}/)
    expect(page).toMatch(/author=\{heroBook\?\.author\}/)
  })
})

describe("structured data", () => {
  it("routes every page through the shared builders, not inline scripts", () => {
    // Inline JSON.stringify blocks are how relative URLs and stale field sets
    // creep in; all nodes are now built in lib/structured-data.ts.
    for (const file of [
      "app/page.tsx",
      "app/about/page.tsx",
      "app/book/[id]/page.tsx",
      "app/blog/[slug]/page.tsx",
    ]) {
      const src = read(file)
      expect(src, `${file} still builds JSON-LD inline`).not.toContain("application/ld+json")
      expect(src, `${file} must use the shared wrapper`).toContain("<JsonLd")
    }
  })

  it("emits a BreadcrumbList on every public subpage", () => {
    for (const [file, crumb] of [
      ["app/books/page.tsx", "সকল বই"],
      ["app/novels/page.tsx", "উপন্যাস"],
      ["app/about/page.tsx", "লেখক পরিচিতি"],
      ["app/contact/page.tsx", "যোগাযোগ"],
      ["app/privacy/page.tsx", "গোপনীয়তা নীতি"],
      ["app/blog/page.tsx", "ব্লগ"],
    ]) {
      const src = read(file)
      expect(src, `${file} missing breadcrumbs`).toContain("breadcrumbList")
      expect(src, `${file} missing the "${crumb}" crumb`).toContain(`"${crumb}"`)
    }
  })

  it("serialises JSON-LD through the hardened wrapper", () => {
    // `</script>` inside a JSON string ends the script element early even when
    // the JSON itself is escaped, so the wrapper must neutralise it.
    const src = read("components/JsonLd.tsx")
    expect(src).toContain("JSON.stringify")
    expect(src).toMatch(/replace\(\/<\/g|replace\(\/</)
  })

  it("builds WebSite + Organization on the homepage and Person on /about", () => {
    expect(read("lib/structured-data.ts")).toContain('"@type": "WebSite"')
    expect(read("lib/structured-data.ts")).toContain('"@type": "Organization"')
    expect(read("lib/structured-data.ts")).toContain('"@type": "Person"')
    expect(read("lib/structured-data.ts")).toContain('"@type": "BreadcrumbList"')
  })

  it("keeps a single author @id across pages so entities link up", () => {
    const sd = read("lib/structured-data.ts")
    // A separate Person node per page would prevent Google from assembling
    // the author's entity graph.
    const authorId = (sd.match(/author:\s*`\$\{SITE_URL\}\/about#person`/) || [])[0]
    expect(authorId, "author @id must be defined once in lib/structured-data.ts").toBeTruthy()
    expect(read("app/about/page.tsx")).toContain("authorPerson")
    expect(read("app/book/[id]/page.tsx")).toContain("bookGraph")
  })

  it("never fabricates reviews, ratings or social profiles", () => {
    const sd = read("lib/structured-data.ts")
    // These appear only in the comments explaining why they are omitted.
    for (const prop of ["aggregateRating", "review", "sameAs"]) {
      const inObject = new RegExp(`"${prop}"\\s*:`)
      expect(sd, `${prop} must not be emitted`).not.toMatch(inObject)
    }
  })
})

describe("private routes carry noindex", () => {
  it("sends an X-Robots-Tag header for every private route", () => {
    // The header, not a <meta> tag, is the reliable mechanism: /verify,
    // /payment/success and the auth-gated client pages ship no server HTML.
    const src = read("proxy.ts")
    expect(src).toContain("X-Robots-Tag")
    for (const route of [
      "/account",
      "/admin",
      "/checkout",
      "/payment",
      "/my-downloads",
      "/my-orders",
      "/api",
      "/login",
      "/verify",
      "/forgot-password",
      "/reset-password",
    ]) {
      expect(src, `${route} missing from middleware`).toContain(`"${route}`)
    }
  })

  it("never matches a public route in the proxy matcher", () => {
    const matcher = read("proxy.ts").match(/matcher:\s*\[([\s\S]*?)\]/)
    expect(matcher, "matcher not found").not.toBeNull()
    for (const p of ["/books", "/novels", "/about", "/contact", "/privacy", "/blog"]) {
      expect(matcher![1], `${p} must not be in the private matcher`).not.toContain(`"${p}`)
    }
  })

  it("does not set a conflicting index directive at the root", () => {
    // A root `robots: { index: true }` is emitted on every page and would sit
    // next to the private noindex, which a crawler could read as "index".
    const layout = read("app/layout.tsx")
    expect(layout).not.toMatch(/robots:\s*\{/)
  })
  it("marks every private screen", () => {
    const guarded: Array<[string, RegExp]> = [
      ["app/account/layout.tsx", /SeoNoindex/],
      ["app/login/page.tsx", /SeoNoindex/],
      ["app/my-downloads/page.tsx", /SeoNoindex/],
      ["app/my-orders/page.tsx", /SeoNoindex/],
      ["app/account/orders/page.tsx", /SeoNoindex/],
      ["app/verify/page.tsx", /SeoNoindex/],
      ["app/forgot-password/page.tsx", /SeoNoindex/],
      ["app/reset-password/page.tsx", /SeoNoindex/],
      ["app/payment/success/page.tsx", /SeoNoindex/],
    ]
    for (const [file, re] of guarded) {
      expect(read(file), `${file} is missing its noindex directive`).toMatch(re)
    }
  })

  it("emits noindex from every render branch, not just the loaded one", () => {
    // An auth gate returns a loading state on the server, so a directive
    // placed only in the final branch never reaches a crawler. Match returns
    // at exactly the component-body indent so a .map() callback return — which
    // is not a page branch and needs no directive — is not miscounted.
    for (const file of ["app/my-downloads/page.tsx", "app/account/orders/page.tsx"]) {
      const src = read(file)
      const branches = (src.match(/^ {4}return \($/gm) || []).length
      const directives = (src.match(/<SeoNoindex \/>/g) || []).length
      expect(directives, `${file}: ${directives} directive(s) for ${branches} branch(es)`)
        .toBeGreaterThanOrEqual(branches)
    }
  })

  it("marks checkout and admin through metadata", () => {
    expect(read("app/checkout/page.tsx")).toMatch(/index:\s*false/)
    expect(read("app/admin/layout.tsx")).toMatch(/index:\s*false/)
  })
})
