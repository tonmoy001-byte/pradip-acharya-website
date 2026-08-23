import type { Metadata } from "next"
import {
  Noto_Serif_Bengali,
  Noto_Sans_Bengali,
  Cormorant_Garamond,
  Inter,
} from "next/font/google"
import "./globals.css"
import { CartProvider } from "@/lib/store"
import { ToastProvider } from "@/components/Toast"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import AnnouncementBar from "@/components/AnnouncementBar"

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
  title: "প্রদীপ কুমার আচার্য্য - ছেঁড়া পুষ্প | বাংলা সাহিত্য",
  description:
    "প্রদীপ কুমার আচার্য্যের ছেঁড়া পুষ্প — বাংলা সাহিত্যের একটি উল্লেখযোগ্য উপন্যাস।",
  openGraph: {
    title: "প্রদীপ কুমার আচার্য্য - ছেঁড়া পুষ্প",
    description: "বাংলা সাহিত্যের একটি উল্লেখযোগ্য উপন্যাস।",
    siteName: "প্রদীপ কুমার আচার্য্য",
    locale: "bn_BD",
    type: "website",
  },
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
          <CartProvider>
            <Navbar />
            <main id="main-content">{children}</main>
            <Footer />
          </CartProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
