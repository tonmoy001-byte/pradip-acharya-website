"use client"

// Shared admin access messaging for 401/403/500 auth outcomes.

import { useRouter } from "next/navigation"

type Kind = "forbidden" | "system"

export default function AdminAccessMessage({ kind }: { kind: Kind }) {
  const router = useRouter()

  if (kind === "forbidden") {
    return (
      <div
        className="admin-page"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: "var(--sp-4)",
        }}
      >
        <h1 className="admin-page-title">অনুমতি নেই</h1>
        <p style={{ color: "var(--ink-muted)", maxWidth: 420 }}>
          আপনি সাইন ইন করেছেন, কিন্তু অ্যাডমিন প্যানেল দেখার অনুমতি আপনার নেই।
        </p>
        <div style={{ display: "flex", gap: "var(--sp-3)" }}>
          <button className="btn btn-secondary" onClick={() => router.replace("/")}>
            হোমে ফিরে যান
          </button>
          <button className="btn btn-primary" onClick={() => router.replace("/login")}>
            অন্য অ্যাকাউন্টে সাইন ইন
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="admin-page"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: "var(--sp-4)",
      }}
    >
      <h1 className="admin-page-title">সিস্টেম ত্রুটি</h1>
      <p style={{ color: "var(--ink-muted)", maxWidth: 420 }}>
        সার্ভারে সমস্যা হয়েছে। আপনি লগআউট করা হয়নি — অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।
      </p>
      <button className="btn btn-primary" onClick={() => window.location.reload()}>
        আবার চেষ্টা করুন
      </button>
    </div>
  )
}
