"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth"
import Link from "next/link"
import SeoNoindex from "@/components/SeoNoindex"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { resetPassword } = useAuth()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setMessage("")
    setSubmitting(true)

    try {
      const result = await resetPassword(email.trim())
      if (result.error) {
        setError(result.error)
      } else if (result.success) {
        setMessage("পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে। ইমেইল চেক করুন।")
      }
    } catch {
      setError("একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container section-padding" style={{ maxWidth: 480, marginInline: "auto" }}>
      <SeoNoindex />
      <div className="page-header">
        <h1>পাসওয়ার্ড রিসেট করুন</h1>
        <p>আপনার ইমেইল ঠিকানা প্রবেশ করুন। আমরা আপনাকে একটি রিসেট লিংক পাঠাবো।</p>
      </div>

      {error && (
        <div role="alert" style={{ padding: "var(--sp-3) var(--sp-4)", marginBottom: "var(--sp-4)", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius)", color: "#991b1b", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}

      {message && (
        <div role="status" style={{ padding: "var(--sp-3) var(--sp-4)", marginBottom: "var(--sp-4)", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "var(--radius)", color: "#166534", fontSize: "0.875rem" }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: "var(--sp-6)" }}>
          <label className="form-label" htmlFor="reset-email">ইমেইল</label>
          <input
            id="reset-email"
            type="email"
            className="form-input"
            style={{ width: "100%" }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="আপনার ইমেইল ঠিকানা"
            required
            autoComplete="email"
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%" }}
          disabled={submitting}
        >
          {submitting ? "পাঠানো হচ্ছে..." : "রিসেট লিংক পাঠান"}
        </button>
      </form>

      <div style={{ textAlign: "center", marginTop: "var(--sp-6)" }}>
        <Link href="/login" style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
          ← সাইন ইন পৃষ্ঠায় ফিরুন
        </Link>
      </div>
    </div>
  )
}
