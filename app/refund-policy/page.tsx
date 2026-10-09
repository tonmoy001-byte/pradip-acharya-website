// OWNER REVIEW REQUIRED before relying on this text — legal-adjacent text.
// The refund window is a TODO(owner) business decision; the delivery flow
// (download grants after verified payment, manual admin approval path) matches
// the actual code.

import type { Metadata } from "next"
import { pageMetadata } from "@/lib/seo"
import { breadcrumbList } from "@/lib/structured-data"
import JsonLd from "@/components/JsonLd"

export const metadata: Metadata = pageMetadata({
  title: "রিফান্ড ও ডেলিভারি নীতি",
  description:
    "ইবুক ডাউনলোড কখন ও কীভাবে পাবেন, পেমেন্ট সফল হলেও লিংক না পেলে কী করবেন, এবং কোন ক্ষেত্রে রিফান্ড প্রযোজ্য — বিস্তারিত জানুন।",
  path: "/refund-policy",
  keywords: ["রিফান্ড নীতি", "ডেলিভারি", "ডাউনলোড সমস্যা"],
})

const LAST_UPDATED = "২৮ সেপ্টেম্বর ২০২৬"

export default function RefundPolicyPage() {
  return (
    <div className="container section-padding" style={{ maxWidth: 700, marginInline: "auto" }}>
      <JsonLd
        data={breadcrumbList([
          { name: "হোম", path: "/" },
          { name: "রিফান্ড ও ডেলিভারি নীতি", path: "/refund-policy" },
        ])}
      />
      <div className="page-header">
        <h1>রিফান্ড ও ডেলিভারি নীতি</h1>
        <p style={{ color: "var(--stone)", fontSize: "0.875rem" }}>
          সর্বশেষ হালনাগাদ: {LAST_UPDATED}
        </p>
      </div>

      <div style={{ lineHeight: 1.8, color: "var(--ink-muted)" }}>
        <h2 style={{ marginBottom: "var(--sp-3)" }}>ডেলিভারি: ডাউনলোড লিংক কখন পাবেন</h2>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          পেমেন্ট সফলভাবে যাচাই হওয়ার সঙ্গে সঙ্গে আপনার “আমার ডাউনলোড” পাতায়
          ইবুকের (PDF) ডাউনলোড লিংক সক্রিয় হয়ে যায়। কিছু পেমেন্টে অ্যাডমিন
          যাচাই করে লিংক সক্রিয় করেন — তখন কিছুটা সময় লাগতে পারে। কোনো কুরিয়ার
          বা ভৌত ডেলিভারি নেই — সব বই ডিজিটাল।
        </p>

        <h2 style={{ marginBottom: "var(--sp-3)" }}>
          পেমেন্ট সফল হলেও লিংক না পেলে কী করবেন
        </h2>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          প্রথমে “আমার ডাউনলোড” পাতাটি রিফ্রেশ করে দেখুন। তবু লিংক না পেলে
          পেমেন্টের ট্রানজেকশন আইডিসহ <a href="/contact">যোগাযোগ ফর্মে</a>{" "}
          বার্তা পাঠান — সাধারণত ২৪ ঘণ্টার মধ্যে সমাধান দেওয়া হয়।
        </p>

        <h2 style={{ marginBottom: "var(--sp-3)" }}>রিফান্ডের শর্ত</h2>
        <p>
          {/* TODO(owner): রিফান্ডের সময়সীমা ও শর্ত এখানে লিখুন (যেমন: ডাউনলোড না হলে ৭ দিনের মধ্যে সম্পূর্ণ রিফান্ড; ডাউনলোড হয়ে গেলে রিফান্ড প্রযোজ্য নয়)। */}
          একই অর্ডারে ভুলবশত দুবার পেমেন্ট হলে অতিরিক্ত পেমেন্ট ফেরত দেওয়া হয়।
          ডিজিটাল পণ্যের স্বভাবের কারণে ফাইল ডাউনলোড হয়ে যাওয়ার পর সাধারণত
          রিফান্ড প্রযোজ্য হয় না।
        </p>
      </div>
    </div>
  )
}
