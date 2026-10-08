"use client"

import { useEffect, useRef, useState } from "react"

type SubmitState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "success" }
  | { status: "error"; message: string }

export default function ContactForm() {
  const startedAtRef = useRef<number | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [website, setWebsite] = useState("") // honeypot — humans never see or fill this
  const [state, setState] = useState<SubmitState>({ status: "idle" })

  useEffect(() => {
    startedAtRef.current = Date.now()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state.status === "pending") return
    setState({ status: "pending" })

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          subject,
          message,
          website,
          startedAt: startedAtRef.current,
        }),
      })
      const data = await res.json().catch(() => null)

      if (res.ok && data?.ok) {
        setState({ status: "success" })
        setName("")
        setEmail("")
        setSubject("")
        setMessage("")
        setWebsite("")
        startedAtRef.current = Date.now()
      } else {
        setState({
          status: "error",
          message: data?.error || "পাঠানো যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।",
        })
      }
    } catch {
      setState({
        status: "error",
        message: "নেটওয়ার্ক সমস্যা হয়েছে। আবার চেষ্টা করুন।",
      })
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {state.status === "success" && (
        <div
          role="status"
          style={{
            padding: "var(--sp-3) var(--sp-4)",
            marginBottom: "var(--sp-4)",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "var(--radius)",
            color: "#166534",
            fontSize: "0.875rem",
          }}
        >
          আপনার বার্তা পাঠানো হয়েছে। ধন্যবাদ!
        </div>
      )}

      {state.status === "error" && (
        <div
          role="alert"
          style={{
            padding: "var(--sp-3) var(--sp-4)",
            marginBottom: "var(--sp-4)",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "var(--radius)",
            color: "#991b1b",
            fontSize: "0.875rem",
          }}
        >
          {state.message}
        </div>
      )}

      <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
        <label className="form-label" htmlFor="contact-name">
          নাম *
        </label>
        <input
          id="contact-name"
          className="form-input"
          style={{ width: "100%" }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
        />
      </div>

      <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
        <label className="form-label" htmlFor="contact-email">
          ইমেইল *
        </label>
        <input
          id="contact-email"
          type="email"
          className="form-input"
          style={{ width: "100%" }}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={254}
          autoComplete="email"
        />
      </div>

      <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
        <label className="form-label" htmlFor="contact-subject">
          বিষয়
        </label>
        <input
          id="contact-subject"
          className="form-input"
          style={{ width: "100%" }}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
        />
      </div>

      <div className="form-group" style={{ marginBottom: "var(--sp-6)" }}>
        <label className="form-label" htmlFor="contact-message">
          বার্তা *
        </label>
        <textarea
          id="contact-message"
          className="form-input"
          style={{ width: "100%", minHeight: 140, resize: "vertical" }}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={5000}
          rows={6}
        />
      </div>

      {/* Honeypot — off-screen, unreachable by keyboard/AT */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
        }}
      />

      <button type="submit" className="btn btn-primary" disabled={state.status === "pending"}>
        {state.status === "pending" ? "পাঠানো হচ্ছে…" : "বার্তা পাঠান"}
      </button>
    </form>
  )
}