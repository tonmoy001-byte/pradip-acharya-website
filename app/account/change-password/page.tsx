"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth"
import { updatePassword } from "@/app/actions/auth"

export default function ChangePasswordPage() {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const passwordTooShort = newPassword.length > 0 && newPassword.length < 8
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword
  const sameAsCurrent = newPassword.length > 0 && newPassword === currentPassword

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("সকল ক্ষেত্র পূরণ করুন")
      return
    }

    if (newPassword.length < 8) {
      setError("নতুন পাসওয়ার্ড অন্তত ৮ অক্ষর হতে হবে")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("নতুন পাসওয়ার্ড এবং নিশ্চিতকরণ পাসওয়ার্ড মিলছে না")
      return
    }

    if (newPassword === currentPassword) {
      setError("নতুন পাসওয়ার্ড বর্তমান পাসওয়ার্ডের থেকে আলাদা হতে হবে")
      return
    }

    setSaving(true)

    try {
      const result = await updatePassword(newPassword)

      if (result.error) {
        setError(result.error || "পাসওয়ার্ড পরিবর্তন করা যায়নি")
        return
      }

      setSuccess("পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch {
      setError("পাসওয়ার্ড পরিবর্তন করা যায়নি")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header" style={{ paddingBottom: "var(--sp-4)" }}>
        <h1>পাসওয়ার্ড পরিবর্তন</h1>
        <p style={{ color: "var(--ink-muted)", marginTop: "var(--sp-2)" }}>
          আপনার অ্যাকাউন্টের পাসওয়ার্ড আপডেট করুন
        </p>
      </div>

      {success && (
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
          {success}
        </div>
      )}

      {error && (
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
          {error}
        </div>
      )}

      <div className="card" style={{ padding: "var(--sp-6)", maxWidth: 480 }}>
        <form onSubmit={handleSubmit}>
          {/* Current Password */}
          <div className="form-group" style={{ marginBottom: "var(--sp-5)" }}>
            <label className="form-label" htmlFor="current-password">
              বর্তমান পাসওয়ার্ড
            </label>
            <input
              id="current-password"
              type="password"
              className="form-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="আপনার বর্তমান পাসওয়ার্ড লিখুন"
              autoComplete="current-password"
            />
          </div>

          {/* New Password */}
          <div className="form-group" style={{ marginBottom: "var(--sp-5)" }}>
            <label className="form-label" htmlFor="new-password">
              নতুন পাসওয়ার্ড
            </label>
            <input
              id="new-password"
              type="password"
              className="form-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="নতুন পাসওয়ার্ড লিখুন"
              autoComplete="new-password"
            />
            {passwordTooShort && (
              <p style={{ fontSize: "0.75rem", color: "#991b1b", marginTop: "var(--sp-1)" }}>
                অন্তত ৮ অক্ষর
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group" style={{ marginBottom: "var(--sp-6)" }}>
            <label className="form-label" htmlFor="confirm-password">
              পাসওয়ার্ড নিশ্চিত করুন
            </label>
            <input
              id="confirm-password"
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="নতুন পাসওয়ার্ড আবার লিখুন"
              autoComplete="new-password"
            />
            {passwordsMismatch && (
              <p style={{ fontSize: "0.75rem", color: "#991b1b", marginTop: "var(--sp-1)" }}>
                পাসওয়ার্ড মিলছে না
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ opacity: saving ? 0.7 : 1 }}
          >
            {saving ? (
              <>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "var(--white)",
                    borderRadius: "50%",
                    animation: "spin 0.6s linear infinite",
                    display: "inline-block",
                  }}
                />
                পরিবর্তন হচ্ছে...
              </>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                পাসওয়ার্ড পরিবর্তন করুন
              </>
            )}
          </button>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
