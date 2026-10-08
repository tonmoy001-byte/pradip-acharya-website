"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { resetPassword } from "@/app/actions/auth"
import Link from "next/link"
import SeoNoindex from "@/components/SeoNoindex"

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [token, setToken] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const status = searchParams.get("insforge_status")
    const resetToken = searchParams.get("token")
    const insforgeError = searchParams.get("insforge_error")
    const type = searchParams.get("insforge_type")

    if (insforgeError) {
      setError(insforgeError)
      return
    }

    if (type === "reset_password" && status === "ready" && resetToken) {
      setToken(resetToken)
      setReady(true)
    } else if (status === "success") {
      setMessage("পাসওয়ার্ড সফলভাবে রিসেট হয়েছে।")
      setTimeout(() => router.push("/login"), 2000)
    }
  }, [searchParams, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setMessage("")

    if (newPassword.length < 6) {
      setError("পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("পাসওয়ার্ড মিলছে না")
      return
    }
    if (!token) {
      setError("রিসেট টোকেন পাওয়া যায়নি। লিংকটি সঠিক কিনা চেক করুন।")
      return
    }

    setSubmitting(true)
    try {
      const result = await resetPassword(newPassword, token)
      if (result.error) {
        setError(result.error || "পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে")
      } else {
        setMessage("পাসওয়ার্ড সফলভাবে রিসেট হয়েছে। এখন সাইন ইন করুন।")
        setTimeout(() => router.push("/login"), 2000)
      }
    } catch {
      setError("একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।")
    } finally {
      setSubmitting(false)
    }
  }

  if (!ready && !error && !message) {
    return (
      <div className="container section-padding" style={{ maxWidth: 480, marginInline: "auto" }}>
        <div className="page-header">
          <h1>পাসওয়ার্ড রিসেট</h1>
          <p>লোড হচ্ছে...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container section-padding" style={{ maxWidth: 480, marginInline: "auto" }}>
      <SeoNoindex />
      <div className="page-header">
        <h1>নতুন পাসওয়ার্ড সেট করুন</h1>
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

      {ready && (
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
            <label className="form-label" htmlFor="new-password">নতুন পাসওয়ার্ড</label>
            <input
              id="new-password"
              type="password"
              className="form-input"
              style={{ width: "100%" }}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <div className="form-group" style={{ marginBottom: "var(--sp-6)" }}>
            <label className="form-label" htmlFor="confirm-password">পাসওয়ার্ড নিশ্চিত করুন</label>
            <input
              id="confirm-password"
              type="password"
              className="form-input"
              style={{ width: "100%" }}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={submitting}
          >
            {submitting ? "রিসেট করা হচ্ছে..." : "পাসওয়ার্ড রিসেট করুন"}
          </button>
        </form>
      )}

      <div style={{ textAlign: "center", marginTop: "var(--sp-6)" }}>
        <Link href="/login" style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
          ← সাইন ইন পৃষ্ঠায় ফিরুন
        </Link>
      </div>
    </div>
  )
}
