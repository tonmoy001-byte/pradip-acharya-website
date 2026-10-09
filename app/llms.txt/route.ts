// app/llms.txt/route.ts
// Plain-text site summary for LLM crawlers and assistants. Book list is
// dynamic so publishing a book updates this file; on DB failure only the
// static section is served (never a 500).

import { getCachedBooks } from "@/lib/public-cache"
import { absoluteUrl, SITE_NAME } from "@/lib/seo"

export const revalidate = 3600

function oneLine(text: string, maxChars: number): string {
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat.length <= maxChars) return flat
  const cut = flat.lastIndexOf(" ", maxChars)
  return cut > 0 ? flat.slice(0, cut) : flat.slice(0, maxChars)
}

export async function GET() {
  let books: { id: string; title: string; description?: string }[] = []
  try {
    books = await getCachedBooks()
  } catch {
    books = []
  }

  const lines = [
    `# ${SITE_NAME} (Pradip Kumar Acharya)`,
    ``,
    `> বাংলা সামাজিক উপন্যাসের ডিজিটাল ইবুক (PDF)। Official site of Bengali author Pradip Kumar Acharya.`,
    ``,
    `## Books`,
    ...books.map((b) => {
      const desc = b.description ? ` — ${oneLine(b.description, 200)}` : ``
      return `- [${b.title}](${absoluteUrl(`/book/${b.id}`)})${desc}`
    }),
    ``,
    `## About`,
    `- [লেখক পরিচিতি](${absoluteUrl("/about")})`,
    `- [যোগাযোগ](${absoluteUrl("/contact")})`,
    `- [গোপনীয়তা নীতি](${absoluteUrl("/privacy")})`,
    `- [রিফান্ড ও ডেলিভারি](${absoluteUrl("/refund-policy")})`,
    `- [শর্তাবলি](${absoluteUrl("/terms")})`,
  ]
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
