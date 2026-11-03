"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth"
import SeoNoindex from "@/components/SeoNoindex"
import PasswordInput from "@/components/PasswordInput"
import { sendResetPasswordEmail, exchangeResetPasswordToken, resetPassword } from "@/app/actions/auth"
import { validatePassword } from "@/lib/password-policy"

function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!local || !domain) return email
  if (local.length <= 1) return `${local}***@${domain}`
  return `${local[0]}***@${domain}`
}

function passwordStrength(password: string): number {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) score++
  if (password.length >= 12 || /[^A-Za-z0-9]/.test(password)) score++
  return Math.min(score, 3)
}

export default function ChangePasswordPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [stage, setStage] = useState<"email" | "verify" | "done">("email")
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
  }, [authLoading, user, router])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function startCooldown(seconds: number) {
    setCooldown(seconds)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          timerRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  async function handleSendOtp() {
    if (!user?.email) return
    setError("")
    setMessage("")
    setSubmitting(true)
    try {
      const result = await sendResetPasswordEmail(user.email)
      if (result.error) {
        setError(result.error)
      } else {
        setMessage("OTP আপনার নিবন্ধিত ইমেইলে পাঠানো হয়েছে।")
        setStage("verify")
        startCooldown(45)
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

    const code = otp.trim()
    if (!code) {
      setError("OTP প্রবেশ করুন")
      return
    }
    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      setError(passwordError)
      return
    }

    setSubmitting(true)
    try {
      const ex = await exchangeResetPasswordToken(user!.email, code)
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
      setMessage("পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে।")
    } catch {
      setError("একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    if (cooldown > 0 || !user?.email) return
    setError("")
    setMessage("")
    setSubmitting(true)
    try {
      const result = await sendResetPasswordEmail(user.email)
      if (result.error) setError(result.error)
      else {
        setMessage("নতুন OTP পাঠানো হয়েছে।")
        startCooldown(45)
      }
    } catch {
      setError("একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।")
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="container section-padding">
        <SeoNoindex />
        <p style={{ color: "var(--ink-muted)" }}>লোড হচ্ছে...</p>
      </div>
    )
  }

  if (!user) return null

  const strength = passwordStrength(newPassword)
  const strengthColors = ["var(--border)", "var(--terracotta)", "var(--terracotta)", "var(--green)"]
  const strengthLabels = ["", "দুর্বল", "মাঝারি", "শক্তিশালী"]

  return (
    <div>
      <SeoNoindex />
      <div style={{ maxWidth: 672, margin: "0 auto" }}>
        <nav aria-label="breadcrumb" style={{ fontSize: "0.8125rem", color: "var(--ink-muted)", marginBottom: "var(--sp-2)" }}>
          অ্যাকাউন্ট / পাসওয়ার্ড পরিবর্তন
        </nav>
        <div style={{ marginBottom: "var(--sp-6)" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.3, margin: 0 }}>
            পাসওয়ার্ড পরিবর্তন
          </h1>
          <p style={{ fontSize: "0.9375rem", color: "var(--ink-muted)", marginTop: "var(--sp-1)", lineHeight: 1.6 }}>
            আপনার অ্যাকাউন্টের পাসওয়ার্ড নিরাপদে আপডেট করুন
          </p>
        </div>

        <div
          style={{
            background: "var(--white)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg, 1rem)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            padding: "var(--sp-6)",
          }}
        >
          {/* Icon + title */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--sp-4)", marginBottom: "var(--sp-5)" }}>
            <div
              aria-hidden="true"
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "rgba(196, 93, 58, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--terracotta)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: "1.0625rem", fontWeight: 600, margin: 0, lineHeight: 1.4 }}>
                আপনার পাসওয়ার্ড নিরাপদ রাখুন
              </h2>
              <p style={{ fontSize: "0.875rem", color: "var(--ink-muted)", marginTop: "var(--sp-1)", lineHeight: 1.6, maxWidth: 480 }}>
                নিরাপত্তার জন্য আমরা আপনার নিবন্ধিত ইমেইলে একটি OTP পাঠাব। সেই OTP দিয়ে নতুন পাসওয়ার্ড সেট করুন।
              </p>
            </div>
          </div>

          {/* Info strip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-2)",
              padding: "var(--sp-3) var(--sp-4)",
              background: "var(--bg-alt, rgba(0,0,0,0.03))",
              borderRadius: "var(--radius-md, 0.5rem)",
              fontSize: "0.8125rem",
              color: "var(--ink-muted)",
              marginBottom: "var(--sp-5)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>OTP আপনার নিবন্ধিত ইমেইলে পাঠানো হবে: <strong style={{ color: "var(--ink)" }}>{maskEmail(user.email)}</strong></span>
          </div>

          {/* Stepper */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-5)", fontSize: "0.8125rem", color: "var(--ink-muted)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-1)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage === "email" ? "var(--terracotta)" : "var(--border)" }} />
              ধাপ ১: OTP পাঠান
            </span>
            <span style={{ color: "var(--border)" }}>→</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-1)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage === "verify" ? "var(--terracotta)" : "var(--border)" }} />
              ধাপ ২: নতুন পাসওয়ার্ড
            </span>
          </div>

          {/* Alerts */}
          <div aria-live="polite" style={{ minHeight: "1.25rem", marginBottom: "var(--sp-4)" }}>
            {error && (
              <div role="alert" style={{ padding: "var(--sp-3) var(--sp-4)", background: "rgba(192, 57, 43, 0.06)", border: "1px solid rgba(192, 57, 43, 0.25)", borderRadius: "var(--radius-md, 0.5rem)", color: "#991b1b", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
                <span aria-hidden="true">⚠</span> {error}
              </div>
            )}
            {message && !error && (
              <div role="status" style={{ padding: "var(--sp-3) var(--sp-4)", background: "rgba(74, 103, 65, 0.08)", border: "1px solid rgba(74, 103, 65, 0.25)", borderRadius: "var(--radius-md, 0.5rem)", color: "var(--green)", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
                <span aria-hidden="true">✓</span> {message}
              </div>
            )}
          </div>

          {stage === "email" && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSendOtp}
              disabled={submitting}
              style={{ width: "100%", height: 46, borderRadius: "var(--radius-md, 0.5rem)", fontWeight: 500 }}
            >
              {submitting ? "পাঠানো হচ্ছে..." : "OTP পাঠান"}
            </button>
          )}

          {stage === "verify" && (
            <form onSubmit={handleReset}>
              <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
                <label className="form-label" htmlFor="cp-otp" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                  OTP কোড
                </label>
                <input
                  id="cp-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="form-input"
                  style={{ width: "100%", letterSpacing: "0.25em", textAlign: "center", fontSize: "1.125rem" }}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="••••••"
                  required
                  autoComplete="one-time-code"
                />
              </div>

              <div className="form-group" style={{ marginBottom: "var(--sp-3)" }}>
                <label className="form-label" htmlFor="cp-new-password" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                  নতুন পাসওয়ার্ড
                </label>
                <PasswordInput
                  id="cp-new-password"
                  value={newPassword}
                  onChange={setNewPassword}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              {/* Strength meter */}
              <div style={{ display: "flex", gap: 4, marginBottom: "var(--sp-1)" }}>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 999,
                      background: i <= strength ? strengthColors[strength] : "var(--border)",
                      transition: "background 150ms ease",
                    }}
                  />
                ))}
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginBottom: "var(--sp-5)", minHeight: "1rem" }}>
                {newPassword ? strengthLabels[strength] : "কমপক্ষে ৮ অক্ষর"}
              </p>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ width: "100%", height: 46, borderRadius: "var(--radius-md, 0.5rem)", fontWeight: 500 }}
              >
                {submitting ? "রিসেট করা হচ্ছে..." : "পাসওয়ার্ড রিসেট করুন"}
              </button>

              <div style={{ textAlign: "center", marginTop: "var(--sp-4)" }}>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={submitting || cooldown > 0}
                  style={{
                    background: "none",
                    border: "none",
                    color: cooldown > 0 ? "var(--ink-muted)" : "var(--terracotta)",
                    fontSize: "0.875rem",
                    cursor: cooldown > 0 ? "not-allowed" : "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                  }}
                >
                  {cooldown > 0 ? `আবার OTP পাঠান (${cooldown}s)` : "আবার OTP পাঠান"}
                </button>
              </div>
            </form>
          )}

          {stage === "done" && (
            <div style={{ textAlign: "center", padding: "var(--sp-4) 0" }}>
              <div
                aria-hidden="true"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(74, 103, 65, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto var(--sp-4)",
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--sp-4)" }}>পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে</p>
            </div>
          )}

          <div style={{ borderTop: "1px solid var(--border)", marginTop: "var(--sp-6)", paddingTop: "var(--sp-4)" }} />
        </div>

        <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: "var(--sp-4)", lineHeight: 1.6 }}>
          OTP পাওয়া না গেলে স্প্যাম ফোল্ডার দেখুন।
        </p>
      </div>
    </div>
  )
}
