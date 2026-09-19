"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import Link from "next/link"

export default function LoginPage() {
  const [tab, setTab] = useState<"signin" | "signup">("signin")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { signIn, signUp, user, loading } = useAuth()
  const router = useRouter()

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.push("/")
    }
  }, [user, loading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setMessage("")
    setSubmitting(true)

    try {
      if (tab === "signin") {
        const result = await signIn(email, password)
        if (result.error) {
          setError(result.error)
        } else {
          router.push("/")
        }
      } else {
        if (password !== confirmPassword) {
          setError("পাসওয়ার্ড মিলছে না")
          setSubmitting(false)
          return
        }
        if (password.length < 6) {
          setError("পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে")
          setSubmitting(false)
          return
        }
        const result = await signUp(email, password, name || undefined)
        if (result.error) {
          setError(result.error)
        } else if (result.requireEmailVerification) {
          // Save email and name for the verify page
          localStorage.setItem("pending_verification_email", email)
          if (name) localStorage.setItem("pending_verification_name", name)
          router.push(`/verify?email=${encodeURIComponent(email)}`)
        } else if (result.message) {
          setMessage(result.message)
          setTab("signin")
          setPassword("")
          setConfirmPassword("")
        }
      }
    } catch {
      setError("একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container section-padding" style={{ maxWidth: 480, marginInline: "auto" }}>
      <div className="page-header">
        <h1>অ্যাকাউন্ট</h1>
      </div>

      <div style={{ display: "flex", gap: "var(--sp-4)", marginBottom: "var(--sp-8)", justifyContent: "center" }}>
        <button
          className={`filter-pill ${tab === "signin" ? "active" : ""}`}
          onClick={() => { setTab("signin"); setError(""); setMessage("") }}
        >
          সাইন ইন
        </button>
        <button
          className={`filter-pill ${tab === "signup" ? "active" : ""}`}
          onClick={() => { setTab("signup"); setError(""); setMessage("") }}
        >
          অ্যাকাউন্ট তৈরি করুন
        </button>
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
        {tab === "signup" && (
          <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
            <label className="form-label" htmlFor="auth-name">নাম</label>
            <input
              id="auth-name"
              className="form-input"
              style={{ width: "100%" }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
        )}

        <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
          <label className="form-label" htmlFor="auth-email">ইমেইল</label>
          <input
            id="auth-email"
            type="email"
            className="form-input"
            style={{ width: "100%" }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
          <label className="form-label" htmlFor="auth-password">পাসওয়ার্ড</label>
          <input
            id="auth-password"
            type="password"
            className="form-input"
            style={{ width: "100%" }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={tab === "signin" ? "current-password" : "new-password"}
          />
        </div>

        {tab === "signup" && (
          <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
            <label className="form-label" htmlFor="auth-confirm">পাসওয়ার্ড নিশ্চিত করুন</label>
            <input
              id="auth-confirm"
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
        )}

        {tab === "signin" && (
          <div style={{ textAlign: "right", marginBottom: "var(--sp-6)" }}>
            <Link href="/forgot-password" style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
              পাসওয়ার্ড ভুলে গেছেন?
            </Link>
          </div>
        )}

        {tab === "signup" && <div style={{ marginBottom: "var(--sp-6)" }} />}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%" }}
          disabled={submitting}
        >
          {submitting
            ? "অপেক্ষা করুন..."
            : tab === "signin"
              ? "সাইন ইন"
              : "অ্যাকাউন্ট তৈরি করুন"}
        </button>
      </form>

      {tab === "signin" && (
        <div style={{ textAlign: "center", marginTop: "var(--sp-4)" }}>
          <Link href="/verify" style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
            ইমেইল যাচাই করতে চান?
          </Link>
        </div>
      )}
    </div>
  )
}
