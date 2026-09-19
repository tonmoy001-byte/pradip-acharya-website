"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth"
import Link from "next/link"

export default function VerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { verifyEmail, resendVerification, user, loading } = useAuth()

  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [emailChecked, setEmailChecked] = useState(false)

  // Pre-fill email from URL or localStorage
  useEffect(() => {
    const emailParam = searchParams.get("email")
    if (emailParam) {
      setEmail(emailParam)
    } else {
      const saved = localStorage.getItem("pending_verification_email")
      if (saved) setEmail(saved)
    }
    setEmailChecked(true)
  }, [searchParams])

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.push("/")
    }
  }, [user, loading, router])

  // Redirect if no email available
  useEffect(() => {
    if (emailChecked && !loading && !user) {
      const emailParam = searchParams.get("email")
      const saved = localStorage.getItem("pending_verification_email")
      if (!emailParam && !saved) {
        router.push("/login")
      }
    }
  }, [emailChecked, loading, user, router, searchParams])

  function handleOtpChange(index: number, value: string) {
    if (value.length > 1) value = value.slice(-1)
    if (value && !/^\d$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    // Auto-focus next input
    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`)
      next?.focus()
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`)
      prev?.focus()
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (pasted.length === 6) {
      setOtp(pasted.split(""))
      const last = document.getElementById("otp-5")
      last?.focus()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setMessage("")

    const code = otp.join("")
    if (code.length !== 6) {
      setError("৬ অংকের কোড প্রবেশ করুন")
      return
    }
    if (!email.trim()) {
      setError("ইমেইল প্রবেশ করুন")
      return
    }

    setSubmitting(true)
    try {
      const result = await verifyEmail(email.trim(), code, localStorage.getItem("pending_verification_name") || undefined)
      if (result.error) {
        setError(result.error)
      } else if (result.success) {
        localStorage.removeItem("pending_verification_email")
        localStorage.removeItem("pending_verification_name")
        setMessage("ইমেইল যাচাই সফল হয়েছে! এখন সাইন ইন করুন।")
        setTimeout(() => router.push("/login"), 2000)
      }
    } catch {
      setError("একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    if (!email.trim()) {
      setError("ইমেইল প্রবেশ করুন")
      return
    }
    setError("")
    setMessage("")
    setResending(true)
    try {
      const result = await resendVerification(email.trim())
      if (result.error) {
        setError(result.error)
      } else if (result.success) {
        setMessage("নতুন যাচাইকরণ কোড পাঠানো হয়েছে। আপনার ইমেইল চেক করুন।")
      }
    } catch {
      setError("কোড পুনরায় পাঠাতে ব্যর্থ হয়েছে।")
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="container section-padding" style={{ maxWidth: 480, marginInline: "auto" }}>
      <div className="page-header">
        <h1>ইমেইল যাচাই করুন</h1>
        <p>আপনার ইমেইলে প্রেরিত ৬ অংকের কোড প্রবেশ করুন</p>
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
        {email && (
          <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
            <label className="form-label">ইমেইল</label>
            <div style={{ padding: "0.625rem 0.75rem", background: "#f8f9fa", border: "1px solid #e2e8f0", borderRadius: "var(--radius)", color: "#334155", fontSize: "0.9375rem" }}>
              {email}
            </div>
          </div>
        )}

        <div className="form-group" style={{ marginBottom: "var(--sp-6)" }}>
          <label className="form-label">৬ অংকের কোড</label>
          <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "center" }}>
            {otp.map((digit, i) => (
              <input
                key={i}
                id={`otp-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                onPaste={i === 0 ? handleOtpPaste : undefined}
                style={{
                  width: 48,
                  height: 56,
                  textAlign: "center",
                  fontSize: "1.25rem",
                  fontFamily: "var(--font-body)",
                  border: "2px solid #d1d5db",
                  borderRadius: "var(--radius)",
                  background: "#ffffff",
                  color: "#1a1a2e",
                  outline: "none",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#c08552"
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(192,133,82,0.15)"
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#d1d5db"
                  e.currentTarget.style.boxShadow = "none"
                }}
                autoComplete="one-time-code"
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%" }}
          disabled={submitting}
        >
          {submitting ? "যাচাই করা হচ্ছে..." : "যাচাই করুন"}
        </button>
      </form>

      <div style={{ textAlign: "center", marginTop: "var(--sp-6)" }}>
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-primary)",
            cursor: "pointer",
            fontSize: "0.875rem",
            textDecoration: "underline",
          }}
        >
          {resending ? "পুনরায় পাঠানো হচ্ছে..." : "কোড পুনরায় পাঠান"}
        </button>
      </div>

      <div style={{ textAlign: "center", marginTop: "var(--sp-4)" }}>
        <Link href="/login" style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
          ← সাইন ইন পৃষ্ঠায় ফিরুন
        </Link>
      </div>
    </div>
  )
}
