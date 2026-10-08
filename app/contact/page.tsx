// app/contact/page.tsx
// Two-column layout inspired by the reference: contact details on the left,
// form on the right. Uses the site's own terracotta brand palette rather than
// the reference's green Material theme — the reference is only the layout.
//
// Contact details are read from site_settings so they stay in sync with the
// admin panel. No fabricated social links: the project records none.

import type { Metadata } from "next"
import ContactForm from "@/components/ContactForm"
import { pageMetadata } from "@/lib/seo"
import { breadcrumbList } from "@/lib/structured-data"
import JsonLd from "@/components/JsonLd"
import { getCachedSiteSettings } from "@/lib/public-cache"
import { toWhatsAppUrl } from "@/lib/contact"

export const metadata: Metadata = pageMetadata({
  title: "যোগাযোগ",
  description:
    "“ছেঁড়া পুষ্প” ইবুক সংগ্রহ, পেমেন্ট বা ডাউনলোডে সমস্যা হলে প্রদীপ কুমার আচার্য্যের ওয়েবসাইটে ফর্ম পূরণ করে সরাসরি যোগাযোগ করুন।",
  path: "/contact",
  keywords: ["যোগাযোগ", "সাপোর্ট", "ইবুক সহায়তা"],
})

export default async function ContactPage() {
  const settings = await getCachedSiteSettings()
  const email = typeof settings.contact_email === "string" ? settings.contact_email.trim() : ""
  const whatsappUrl = toWhatsAppUrl(settings.contact_whatsapp)

  return (
    <div className="contact-page">
      <JsonLd
        data={breadcrumbList([
          { name: "হোম", path: "/" },
          { name: "যোগাযোগ", path: "/contact" },
        ])}
      />

      <div className="contact-grid">
        {/* Left: contact details */}
        <section className="contact-info" aria-label="যোগাযোগের তথ্য">
          <span className="contact-eyebrow">যোগাযোগ</span>
          <h1>আমাদের সাথে যোগাযোগ করুন</h1>
          <p className="contact-lede">
            “ছেঁড়া পুষ্প” ইবুক সংগ্রহ, পেমেন্ট বা ডাউনলোডে সমস্যা হলে আমাদের
            সাথে সরাসরি যোগাযোগ করুন। আপনার বার্তা সাধারণত ২৪ ঘন্টার মধ্যে
            উত্তর দেওয়া হয়।
          </p>

          <ul className="contact-details">
            {email && (
              <li>
                <span className="contact-detail-label">ইমেইল</span>
                <a href={`mailto:${email}`} className="contact-detail-value">
                  {email}
                </a>
              </li>
            )}
            {whatsappUrl && (
              <li>
                <span className="contact-detail-label">হোয়াটসঅ্যাপ</span>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-detail-value"
                >
                  হোয়াটসঅ্যাপে বার্তা পাঠান
                </a>
              </li>
            )}
          </ul>

          <div className="contact-faq" aria-label="সাধারণ প্রশ্ন">
            <h2>সাধারণ জিজ্ঞাসা</h2>
            <details>
              <summary>ইবুক ডাউনলোড কীভাবে কাজ করে?</summary>
              <p>
                পেমেন্ট সম্পন্ন হওয়ার সঙ্গে সঙ্গে ডাউনলোড লিংক সক্রিয় হয়।
                আপনার ইমেইলে একটি দীর্ঘমেয়াদী লিংক ও লাইসেন্স রসিদ পাঠানো হয়।
              </p>
            </details>
            <details>
              <summary>কোন কোন মাধ্যমে পেমেন্ট করা যায়?</summary>
              <p>
                bKash, Nagad, Rocket ও কার্ড দিয়ে পেমেন্ট করে ৫০ টাকায় সরাসরি
                ইবুক কেনা সম্ভব।
              </p>
            </details>
          </div>
        </section>

        {/* Right: form */}
        <div className="contact-form-wrap">
          <ContactForm />
        </div>
      </div>
    </div>
  )
}