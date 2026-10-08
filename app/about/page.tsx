import type { Metadata } from "next"
import Image from "next/image"
import ScrollReveal from "@/components/ScrollReveal"
import { getCachedSiteSettings } from "@/lib/public-cache"
import { toWhatsAppUrl } from "@/lib/contact"
import Link from "next/link"
import { absoluteUrl, AUTHOR_OG_IMAGE, pageMetadata } from "@/lib/seo"
import { authorPerson, breadcrumbList } from "@/lib/structured-data"
import JsonLd from "@/components/JsonLd"

export const metadata: Metadata = pageMetadata({
  title: "প্রদীপ কুমার আচার্য্য — বাংলা লেখক ও ঔপন্যাসিক",
  description:
    "প্রদীপ কুমার আচার্য্য একজন বাংলা লেখক ও ঔপন্যাসিক। তাঁর জীবন, সাহিত্যকর্ম এবং “ছেঁড়া পুষ্প” উপন্যাস সম্পর্কে জানুন।",
  path: "/about",
  image: AUTHOR_OG_IMAGE,
  imageAlt: "প্রদীপ কুমার আচার্য্য, বাংলা লেখক",
  keywords: ["প্রদীপ কুমার আচার্য্য", "বাংলা লেখক", "ঔপন্যাসিক", "লেখক পরিচিতি"],
})

const facts = [
  { label: "জন্ম", value: "৪ ডিসেম্বর ১৯৮৬, লক্ষ্মীপুর জেলার কল্যাণপুর গ্রামে" },
  { label: "পিতা", value: "দ্বিজেন্দ্র লাল আচার্য্য" },
  { label: "মাতা", value: "মীরা রানী আচার্য্য" },
]

