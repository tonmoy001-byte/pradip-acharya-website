"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth"
import { sendResetPasswordEmail } from "@/app/actions/auth"

export default function ChangePasswordPage() {
  const { user } = useAuth()
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle")

  async function handleSend() {
    if (!user?.email) return
    setState("sending")
    const result = await sendResetPasswordEmail(user.email)
    setState(result.error ? "error" : "sent")
  }

  return (
    <div>
      <div className="page-header" style={{ paddingBottom: "var(--sp-4)" }}>
        <h1>পাসওয়ার্ড পরিবর্তন</h1>
        <p style={{ color: "var(--ink-muted)", marginTop: "var(--sp-2)" }}>
          আপনার অ্যাকাউন্টের পাসওয়ার্ড আপডেট করুন
        </p>
      </div>

      <div className="card" style={{ padding: "var(--sp-6)", maxWidth: 480 }}>
        <p style={{ marginBottom: "var(--sp-4)", lineHeight: 1.6 }}>
          নিরাপত্তার জন্য আমরা আপনার ইমেইলে একটি কোড পাঠাব।
        </p>

        {state === "sent" && (
          <div
            role="status"
            style={{
              padding: "var(--sp-3) var(--sp-4)",
              background: "rgba(74, 103, 65, 0.08)",
              border: "1px solid rgba(74, 103, 65, 0.25)",
              borderRadius: "var(--radius-md)",
              color: "var(--green)",
              fontSize: "0.875rem",
              marginBottom: "var(--sp-6)",
            }}
          >
            ইমেইল পাঠানো হয়েছে। কোডটি দিয়ে{" "}
            <a href="/forgot-password" style={{ color: "var(--green)", fontWeight: 600 }}>
              এখানে
            </a>{" "}
            নতুন পাসওয়ার্ড দিন।
          </div>
        )}

        {state === "error" && (
          <div
            role="alert"
            style={{
              padding: "var(--sp-3) var(--sp-4)",
              background: "rgba(192, 57, 43, 0.06)",
              border: "1px solid rgba(192, 57, 43, 0.25)",
              borderRadius: "var(--radius-md)",
              color: "#991b1b",
              fontSize: "0.875rem",
              marginBottom: "var(--sp-6)",
            }}
          >
            পাঠানো যায়নি। আবার চেষ্টা করুন।
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSend}
          disabled={state === "sending" || state === "sent"}
          style={{ opacity: state === "sending" || state === "sent" ? 0.7 : 1 }}
        >
          {state === "sending" ? "পাঠানো হচ্ছে..." : "কোড পাঠান"}
        </button>
      </div>
    </div>
  )
}