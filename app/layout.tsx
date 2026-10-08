import type { Metadata } from "next"
import {
  Noto_Serif_Bengali,
  Noto_Sans_Bengali,
  Cormorant_Garamond,
  Inter,
} from "next/font/google"
import "./globals.css"
import { ToastProvider } from "@/components/Toast"
import { AuthProvider } from "@/lib/auth"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import AnnouncementBar from "@/components/AnnouncementBar"
import {
  absoluteUrl,
  DEFAULT_OG_IMAGE,
  SITE_LOCALE,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo"

const notoSerifBengali = Noto_Serif_Bengali({
  subsets: ["bengali"],
  variable: "--font-display",
  weight: ["400", "700"],
})

const notoSansBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-body",
  weight: ["400", "500", "700"],
})

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display-latin",
  weight: ["400", "600", "700"],
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body-latin",
  weight: ["400", "500", "600"],
})

export const metadata: Metadata = {
  // Required so every relative canonical / OG URL resolves to absolute HTTPS.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "প্রদীপ কুমার আচার্য্য | ছেঁড়া পুষ্প বাংলা উপন্যাস",
    template: "%s | প্রদীপ কুমার আচার্য্য",
  },
  description:
    "লেখক প্রদীপ কুমার আচার্য্যের বাংলা সামাজিক উপন্যাস “ছেঁড়া পুষ্প” পড়ুন ও সংগ্রহ করুন। বইটির কাহিনি, লেখক পরিচিতি এবং ইবুক কেনার তথ্য দেখুন।",
  keywords: ["ইবুক", "ডিজিটাল বই", "ই-বুক", "বাংলা সাহিত্য", "প্রদীপ কুমার আচার্য্য", "ছেঁড়া পুষ্প"],
  other: {
    "google-site-verification": "Ow2Z76OMA76Bt4_yqDVwE73osRBgtLd2NYrciIyjuQw",
  },
  openGraph: {
    title: "প্রদীপ কুমার আচার্য্য | ছেঁড়া পুষ্প বাংলা উপন্যাস",
    description:
      "লেখক প্রদীপ কুমার আচার্য্যের বাংলা সামাজিক উপন্যাস “ছেঁড়া পুষ্প” পড়ুন ও সংগ্রহ করুন। বইটির কাহিনি, লেখক পরিচিতি এবং ইবুক কেনার তথ্য দেখুন।",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    type: "website",
    images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE), width: 1200, height: 630, alt: "ছেঁড়া পুষ্প বাংলা উপন্যাসের প্রচ্ছদ" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "প্রদীপ কুমার আচার্য্য | ছেঁড়া পুষ্প বাংলা উপন্যাস",
    description:
      "লেখক প্রদীপ কুমার আচার্য্যের বাংলা সামাজিক উপন্যাস “ছেঁড়া পুষ্প” — ডিজিটাল ইবুক (PDF)।",
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
  // Deliberately no `robots` here. Indexing is the default, and hard-coding
  // `index, follow` at the root emitted a tag that then appeared alongside the
  // `noindex` on every private route, so a crawler reading the first tag saw
  // "index" on a page meant to be excluded. Private routes are excluded by the
  // `X-Robots-Tag` header in proxy.ts, which no page-level tag can
  // override or conflict with.
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="bn-BD"
      className={`${notoSerifBengali.variable} ${notoSansBengali.variable} ${cormorant.variable} ${inter.variable}`}
    >
      <body>
        <a href="#main-content" className="skip-to-content">
          মূল বিষয়বস্তুতে যান
        </a>
        <AnnouncementBar />
        <ToastProvider>
          <AuthProvider>
            <Navbar />
            <main id="main-content">{children}</main>
            <Footer />
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
