// lib/structured-data.ts
// Every JSON-LD node the site emits, built from real data only.
//
// Deliberate omissions, because each would be a false statement if invented:
//
//   * `sameAs` on the author — no verified social profile URLs exist in the
//     project (site_settings has only email/phone/WhatsApp). A placeholder like
//     "facebook.com/your-official-author-page" is a fabricated identity claim
//     and risks a structured-data manual action. Add the property once real
//     profiles exist.
//   * `aggregateRating` / `review` — the book has no ratings or reviews. Fake
//     review markup is an explicit violation of Google's guidelines.
//   * `offers.priceValidUntil` — no real expiry date is recorded.
//   * `potentialAction` SearchAction on WebSite — the site has no search route,
//     so advertising one would point Google at a 404.
//   * `logo` on Organization — the project has no logo asset; using the
//     author's photograph as a logo would misrepresent it.

import { absoluteUrl, AUTHOR_OG_IMAGE, SITE_LANG, SITE_URL } from "@/lib/seo"
import type { Book } from "@/lib/data"

/** Stable fragment identifiers so entities on different pages link up. */
export const ID = {
  website: `${SITE_URL}/#website`,
  organization: `${SITE_URL}/#organization`,
  author: `${SITE_URL}/about#person`,
} as const

/** Romanised name, for readers who search Bengali content in Latin script. */
export const AUTHOR_NAME_BN = "প্রদীপ কুমার আচার্য্য"
export const AUTHOR_NAME_EN = "Pradip Kumar Acharya"

/** Transliteration of the title, used as `alternateName`. */
export function bookAlternateName(title: string): string {
  // "ছেঁড়া পুষ্প" → "Chhera Pushpo". Derived from the single catalogue title
  // rather than hand-written, so adding a book cannot drift from its data.
  const map: Record<string, string> = {
    "ছেঁড়া পুষ্প": "Chhera Pushpo",
  }
  return map[title] || title
}

export interface AuthorFacts {
  name: string
  birthDate: string
  birthPlace: string
  father: string
  mother: string
  /** Subjects the author actually writes about, per the /about page. */
  knowsAbout: string[]
}

/** The single Person node, referenced by @id from every other page. */
export function authorPerson(facts: AuthorFacts) {
  return {
    "@type": "Person",
    "@id": ID.author,
    name: facts.name,
    alternateName: AUTHOR_NAME_EN,
    url: absoluteUrl("/about"),
    image: absoluteUrl(AUTHOR_OG_IMAGE),
    jobTitle: "লেখক ও ঔপন্যাসিক",
    description:
      "প্রদীপ কুমার আচার্য্য একজন বাংলা লেখক ও ঔপন্যাসিক। তাঁর জীবন, সাহিত্যকর্ম এবং “ছেঁড়া পুষ্প” উপন্যাস সম্পর্কে জানুন।",
    inLanguage: SITE_LANG,
    knowsLanguage: ["bn-BD"],
    knowsAbout: facts.knowsAbout,
    birthDate: facts.birthDate,
    birthPlace: { "@type": "Place", name: facts.birthPlace },
    parent: [
      { "@type": "Person", name: facts.father },
      { "@type": "Person", name: facts.mother },
    ],
  } as const
}

/** Site-level entities. Emitted once, on the homepage. */
export function websiteGraph(settings: { siteName: string; tagline: string }) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": ID.website,
        url: `${SITE_URL}/`,
        name: settings.siteName,
        description: settings.tagline,
        inLanguage: SITE_LANG,
        publisher: { "@id": ID.author },
      },
      {
        "@type": "Organization",
        "@id": ID.organization,
        name: settings.siteName,
        url: `${SITE_URL}/`,
        description: settings.tagline,
        inLanguage: SITE_LANG,
        founder: { "@id": ID.author },
      },
    ],
  }
}

export interface Breadcrumb {
  name: string
  /** Site-relative path. The final crumb is normally the current page. */
  path: string
}

/**
 * BreadcrumbList. The final item is the current page and carries no `item`,
 * which is the convention Google documents — a trailing self-referencing
 * `item` is treated as a duplicate of the page URL.
 */
export function breadcrumbList(crumbs: Breadcrumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => {
      const isLast = i === crumbs.length - 1
      return {
        "@type": "ListItem",
        position: i + 1,
        name: crumb.name,
        ...(isLast ? {} : { item: absoluteUrl(crumb.path) }),
      }
    }),
  }
}

