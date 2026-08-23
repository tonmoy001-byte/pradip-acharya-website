import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "যোগাযোগ | প্রদীপ কুমার আচার্য্য",
  description: "আমাদের সাথে যোগাযোগ করুন।",
}

export default function ContactPage() {
  return (
    <div className="container section-padding" style={{ maxWidth: 600, marginInline: "auto" }}>
      <div className="page-header">
        <h1>যোগাযোগ</h1>
      </div>

      <div style={{ lineHeight: 1.8 }}>
        <h3 style={{ marginBottom: "var(--sp-3)" }}>পাঠক সহায়তা</h3>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          বই সম্পর্কে যেকোনো প্রশ্ন বা অর্ডার সংক্রান্ত সমস্যার জন্য আমাদের সাথে
          যোগাযোগ করুন।
        </p>

        <h3 style={{ marginBottom: "var(--sp-3)" }}>অর্ডার সহায়তা</h3>
        <p style={{ marginBottom: "var(--sp-4)" }}>
          আপনার অর্ডার সম্পর্কে জানতে চাইলে অর্ডার নম্বর সহ আমাদের কাছে লিখুন।
        </p>

        <h3 style={{ marginBottom: "var(--sp-3)" }}>ইমেইল</h3>
        <p style={{ color: "var(--terracotta)" }}>info@pradeep-acharya.example.com</p>
        <p style={{ fontSize: "0.8125rem", color: "var(--stone)", marginTop: "var(--sp-2)" }}>
          [আসল ইমেইল ঠিকানা এখানে যোগ করুন]
        </p>
      </div>
    </div>
  )
}