export default async function AboutPage() {
  const settings = await getCachedSiteSettings()
  const whatsappUrl = toWhatsAppUrl(settings.contact_whatsapp)

  return (
    <div className="container section-padding about-page" style={{ maxWidth: 1000, marginInline: "auto" }}>
      {/* Person data mirrors only what is printed on this page — birth date and
          place, parents, profession, and the one published novel. No awards,
          reviews or invented credentials, and no `sameAs` because the project
          records no verified social profile URLs. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              ...authorPerson({
                name: "প্রদীপ কুমার আচার্য্য",
                birthDate: "1986-12-04",
                birthPlace: "কল্যাণপুর গ্রাম, লক্ষ্মীপুর জেলা, বাংলাদেশ",
                father: "দ্বিজেন্দ্র লাল আচার্য্য",
                mother: "মীরা রানী আচার্য্য",
                // Derived from the education and literary-work sections below.
                knowsAbout: ["বাংলা সাহিত্য", "উপন্যাস", "সামাজিক উপন্যাস"],
              }),
              authorOf: [
                {
                  "@type": "Book",
                  "@id": `${absoluteUrl("/book/chhera-pushpo")}#book`,
                  name: "ছেঁড়া পুষ্প",
                  url: absoluteUrl("/book/chhera-pushpo"),
                },
              ],
            },
            breadcrumbList([
              { name: "হোম", path: "/" },
              { name: "লেখক পরিচিতি", path: "/about" },
            ]),
          ],
        }}
      />

      <div className="page-header about-header">
        <h1>প্রদীপ কুমার আচার্য্য — বাংলা লেখক ও ঔপন্যাসিক</h1>
        <p>বাংলা সাহিত্যের এক অনন্য কণ্ঠ</p>
      </div>

      <div className="about-grid">
        <ScrollReveal className="about-photo-col">
          <figure className="about-photo">
            <div className="about-photo-frame">
              <Image
                src="/images/author.png"
                alt="প্রদীপ কুমার আচার্য্য"
                width={720}
                height={960}
                sizes="(max-width: 720px) 100vw, 420px"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                priority
              />
            </div>
            <div className="about-contact">
              {whatsappUrl && (
                <a
                  className="about-contact-btn about-contact-whatsapp"
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="হোয়াটসঅ্যাপে বার্তা পাঠান"
                  title="হোয়াটসঅ্যাপে বার্তা পাঠান"
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                </a>
              )}
              <Link
                href="/contact"
                className="about-contact-btn about-contact-email"
                aria-label="যোগাযোগ ফর্ম"
                title="যোগাযোগ ফর্ম"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
              </Link>
            </div>
            <figcaption>প্রদীপ কুমার আচার্য্য</figcaption>
          </figure>
        </ScrollReveal>

        <div className="about-content">
          <ScrollReveal>
            <h2>প্রদীপ কুমার আচার্য্য</h2>
            <p className="about-lead">
              প্রদীপ কুমার আচার্য্য বাংলা সাহিত্যের একজন উল্লেখযোগ্য লেখক। তাঁর
              লেখায় জীবনের গভীরতা, মানবিক অনুভূতি এবং সমসাময়িক বাস্তবতার ছাপ
              ফুটে ওঠে।
            </p>
          </ScrollReveal>

          <ScrollReveal>
            <div className="about-facts">
              {facts.map((fact) => (
                <div key={fact.label} className="about-fact">
                  <span className="about-fact-label">{fact.label}</span>
                  <span className="about-fact-value">{fact.value}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <section className="about-block">
              <h3>শিক্ষা</h3>
              <p>
                লক্ষ্মীপুরের রূপাচরা সফিউল্ল্যা উচ্চ বিদ্যালয় থেকে মাধ্যমিক,
                জনতা ডিগ্রী কলেজ থেকে উচ্চ মাধ্যমিক, চৌমুহনী সরকারি এস এ কলেজ
                থেকে স্নাতক সম্পন্ন করেন এবং কুমিল্লা ভিক্টোরিয়া সরকারি কলেজ
                থেকে স্নাতকোত্তর সম্পন্ন করেন।
              </p>
            </section>
          </ScrollReveal>

          <ScrollReveal>
            <section className="about-block">
              <h3>সাহিত্যকর্ম</h3>
              <p>
                তাঁর উল্লেখযোগ্য সৃষ্টির মধ্যে &ldquo;ছেঁড়া পুষ্প&rdquo; একটি। এই
                উপন্যাসে স্মৃতি ও বর্তমানের এক অনন্য মিলন ঘটেছে।
              </p>
            </section>
          </ScrollReveal>
        </div>
      </div>

      <style>{`
        .about-header {
          animation: fade-up 0.7s ease both;
        }
        .about-header p {
          color: var(--stone);
          margin-top: var(--sp-2);
        }
        .about-grid {
          display: grid;
          grid-template-columns: minmax(280px, 1.05fr) 1.2fr;
          gap: var(--sp-8);
          align-items: start;
        }
        .about-photo-frame {
          width: 100%;
          aspect-ratio: 3 / 4;
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1px solid var(--border);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.12);
          transition: transform 0.45s ease, box-shadow 0.45s ease;
        }
        .about-photo:hover .about-photo-frame {
          transform: translateY(-6px) scale(1.01);
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.16);
        }
        .about-photo {
          margin: 0;
          position: sticky;
          top: 96px;
          display: flex;
          flex-direction: column;
        }
        .about-photo figcaption {
          margin-top: var(--sp-3);
          text-align: center;
          font-size: 0.9375rem;
          color: var(--stone);
          animation: fade-up 0.8s ease 0.15s both;
        }
        .about-contact {
          display: flex;
          justify-content: center;
          gap: var(--sp-3);
          margin-top: var(--sp-3);
          order: 1;
          flex-wrap: wrap;
        }
        .about-contact-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          border: 1px solid transparent;
          text-decoration: none;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .about-contact-whatsapp {
          background: #075E54;
          color: #ffffff;
        }
        .about-contact-whatsapp:hover {
          background: #064E47;
        }
        .about-contact-email {
          background: transparent;
          border-color: var(--border);
          color: var(--ink);
        }
        .about-contact-email:hover {
          border-color: var(--ink);
        }
        .about-contact-btn:focus-visible {
          outline: 2px solid var(--primary, #8b1e3f);
          outline-offset: 2px;
        }
        .about-content h2 {
          margin-bottom: var(--sp-3);
          animation: fade-up 0.7s ease 0.1s both;
        }
        .about-lead {
          line-height: 1.85;
          font-size: 1.0625rem;
          margin-bottom: var(--sp-5);
        }
        .about-facts {
          display: grid;
          gap: var(--sp-3);
          margin-bottom: var(--sp-5);
          padding: var(--sp-4);
          background: var(--bg-alt);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }
        .about-fact {
          display: grid;
          grid-template-columns: 72px 1fr;
          gap: var(--sp-3);
          align-items: baseline;
        }
        .about-fact-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--primary, #8b1e3f);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .about-fact-value {
          line-height: 1.7;
        }
        .about-block {
          margin-bottom: var(--sp-5);
        }
        .about-block h3 {
          font-size: 1.125rem;
          margin-bottom: var(--sp-2);
        }
        .about-block p {
          line-height: 1.85;
        }
        @media (max-width: 720px) {
          .about-grid {
            grid-template-columns: 1fr;
            gap: var(--sp-6);
          }
          .about-photo {
            position: static;
            max-width: 360px;
            margin-inline: auto;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .about-header,
          .about-photo figcaption,
          .about-content h2 {
            animation: none;
          }
          .about-photo-frame {
            transition: none;
          }
          .about-contact-btn {
            transition: none;
          }
        }
      `}</style>
    </div>
  )
}
