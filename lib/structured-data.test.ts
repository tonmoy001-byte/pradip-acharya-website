// lib/structured-data.test.ts
// Validates the JSON-LD builders against schema.org and Google's rich-result
// requirements, and asserts the deliberate omissions that keep the markup
// truthful.

import { describe, it, expect } from "vitest"
import {
  ID,
  AUTHOR_NAME_BN,
  authorPerson,
  bookGraph,
  breadcrumbList,
  websiteGraph,
  articleGraph,
  bookAlternateName,
} from "./structured-data"
import { SITE_URL, absoluteUrl } from "./seo"
import type { Book } from "./data"

const book: Book = {
  id: "chhera-pushpo",
  title: "ছেঁড়া পুষ্প",
  author: AUTHOR_NAME_BN,
  category: "novels",
  categoryLabel: "উপন্যাস",
  description: "বাংলা সামাজিক উপন্যাস।",
  synopsis: "স্মৃতি ও বর্তমানের এক অনন্য মিলন।",
  ebook: { name: "eBook", price: 50, available: true },
  publicationDate: "2012-04-14T00:00:00.000Z",
  publisher: "স্বরাজ প্রকাশনী ",
  isbn: "978-984-8846-47-6",
  pages: 90,
  language: "বাংলা",
  images: { primary: "/images/books/chhera-pushpo-1.png" },
  featured: true,
  isNew: false,
  trending: false,
}

const nodes = (graph: { "@graph": unknown[] }) => graph["@graph"] as Record<string, any>[]
const findType = (graph: { "@graph": unknown[] }, type: string) =>
  nodes(graph).find((n) => {
    const t = n["@type"]
    return Array.isArray(t) ? t.includes(type) : t === type
  })

/**
 * Same lookup, but fails loudly when the node is absent. Next's build
 * typechecks these files (tsc does not include them), so a `| undefined`
 * return would make every property access below an error rather than a
 * readable test failure.
 */
function nodeOfType(graph: { "@graph": unknown[] }, type: string): Record<string, any> {
  const node = findType(graph, type)
  if (!node) throw new Error(`no ${type} node in graph`)
  return node
}

describe("entity identity", () => {
  it("gives every entity a stable @id under the canonical origin", () => {
    expect(ID.website.startsWith("https://")).toBe(true)
    expect(ID.author).toBe(`${SITE_URL}/about#person`)
    expect(ID.organization.startsWith("https://")).toBe(true)
  })

  it("declares @context https://schema.org on every graph", () => {
    expect(bookGraph(book)["@context"]).toBe("https://schema.org")
    expect(websiteGraph({ siteName: "x", tagline: "y" })["@context"]).toBe("https://schema.org")
    expect(breadcrumbList([])["@context"]).toBe("https://schema.org")
  })
})

