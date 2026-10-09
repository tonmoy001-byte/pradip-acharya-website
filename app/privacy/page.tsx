// OWNER REVIEW REQUIRED before relying on this text — legal-adjacent text,
// written only from what the code does (checkout fields, RupantorPay redirect,
// InsForge auth/storage, Gmail SMTP contact mail, no analytics).

import type { Metadata } from "next"
import { pageMetadata, SITE_SUPPORT_EMAIL } from "@/lib/seo"
import { breadcrumbList } from "@/lib/structured-data"
import JsonLd from "@/components/JsonLd"

export const metadata: Metadata = pageMetadata({
  title: "গোপনীয়তা নীতি",
  description:
    "প্রদীপ কুমার আচার্য্যের ওয়েবসাইটে অর্ডার ও অ্যাকাউন্টের সময় কোন তথ্য সংগ্রহ ও সংরক্ষণ করা হয়, এবং তা কীভাবে ব্যবহার করা হয়, তা বিস্তারিত জানুন।",
  path: "/privacy",
  keywords: ["গোপনীয়তা নীতি", "প্রাইভেসি পলিসি", "ব্যক্তিগত তথ্য"],
})

const LAST_UPDATED = "২৮ সেপ্টেম্বর ২০২৬"

export default function PrivacyPage() {
  return (
    <div className="container section-padding" style={{ maxWidth: 700, marginInline: "auto" }}>
      <JsonLd
        data={breadcrumbList([
          { name: "হোম", path: "/" },
          { name: "গোপনীয়তা নীতি", path: "/privacy" },
        ])}
      />
      <div className="page-header">
        <h1>গোপনীয়তা নীতি</h1>
        <p style={{ color: "var(--stone)", fontSize: "0.875rem" }}>
          সর্বশেষ হালনাগাদ: {LAST_UPDATED}
        </p>
      </div>

      <div style={{ lineHeight: 1.8, color: "var(--ink-muted)" }}>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          আমরা আপনার গোপনীয়তাকে সম্মান করি। এই নীতিতে বর্ণনা করা হয়েছে আমরা
          কীভাবে আপনার তথ্য সংগ্রহ ও ব্যবহার করি।
        </p>

        <h2 style={{ marginBottom: "var(--sp-3)" }}>১. কোন তথ্য সংগ্রহ করা হয়</h2>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          অর্ডার করার সময় আমরা আপনার নাম, ইমেইল ঠিকানা ও ফোন নম্বর সংগ্রহ করি।
          অ্যাকাউন্ট খুললে আপনার লগইন ইমেইল, পছন্দের তালিকায় (wishlist) রাখা
          বই, এবং যোগাযোগ ফর্মে আপনার পাঠানো বার্তা সংরক্ষিত হয়। এই সাইটে
          কোনো শপিং কার্ট নেই — “ইবুক কিনুন” বোতামে সরাসরি অর্ডার তৈরি হয়। প্রতিটি অর্ডারের সাথে পেমেন্ট রেফারেন্স নম্বর
          (ট্রানজেকশন আইডি) সংরক্ষণ করা হয়। কার্ড নম্বর, bKash/Nagad/Rocket
          পিন বা ওয়ালেটের গোপন তথ্য এই সাইটে কখনো লেখা বা সংরক্ষণ করা হয় না —
          পেমেন্টের তথ্য সরাসরি পেমেন্ট গেটওয়ের (RupantorPay) নিরাপদ পেজে দেওয়া
          হয়।
        </p>

        <h2 style={{ marginBottom: "var(--sp-3)" }}>২. তথ্য ব্যবহারের উদ্দেশ্য</h2>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          সংগৃহীত তথ্য শুধুমাত্র অর্ডার প্রক্রিয়াকরণ, ইবুক ডাউনলোড লিংক প্রদান,
          পেমেন্ট যাচাইকরণ এবং গ্রাহক সহায়তার (সাপোর্ট) জন্য ব্যবহার করা হয়।
          মার্কেটিং উদ্দেশ্যে আপনার তথ্য তৃতীয় পক্ষের কাছে বিক্রি করা হয় না।
        </p>

        <h2 style={{ marginBottom: "var(--sp-3)" }}>৩. তৃতীয় পক্ষের সেবা</h2>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          অর্ডার সম্পন্ন করতে আপনার তথ্য প্রয়োজনে নিচের সেবাগুলোর সাথে
          ভাগ করা হয়: পেমেন্ট গেটওয়ে (অনলাইন পেমেন্ট প্রক্রিয়াকরণ), ইমেইল
          সেবা (Gmail SMTP — যোগাযোগ ফর্মের বার্তা নির্ধারিত ঠিকানায় পাঠাতে),
          এবং হোস্টিং ও ডেটাবেস সেবা (InsForge)। বর্তমানে এই সাইটে কোনো থার্ড-পার্টি অ্যানালিটিক্স
          (যেমন Google Analytics) চালু নেই।
        </p>

        <h2 style={{ marginBottom: "var(--sp-3)" }}>৪. কুকি ও লোকাল স্টোরেজ</h2>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          লগইন অবস্থা বজায় রাখতে এই সাইটে প্রয়োজনীয় সেশন কুকি ব্যবহার করা
          হয়। ইমেইল যাচাইয়ের সুবিধার জন্য ব্রাউজারের localStorage-এ সাময়িকভাবে
          আপনার ইমেইল রাখা হয়, যাচাই শেষে তা মুছে যায়। অ্যানালিটিক্স বা
          বিজ্ঞাপনী কুকি বর্তমানে ব্যবহার করা হয় না।
        </p>

        <h2 style={{ marginBottom: "var(--sp-3)" }}>৫. তথ্য সংরক্ষণের সময়কাল</h2>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          অর্ডার ও ডাউনলোডের রেকর্ড সেবা প্রদানের জন্য সংরক্ষণ করা হয়।
          {/* TODO(owner): নির্দিষ্ট তথ্য সংরক্ষণের সময়সীমা (যেমন ৩ বছর) ঠিক করে এখানে লিখুন। */}
          অ্যাকাউন্ট মুছে ফেলার অনুরোধ করলে সংশ্লিষ্ট ব্যক্তিগত তথ্য মুছে ফেলা
          হয়।
        </p>

        <h2 style={{ marginBottom: "var(--sp-3)" }}>৬. আপনার অধিকার ও যোগাযোগ</h2>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          আপনার সংরক্ষিত তথ্য দেখতে, সংশোধন করতে বা মুছে ফেলতে অনুরোধ করতে
          পারেন। অনুরোধ পাঠান:{" "}
          {SITE_SUPPORT_EMAIL ? (
            <a href={`mailto:${SITE_SUPPORT_EMAIL}`}>{SITE_SUPPORT_EMAIL}</a>
          ) : (
            <a href="/contact">যোগাযোগ ফর্ম</a>
          )}
          ।
        </p>

        <h2 style={{ marginBottom: "var(--sp-3)" }}>৭. নীতি হালনাগাদ</h2>
        <p>
          এই নীতি পরিবর্তন হলে এই পাতায় হালনাগাদের তারিখসহ প্রকাশ করা হবে।
        </p>
      </div>
    </div>
  )
}
