"use client"

import { useState } from "react"

export default function LoginPage() {
  const [tab, setTab] = useState<"signin" | "signup">("signin")

  return (
    <div className="container section-padding" style={{ maxWidth: 480, marginInline: "auto" }}>
      <div className="page-header">
        <h1>অ্যাকাউন্ট</h1>
      </div>

      <div style={{ display: "flex", gap: "var(--sp-4)", marginBottom: "var(--sp-8)", justifyContent: "center" }}>
        <button
          className={`filter-pill ${tab === "signin" ? "active" : ""}`}
          onClick={() => setTab("signin")}
        >
          সাইন ইন
        </button>
        <button
          className={`filter-pill ${tab === "signup" ? "active" : ""}`}
          onClick={() => setTab("signup")}
        >
          অ্যাকাউন্ট তৈরি করুন
        </button>
      </div>

      {tab === "signin" ? (
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
            <label className="form-label" htmlFor="signin-email">ইমেইল</label>
            <input id="signin-email" type="email" className="form-input" style={{ width: "100%" }} />
          </div>
          <div className="form-group" style={{ marginBottom: "var(--sp-6)" }}>
            <label className="form-label" htmlFor="signin-password">পাসওয়ার্ড</label>
            <input id="signin-password" type="password" className="form-input" style={{ width: "100%" }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>সাইন ইন</button>
          <p style={{ textAlign: "center", marginTop: "var(--sp-4)", fontSize: "0.8125rem", color: "var(--stone)" }}>
            এটি একটি ডেমো ইন্টারফেস। প্রকৃত অথেনটিকেশন এখনো সক্রিয় হয়নি।
          </p>
        </form>
      ) : (
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
            <label className="form-label" htmlFor="signup-name">নাম</label>
            <input id="signup-name" className="form-input" style={{ width: "100%" }} />
          </div>
          <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
            <label className="form-label" htmlFor="signup-email">ইমেইল</label>
            <input id="signup-email" type="email" className="form-input" style={{ width: "100%" }} />
          </div>
          <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
            <label className="form-label" htmlFor="signup-password">পাসওয়ার্ড</label>
            <input id="signup-password" type="password" className="form-input" style={{ width: "100%" }} />
          </div>
          <div className="form-group" style={{ marginBottom: "var(--sp-6)" }}>
            <label className="form-label" htmlFor="signup-confirm">পাসওয়ার্ড নিশ্চিত করুন</label>
            <input id="signup-confirm" type="password" className="form-input" style={{ width: "100%" }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>অ্যাকাউন্ট তৈরি করুন</button>
          <p style={{ textAlign: "center", marginTop: "var(--sp-4)", fontSize: "0.8125rem", color: "var(--stone)" }}>
            এটি একটি ডেমো ইন্টারফেস। প্রকৃত অথেনটিকেশন এখনো সক্রিয় হয়নি।
          </p>
        </form>
      )}
    </div>
  )
}
