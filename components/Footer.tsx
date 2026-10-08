import Link from "next/link"
import PaymentBadges from "./PaymentBadges"

export default function Footer() {
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
