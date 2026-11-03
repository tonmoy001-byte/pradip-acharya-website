// lib/sanitize-html.ts
// HTML sanitizer for blog post content.
//
// Post content is stored as HTML and rendered with dangerouslySetInnerHTML.
// Raw HTML from an admin is a stored-XSS risk: a single `<script>` or an
// `onerror=` attribute on an <img> runs in every visitor's browser. This
// sanitizer strips everything that is not an explicit allow-list of tags and
// attributes, and rewrites every <a> to carry rel="noopener noreferrer".
//
// Applied twice:
//   1. On save (admin POST/PUT) so malformed content never reaches the DB.
//   2. On render (blog/[slug]) as defense in depth in case a row predates the
//      sanitizer or was written by another tool.

import sanitizeHtml from "sanitize-html"

export function cleanPostHtml(dirty: string): string {
  if (!dirty) return ""
  return sanitizeHtml(dirty, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "figure",
      "figcaption",
      "u",
      "s",
      "ins",
      "del",
      "mark",
      "blockquote",
      "pre",
      "code",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "ul",
      "ol",
      "li",
      "p",
      "br",
      "hr",
      "strong",
      "em",
      "b",
      "i",
      "span",
      "div",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading"],
      code: ["class"],
      span: ["class"],
      div: ["class"],
      p: ["class"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
    },
  })
}