describe("Book graph", () => {
  const graph = bookGraph(book)
  const node = nodeOfType(graph, "Book")

  it("is typed as both Book and Product", () => {
    // Book drives Google's book rich results; Product reflects that it is
    // genuinely for sale. Declaring one alone leaves the entity ambiguous.
    expect(node["@type"]).toEqual(["Book", "Product"])
  })

  it("exposes name, absolute url and an absolute image", () => {
    expect(node.name).toBe("ছেঁড়া পুষ্প")
    expect(node.url.startsWith("https://")).toBe(true)
    // A relative image path is silently dropped by Google's parser.
    for (const img of node.image) expect(img.startsWith("https://")).toBe(true)
  })

  it("offers a real price in BDT with matching availability", () => {
    expect(node.offers.price).toBe("50")
    expect(node.offers.priceCurrency).toBe("BDT")
    expect(node.offers.availability).toBe("https://schema.org/InStock")
    expect(node.offers.url).toBe(node.url)
  })

  it("reports OutOfStock when the format is unavailable", () => {
    const soldOut = { ...book, ebook: { ...book.ebook, available: false } }
    expect(nodeOfType(bookGraph(soldOut), "Book").offers.availability).toBe(
      "https://schema.org/OutOfStock",
    )
  })

  it("never claims free shipping for a paid book", () => {
    expect(node.offers.isFreeShipping).toBeUndefined()
    const free = { ...book, ebook: { ...book.ebook, price: 0 } }
    const freeNode = nodeOfType(bookGraph(free), "Book")
    expect(freeNode.offers.isFreeShipping).toBe(true)
    expect(freeNode.offers.price).toBe("0")
  })

  it("identifies the digital format", () => {
    expect(node.bookFormat).toBe("https://schema.org/EBook")
    expect(node.encodingFormat).toBe("application/pdf")
    expect(node.hasDigitalDocumentPublished["@type"]).toBe("DigitalDocument")
    // The book costs money, so it must not be marked as a free read.
    expect(node.isAccessibleForFree).toBe(false)
    expect(node.hasDigitalDocumentPublished.isAccessibleForFree).toBe(false)
  })

  it("carries the catalog metadata, trimmed", () => {
    expect(node.isbn).toBe("978-984-8846-47-6")
    expect(node.numberOfPages).toBe(90)
    expect(node.datePublished).toBe("2012-04-14")
    // The DB value has a trailing space; emitting it verbatim would break the
    // match against the publisher's catalogue record.
    expect(node.publisher.name).toBe("স্বরাজ প্রকাশনী")
  })

  it("takes the genre from the database, not a literal", () => {
    expect(node.genre).toBe("উপন্যাস")
    const relabelled = { ...book, categoryLabel: "ভ্রমণ" }
    expect(nodeOfType(bookGraph(relabelled), "Book").genre).toBe("ভ্রমণ")
  })

  it("omits optional fields rather than emitting empty ones", () => {
    const bare: Book = { ...book, isbn: "", pages: 0, publisher: "   ", publicationDate: undefined }
    const n = nodeOfType(bookGraph(bare), "Book")
    for (const key of ["isbn", "numberOfPages", "publisher", "datePublished"]) {
      expect(n[key], `${key} should be omitted`).toBeUndefined()
    }
  })

  it("links the author and the page by @id instead of repeating them", () => {
    expect(node.author).toEqual({ "@id": ID.author })
    const webpage = nodeOfType(graph, "WebPage")
    expect(webpage.mainEntity).toEqual({ "@id": `${node.url}#book` })
    expect(webpage.isPartOf).toEqual({ "@id": ID.website })
  })

  it("emits no fabricated review or rating markup", () => {
    // The book has no reviews or ratings on record. Inventing them violates
    // Google's structured data guidelines and risks a manual action.
    for (const key of ["aggregateRating", "review", "rating"]) {
      expect(node[key], `${key} must not be fabricated`).toBeUndefined()
    }
  })

  it("omits priceValidUntil rather than inventing an expiry", () => {
    expect(node.offers.priceValidUntil).toBeUndefined()
  })
})

describe("alternateName", () => {
  it("gives the romanised title for Bengali readers searching in Latin script", () => {
    expect(bookAlternateName("ছেঁড়া পুষ্প")).toBe("Chhera Pushpo")
    expect(nodeOfType(bookGraph(book), "Book").alternateName).toBe("Chhera Pushpo")
  })

  it("falls back to the original title when no transliteration exists", () => {
    expect(bookAlternateName("নতুন বই")).toBe("নতুন বই")
  })
})

describe("BreadcrumbList", () => {
  it("numbers positions from one and links every crumb but the last", () => {
    const bc = breadcrumbList([
      { name: "হোম", path: "/" },
      { name: "সকল বই", path: "/books" },
      { name: "ছেঁড়া পুষ্প", path: "/book/chhera-pushpo" },
    ])
    expect(bc.itemListElement.map((i: any) => i.position)).toEqual([1, 2, 3])
    // A trailing self-referencing item duplicates the page URL and Google
    // drops the whole trail, so the last crumb carries no `item`.
    expect(bc.itemListElement[2].item).toBeUndefined()
    expect(bc.itemListElement[0].item).toBe(absoluteUrl("/"))
    for (const item of bc.itemListElement) {
      if (item.item) expect(item.item.startsWith("https://")).toBe(true)
    }
  })

  it("emits exactly one BreadcrumbList per page", () => {
    const graph = bookGraph(book)
    expect(nodes(graph).filter((n) => n["@type"] === "BreadcrumbList")).toHaveLength(1)
  })

  it("gives every crumb a non-empty Bengali name", () => {
    const graph = bookGraph(book)
    const bc = nodeOfType(graph, "BreadcrumbList")
    for (const item of bc.itemListElement) {
      expect(item.name.trim().length).toBeGreaterThan(0)
    }
    expect(bc.itemListElement.map((i: any) => i.name)).toEqual([
      "হোম",
      "সকল বই",
      "ছেঁড়া পুষ্প",
    ])
  })
})

