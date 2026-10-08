// app/llms.txt/route.ts
// Plain-text site summary for LLM crawlers and assistants.

import { SITE_URL } from "@/lib/seo"

export const dynamic = "force-static"

export function GET() {
  const body = `# প্রদীপ কুমার আচার্য্য (Pradip Kumar Acharya)

> বাংলা সামাজিক উপন্যাসের ডিজিটাল ইবুক (PDF) স্টোর। Official site of Bengali author Pradip Kumar Acharya.

## Books
- [ছেঁড়া পুষ্প (Chhera Pushpo)](${SITE_URL}/book/chhera-pushpo): বাংলা সামাজিক উপন্যাস, ৯০ পৃষ্ঠা, প্রকাশক স্বরাজ প্রকাশনী, ISBN 978-984-8846-47-6, ইবুক ৳৫০

## About
- [লেখক পরিচিতি](${SITE_URL}/about)
- [যোগাযোগ](${SITE_URL}/contact)

## Policies
- [গোপনীয়তা নীতি](${SITE_URL}/privacy)
- [রিফান্ড ও ডেলিভারি নীতি](${SITE_URL}/refund-policy)
- [শর্তাবলি](${SITE_URL}/terms)
`
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
