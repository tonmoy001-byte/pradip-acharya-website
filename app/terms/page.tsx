// OWNER REVIEW REQUIRED before relying on this text — legal-adjacent text
// describing the ebook license. Matches the actual product (single PDF per
// purchase, download grants issued per paid order).

import type { Metadata } from "next"
import { pageMetadata } from "@/lib/seo"
import { breadcrumbList } from "@/lib/structured-data"
import JsonLd from "@/components/JsonLd"

export const metadata: Metadata = pageMetadata({
  title: "শর্তাবলি",
  description:
    "প্রদীপ কুমার আচার্য্যের ওয়েবসাইট থেকে ইবুক কেনার শর্তাবলি — ব্যক্তিগত ব্যবহারের লাইসেন্স, কপিরাইট ও নিষিদ্ধ ব্যবহার সম্পর্কে জানুন।",
  path: "/terms",
  keywords: ["শর্তাবলি", "লাইসেন্স", "কপিরাইট"],
})

const LAST_UPDATED = "২৮ সেপ্টেম্বর ২০২৬"

export default function TermsPage() {
  return (
    <div className="container section-padding" style={{ maxWidth: 700, marginInline: "auto" }}>
      <JsonLd
        data={breadcrumbList([
          { name: "হোম", path: "/" },
          { name: "শর্তাবলি", path: "/terms" },
        ])}
      />
      <div className="page-header">
        <h1>শর্তাবলি</h1>
        <p style={{ color: "var(--stone)", fontSize: "0.875rem" }}>
          সর্বশেষ হালনাগাদ: {LAST_UPDATED}
        </p>
      </div>

      <div style={{ lineHeight: 1.8, color: "var(--ink-muted)" }}>
        <h2 style={{ marginBottom: "var(--sp-3)" }}>লাইসেন্স: ব্যক্তিগত ব্যবহার</h2>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          প্রতিটি ইবুক (PDF) কেনা ক্রেতার ব্যক্তিগত পড়ার জন্য লাইসেন্সপ্রাপ্ত।
          ফাইলটি নিজের ডিভাইসে সংরক্ষণ করে পড়তে পারবেন।
        </p>

        <h2 style={{ marginBottom: "var(--sp-3)" }}>নিষিদ্ধ ব্যবহার</h2>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          কেনা ইবুক পুনঃবিতরণ, পুনঃবিক্রয়, প্রকাশ্যে শেয়ার বা বিনামূল্যে বিতরণ
          করা নিষেধ। অনুমতি ছাড়া বাণিজ্যিক উদ্দেশ্যে ব্যবহার করা যাবে না।
        </p>

        <h2 style={{ marginBottom: "var(--sp-3)" }}>কপিরাইট</h2>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          সব বইয়ের স্বত্ব লেখক ও প্রকাশকের সংরক্ষিত। শর্ত ভঙ্গ হলে অ্যাকাউন্ট
          ও ডাউনলোড সুবিধা বাতিল হতে পারে।
        </p>

        <h2 style={{ marginBottom: "var(--sp-3)" }}>প্রযোজ্য আইন</h2>
        <p>
          {/* TODO(owner): কোন দেশের আইন প্রযোজ্য হবে তা এখানে লিখুন। */}
          এই শর্তাবলি নিয়ে বিরোধ হলে প্রযোজ্য আইন অনুযায়ী নিষ্পত্তি হবে।
        </p>
      </div>
    </div>
  )
}
