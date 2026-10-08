import Link from "next/link"
import PaymentBadges from "./PaymentBadges"
import { getCachedSiteSettings } from "@/lib/public-cache"
import { toWhatsAppUrl } from "@/lib/contact"

export default async function Footer() {
  let whatsappUrl: string | null = null
  try {
    const settings = await getCachedSiteSettings()
    whatsappUrl = toWhatsAppUrl(settings.contact_whatsapp)
  } catch {
    whatsappUrl = null
  }

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-about">
            <h4>প্রদীপ কুমার আচার্য্য</h4>
            <p>বাংলা সামাজিক উপন্যাসের ডিজিটাল ইবুক।</p>
          </div>
          <div className="footer-links">
            <h4>বই</h4>
            <Link href="/books">সকল বই</Link>
            <Link href="/novels">উপন্যাস</Link>
          </div>
          <div className="footer-links">
            <h4>সহায়তা</h4>
            <Link href="/contact">যোগাযোগ</Link>
            <Link href="/privacy">গোপনীয়তা নীতি</Link>
            <Link href="/refund-policy">রিফান্ড নীতি</Link>
            <Link href="/terms">শর্তাবলি</Link>
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                হোয়াটসঅ্যাপ
              </a>
            )}
          </div>
        </div>
        <hr className="divider" />
        <PaymentBadges />
        <p className="footer-copy">
          &copy; {new Date().getFullYear()} প্রদীপ কুমার আচার্য্য। সর্বস্বত্ব
          সংরক্ষিত।
        </p>
      </div>
    </footer>
  )
}
