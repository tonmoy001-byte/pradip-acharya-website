// components/SeoNoindex.tsx
// Renders a `noindex, nofollow` robots directive as a real <meta> tag.
//
// Next.js only allows `export const metadata` from Server Components, but
// several private screens (account, login, checkout) are client components.
// React 19 hoists <meta> into <head>, so this works in both cases and gives
// every private route the same directive from one place.
//
// These pages stay crawlable on purpose: a URL blocked in robots.txt can still
// be indexed as a bare link with no snippet, because Google never fetches the
// page and therefore never sees the noindex.

export default function SeoNoindex() {
  return <meta name="robots" content="noindex, nofollow" />
}