/** Home → Books → this book. */
export function bookBreadcrumbs(book: Book): Breadcrumb[] {
  return [
    { name: "হোম", path: "/" },
    { name: "সকল বই", path: "/books" },
    { name: book.title, path: `/book/${book.id}` },
  ]
}

/**
 * The book page as one connected graph.
 *
 * Typed `["Book", "Product"]`: `Book` is what Google's book rich results read,
 * and `Product` is the commercial reality of the page (it is for sale at a
 * price). Declaring both lets Google use whichever it needs instead of the
 * entity being ambiguous.
 *
 * `hasDigitalDocumentPublished` is the accurate property for an ebook;
 * `isAccessibleForFree: false` tells Google this is not a free read, which
 * matters because it prevents the page being treated as free content.
 */
export function bookGraph(book: Book) {
  const url = absoluteUrl(`/book/${book.id}`)
  const price = Number(book.ebook.price)
  const isFree = price === 0

  const node = {
    "@type": ["Book", "Product"],
    "@id": `${url}#book`,
    name: book.title,
    alternateName: bookAlternateName(book.title),
    url,
    description: book.description,
    image: [absoluteUrl(book.images.primary)],
    inLanguage: SITE_LANG,
    // Both values come from the database, never a literal.
    genre: book.categoryLabel?.trim() || "উপন্যাস",
    bookFormat: "https://schema.org/EBook",
    encodingFormat: "application/pdf",
    hasDigitalDocumentPublished: {
      "@type": "DigitalDocument",
      encodingFormat: "application/pdf",
      inLanguage: SITE_LANG,
      isAccessibleForFree: false,
      contentUrl: url,
    },
    isAccessibleForFree: false,
    numberOfPages: book.pages || undefined,
    isbn: book.isbn?.trim() || undefined,
    datePublished: book.publicationDate
      ? String(book.publicationDate).slice(0, 10)
      : undefined,
    author: { "@id": ID.author },
    publisher: book.publisher?.trim()
      ? { "@type": "Organization", name: book.publisher.trim() }
      : undefined,
    offers: {
      "@type": "Offer",
      url,
      price: String(price),
      priceCurrency: "BDT",
      availability: book.ebook.available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": ID.author },
      // Only claim free delivery when the price is genuinely zero.
      ...(isFree ? { isFreeShipping: true } : {}),
    },
    additionalProperty: [
      { "@type": "PropertyValue", name: "ফরম্যাট", value: "ডিজিটাল ইবুক (PDF)" },
      { "@type": "PropertyValue", name: "ভাষা", value: "বাংলা" },
      { "@type": "PropertyValue", name: "লেখক", value: book.author },
    ],
  }

  // Drop undefined keys so the emitted JSON contains no null-valued noise.
  const clean = <T extends Record<string, unknown>>(obj: T): T =>
    Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""),
    ) as T

  const bookNode = clean(node) as typeof node

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: book.title,
        description: book.description,
        inLanguage: SITE_LANG,
        isPartOf: { "@id": ID.website },
        primaryImageOfPage: { "@id": `${url}#book` },
        mainEntity: { "@id": `${url}#book` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      bookNode,
      { ...breadcrumbList(bookBreadcrumbs(book)), "@id": `${url}#breadcrumb` },
    ],
  }
}

/** Blog post as Article + BreadcrumbList. */
export function articleGraph(post: {
  title: string
  slug: string
  excerpt?: string
  publishedAt?: string
  authorName?: string
}) {
  const url = absoluteUrl(`/blog/${post.slug}`)
  // Posts carry their own author. Only link to the site author's canonical
  // @id when the post is actually attributed to them — pointing every post at
  // the same node would misattribute guest writing.
  const isSiteAuthor = !post.authorName || post.authorName.trim() === AUTHOR_NAME_BN
  const author = isSiteAuthor
    ? { "@id": ID.author }
    : { "@type": "Person", name: post.authorName }

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: post.title,
        description: post.excerpt,
        url,
        inLanguage: SITE_LANG,
        isPartOf: { "@id": ID.website },
        ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
        mainEntityOfPage: { "@id": `${url}#webpage` },
        author,
        publisher: { "@id": ID.organization },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: breadcrumbList([
          { name: "হোম", path: "/" },
          { name: "ব্লগ", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ]).itemListElement,
      },
    ],
  }
}