describe("Person node", () => {
  const person = authorPerson({
    name: AUTHOR_NAME_BN,
    birthDate: "1986-12-04",
    birthPlace: "কল্যাণপুর গ্রাম, লক্ষ্মীপুর জেলা, বাংলাদেশ",
    father: "দ্বিজেন্দ্র লাল আচার্য্য",
    mother: "মীরা রানী আচার্য্য",
    knowsAbout: ["বাংলা সাহিত্য", "উপন্যাস"],
  })

  it("carries an @id matching the book page's author reference", () => {
    expect(person["@id"]).toBe(ID.author)
    expect(nodeOfType(bookGraph(book), "Book").author["@id"]).toBe(person["@id"])
  })

  it("adds a romanised alternateName", () => {
    expect(person.alternateName).toBe("Pradip Kumar Acharya")
  })

  it("omits sameAs because no verified social profiles are recorded", () => {
    // site_settings stores only email, phone and WhatsApp. A placeholder such
    // as "facebook.com/your-official-author-page" is a fabricated identity
    // claim, so the property is left off entirely. The `in` form is used
    // because the returned type genuinely has no such key.
    expect("sameAs" in person).toBe(false)
    expect(JSON.stringify(person)).not.toContain("sameAs")
  })

  it("only claims facts printed on the page", () => {
    expect(person.birthDate).toBe("1986-12-04")
    expect(person.birthPlace.name).toContain("লক্ষ্মীপুর")
    expect(person.jobTitle).toBe("লেখক ও ঔপন্যাসিক")
    expect(person.knowsAbout).toEqual(["বাংলা সাহিত্য", "উপন্যাস"])
  })

  it("uses an absolute image url", () => {
    expect(person.image.startsWith("https://")).toBe(true)
  })
})

describe("WebSite and Organization", () => {
  const graph = websiteGraph({ siteName: "প্রদীপ কুমার আচার্য্য", tagline: "বাংলা সাহিত্যের একটি নতুন অধ্যায়" })

  it("declares a WebSite with an absolute url", () => {
    const site = nodeOfType(graph, "WebSite")
    expect(site.url.startsWith("https://")).toBe(true)
    expect(site.inLanguage).toBe("bn-BD")
  })

  it("omits SearchAction because the site has no search route", () => {
    // Advertising a SearchAction with no /search page would send Google to a
    // 404 and is a broken sitelinks searchbox candidate.
    expect(nodeOfType(graph, "WebSite").potentialAction).toBeUndefined()
  })

  it("links the site to the author and the organization", () => {
    expect(nodeOfType(graph, "WebSite").publisher).toEqual({ "@id": ID.author })
    expect(nodeOfType(graph, "Organization").founder).toEqual({ "@id": ID.author })
  })

  it("omits a logo the project does not have", () => {
    expect(nodeOfType(graph, "Organization").logo).toBeUndefined()
  })
})

describe("Article graph", () => {
  const graph = articleGraph({
    title: "একটি লেখা",
    slug: "ekti-lekha",
    excerpt: "সংক্ষিপ্ত",
    publishedAt: "2026-01-15T00:00:00.000Z",
    authorName: AUTHOR_NAME_BN,
  })

  it("describes the article with an absolute url", () => {
    const a = nodeOfType(graph, "Article")
    expect(a.url).toBe(absoluteUrl("/blog/ekti-lekha"))
    expect(a.headline).toBe("একটি লেখা")
    expect(a.datePublished).toBe("2026-01-15T00:00:00.000Z")
  })

  it("attributes a guest post to its actual author, not the site owner", () => {
    const guest = articleGraph({ title: "t", slug: "s", authorName: "অন্য লেখক" })
    expect(nodeOfType(guest, "Article").author).toEqual({ "@type": "Person", name: "অন্য লেখক" })
  })

  it("includes breadcrumbs for the post trail", () => {
    expect(nodeOfType(graph, "BreadcrumbList")).toBeDefined()
  })
})

describe("no invalid markup anywhere", () => {
  it("never emits a relative url", () => {
    const payloads = [
      JSON.stringify(bookGraph(book)),
      JSON.stringify(websiteGraph({ siteName: "a", tagline: "b" })),
      JSON.stringify(articleGraph({ title: "t", slug: "s" })),
    ]
    for (const payload of payloads) {
      // Match "url":"/..." or "item":"/..." — a leading slash after a quote.
      expect(payload).not.toMatch(/"(?:url|item|contentUrl|image|logo|@id)":\s*"\/(?!\/)/)
    }
  })

  it("never emits undefined as a literal value", () => {
    for (const payload of [
      JSON.stringify(bookGraph(book)),
      JSON.stringify(websiteGraph({ siteName: "a", tagline: "b" })),
    ]) {
      expect(payload.includes("undefined")).toBe(false)
    }
  })
})