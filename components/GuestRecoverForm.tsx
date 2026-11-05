"use client"

import { useState } from "react"

export default function GuestRecoverForm() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/guest/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        setError("একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।")
        return
      }
      setSubmitted(true)
    } catch {
      setError("একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ padding: "var(--sp-4)", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "var(--radius)", color: "#065f46" }}>
        যদি এই ইমেইলে কোনো পরিশোধিত অর্ডার থাকে, আমরা ডাউনলোড লিংক পাঠিয়েছি। স্প্যাম ফোল্ডারও দেখুন।
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <div className="form-group">
        <label className="form-label" htmlFor="recover-email">ইমেইল</label>
        <input
          id="recover-email"
          type="email"
          required
          className="form-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>
      {error && <div style={{ color: "#991b1b", fontSize: "0.875rem" }}>{error}</div>}
      <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "fit-content" }}>
        {loading ? "পাঠানো হচ্ছে…" : "লিংক পাঠান"}
      </button>
    </form>
  )
}