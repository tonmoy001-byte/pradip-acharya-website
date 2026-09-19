"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth"

interface ProfileData {
  full_name: string | null
  email: string | null
  email_verified: boolean | null
  created_at: string | null
}

export default function AccountProfilePage() {
  const { user, loading: authLoading, refreshProfile } = useAuth()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [formName, setFormName] = useState("")

  useEffect(() => {
    if (authLoading || !user) return

    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile", { credentials: "include" })
        const json = await res.json()

        if (!res.ok) {
          // Don't show error if we have basic data from AuthProvider
          if (user?.email) {
            setProfile({
              full_name: user.name || null,
              email: user.email,
              email_verified: null,
              created_at: null,
            })
          } else {
            setError(json.error || "প্রোফাইল লোড করা যায়নি")
          }
          return
        }

        const data = json.data
        if (data) {
          setProfile({
            full_name: data.display_name || data.full_name || null,
            email: data.email || user?.email || null,
            email_verified: data.email_verified ?? null,
            created_at: data.created_at || null,
          })
            setFormName(data.display_name || data.full_name || "")
        }
      } catch {
        // Don't show error if we have basic data from AuthProvider
        if (user?.email) {
          setProfile({
            full_name: user.name || null,
            email: user.email,
            email_verified: null,
            created_at: null,
          })
        } else {
          setError("প্রোফাইল লোড করা যায়নি")
        }
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [user, authLoading])

  function handleEdit() {
    setEditing(true)
    setError("")
    setSuccess("")
  }

  function handleCancel() {
    setEditing(false)
    setError("")
    setSuccess("")
    setFormName(profile?.full_name || "")
  }

  async function handleSave() {
    setSaving(true)
    setError("")
    setSuccess("")

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          full_name: formName.trim() || null,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || "সংরক্ষণ করা যায়নি")
        return
      }

      setProfile((prev) => ({
        full_name: formName.trim() || null,
        email: prev?.email ?? null,
        email_verified: prev?.email_verified ?? null,
        created_at: prev?.created_at ?? null,
      }))
      setEditing(false)
      setSuccess("প্রোফাইল আপডেট হয়েছে")
      await refreshProfile()
    } catch {
      setError("সংরক্ষণ করা যায়নি")
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div>
        <div className="page-header">
          <h1>প্রোফাইল</h1>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: "var(--radius-lg)" }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header" style={{ paddingBottom: "var(--sp-4)" }}>
        <h1>প্রোফাইল</h1>
        <p style={{ color: "var(--ink-muted)", marginTop: "var(--sp-2)" }}>
          আপনার ব্যক্তিগত তথ্য পরিচালনা করুন
        </p>
      </div>

      {/* Messages */}
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

      <div className="card" style={{ padding: "var(--sp-6)" }}>
        {/* View Mode */}
        {!editing && (
          <div>
            {/* Full Name */}
            <div style={{ marginBottom: "var(--sp-5)" }}>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--stone)",
                  marginBottom: "var(--sp-1)",
                }}
              >
                পূর্ণ নাম
              </p>
              <p style={{ fontSize: "1rem", fontWeight: "var(--font-weight-medium)" }}>
                {profile?.full_name || "নির্ধারিত হয়নি"}
              </p>
            </div>

            {/* Email */}
            <div style={{ marginBottom: "var(--sp-5)" }}>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--stone)",
                  marginBottom: "var(--sp-1)",
                }}
              >
                ইমেইল
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
                <p style={{ fontSize: "1rem", fontWeight: "var(--font-weight-medium)" }}>
                  {profile?.email || user?.email}
                </p>
                {profile?.email_verified === true && (
                  <span
                    className="badge badge-green"
                    style={{ fontSize: "0.6875rem" }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ marginRight: 3 }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    যাচাইকৃত
                  </span>
                )}
                {profile?.email_verified === false && (
                  <span
                    className="badge"
                    style={{
                      fontSize: "0.6875rem",
                      background: "rgba(196, 112, 75, 0.1)",
                      color: "var(--terracotta)",
                    }}
                  >
                    যাচাইকৃত নয়
                  </span>
                )}
              </div>
            </div>

            {/* Account Created */}
            {profile?.created_at && (
              <div style={{ marginBottom: "var(--sp-5)" }}>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--stone)",
                    marginBottom: "var(--sp-1)",
                  }}
                >
                  অ্যাকাউন্ট তৈরি
                </p>
                <p style={{ fontSize: "1rem", fontWeight: "var(--font-weight-medium)" }}>
                  {new Date(profile.created_at).toLocaleDateString("bn-BD", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            )}

            {/* Edit Button */}
            <div style={{ marginTop: "var(--sp-6)" }}>
              <button onClick={handleEdit} className="btn btn-primary">
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
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                তথ্য সম্পাদনা করুন
              </button>
            </div>
          </div>
        )}

        {/* Edit Mode */}
        {editing && (
          <div>
            {/* Full Name */}
            <div className="form-group" style={{ marginBottom: "var(--sp-5)" }}>
              <label className="form-label" htmlFor="edit-name">
                পূর্ণ নাম
              </label>
              <input
                id="edit-name"
                type="text"
                className="form-input"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="আপনার পূর্ণ নাম লিখুন"
              />
            </div>

            {/* Email (read-only) */}
            <div className="form-group" style={{ marginBottom: "var(--sp-5)" }}>
              <label className="form-label" htmlFor="edit-email">
                ইমেইল
              </label>
              <input
                id="edit-email"
                type="email"
                className="form-input"
                value={profile?.email || user?.email || ""}
                readOnly
                style={{ opacity: 0.7, cursor: "not-allowed" }}
              />
              <p style={{ fontSize: "0.75rem", color: "var(--stone)", marginTop: "var(--sp-1)" }}>
                ইমেইল ঠিকানা পরিবর্তন করা যায় না
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
              <button
                onClick={handleSave}
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
                    সংরক্ষণ হচ্ছে...
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
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    সংরক্ষণ করুন
                  </>
                )}
              </button>
              <button onClick={handleCancel} className="btn btn-secondary">
                বাতিল
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
