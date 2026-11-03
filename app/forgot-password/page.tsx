"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import SeoNoindex from "@/components/SeoNoindex"
import PasswordInput from "@/components/PasswordInput"
import { sendResetPasswordEmail, exchangeResetPasswordToken, resetPassword } from "@/app/actions/auth"

function safeNextPath(value: string | null): string {
  if (!value) return "/login"
  if (!value.startsWith("/") || value.startsWith("//")) return "/login"
  return value
}

export default function ForgotPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = safeNextPath(searchParams.get("next"))

  const [stage, setStage] = useState<"email" | "verify" | "done">("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setMessage("")
    setSubmitting(true)

    try {
      const normalizedEmail = email.trim().toLowerCase()
      const result = await sendResetPasswordEmail(normalizedEmail)
      if (result.error) {
        setError(result.error)
      } else {
        setEmail(normalizedEmail)
        setMessage("OTP আপনার ইমেইলে পাঠানো হয়েছে। নিচে OTP ও নতুন পাসওয়ার্ড দিন।")
        setStage("verify")
      }
    } catch {
      setError("একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setMessage("")

    const normalizedEmail = email.trim().toLowerCase()
    const code = otp.trim()

    if (!code) {
      setError("OTP প্রবেশ করুন")
      return
    }
    if (newPassword.length < 8) {
      setError("পাসওয়ার্ড কমপক্ষে ৮ অক্ষর হতে হবে")
      return
    }

    setSubmitting(true)
    try {
      const ex = await exchangeResetPasswordToken(normalizedEmail, code)
      if (ex.error || !ex.token) {
        setError(ex.error || "ভুল বা মেয়াদোত্তীর্ণ OTP")
        return
      }

      const rs = await resetPassword(newPassword, ex.token)
      if (rs.error) {
        setError(rs.error)
        return
      }

      setStage("done")
      setMessage("পাসওয়ার্ড সফলভাবে রিসেট হয়েছে। এখন সাইন ইন করুন।")
      setTimeout(() => router.replace(nextPath), 2000)
    } catch {
      setError("একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setError("")
    setMessage("")
    setSubmitting(true)
    try {
      const result = await sendResetPasswordEmail(email.trim().toLowerCase())
      if (result.error) setError(result.error)
      else setMessage("নতুন OTP পাঠানো হয়েছে।")
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
        <p>আপনার ইমেইল ঠিকানা প্রবেশ করুন। আমরা আপনাকে একটি OTP পাঠাবো।</p>
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

      {stage === "email" && (
        <form onSubmit={handleSendOtp}>
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
            {submitting ? "পাঠানো হচ্ছে..." : "OTP পাঠান"}
          </button>
        </form>
      )}

      {stage === "verify" && (
        <form onSubmit={handleReset}>
          <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
            <label className="form-label" htmlFor="reset-otp">OTP</label>
            <input
              id="reset-otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              className="form-input"
              style={{ width: "100%" }}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="ইমেইলে পাওয়া ৬-সংখ্যার OTP"
              required
              autoComplete="one-time-code"
            />
          </div>

          <div className="form-group" style={{ marginBottom: "var(--sp-6)" }}>
            <label className="form-label" htmlFor="reset-new-password">নতুন পাসওয়ার্ড</label>
            <PasswordInput
              id="reset-new-password"
              value={newPassword}
              onChange={setNewPassword}
              required
              minLength={8}
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

          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: "100%", marginTop: "var(--sp-3)" }}
            disabled={submitting}
            onClick={handleResend}
          >
            OTP আবার পাঠান
          </button>
        </form>
      )}

      {stage === "done" && (
        <div role="status" style={{ padding: "var(--sp-3) var(--sp-4)", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "var(--radius)", color: "#166534", fontSize: "0.875rem" }}>
          পাসওয়ার্ড সফলভাবে রিসেট হয়েছে। এখন সাইন ইন করুন।
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: "var(--sp-6)" }}>
        <Link href="/login" style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
          ← সাইন ইন পৃষ্ঠায় ফিরে যান
        </Link>
      </div>
    </div>
  )
}
