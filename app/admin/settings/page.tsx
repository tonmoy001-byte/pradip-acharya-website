"use client"

import { useEffect, useState } from "react"

interface Setting {
  key: string
  value: any
  category: string
}

const SETTING_GROUPS = [
  {
    title: "সাধারণ",
    category: "general",
    fields: [
      { key: "site_name", label: "সাইটের নাম", type: "text" },
      { key: "site_tagline", label: "ট্যাগলাইন", type: "text" },
      { key: "contact_email", label: "ইমেইল", type: "text" },
      { key: "contact_phone", label: "ফোন", type: "text" },
    ],
  },
  {
    title: "হোমপেজ",
    category: "homepage",
    fields: [
      { key: "hero_title", label: "হিরো শিরোনাম", type: "text" },
      { key: "hero_subtitle", label: "হিরো সাবটাইটেল", type: "text" },
      { key: "promo_banner_text", label: "প্রোমো ব্যানার", type: "text" },
      { key: "footer_text", label: "ফুটার টেক্সট", type: "textarea" },
    ],
  },
  {
    title: "ডেলিভারি",
    category: "delivery",
    fields: [
      { key: "delivery_charge", label: "ডেলিভারি চার্জ (টাকা)", type: "number" },
      { key: "free_delivery_threshold", label: "বিনামূল্যে ডেলিভারির ন্যূনতম (টাকা)", type: "number" },
    ],
  },
  {
    title: "সোশ্যাল মিডিয়া",
    category: "social",
    fields: [
      { key: "social_facebook", label: "ফেসবুক", type: "text" },
      { key: "social_youtube", label: "ইউটিউব", type: "text" },
    ],
  },
]

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, any> = {}
        for (const s of d.settings || []) {
          map[s.key] = s.value
        }
        setSettings(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const updateValue = (key: string, value: string | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const settingsWithCategories: Record<string, { value: any; category: string }> = {}
      for (const group of SETTING_GROUPS) {
        for (const field of group.fields) {
          if (settings[field.key] !== undefined) {
            settingsWithCategories[field.key] = { value: settings[field.key], category: group.category }
          }
        }
      }
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: settingsWithCategories }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {}
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">সেটিংস</h1>
        </div>
        <p style={{ color: "var(--ink-muted)" }}>লোড হচ্ছে...</p>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="admin-page-title">সেটিংস</h1>
            <p className="admin-page-subtitle">সাইটের সাধারণ সেটিংস</p>
          </div>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </button>
        </div>
      </div>

      {saved && (
        <div className="admin-alert admin-alert-success" style={{ marginBottom: "var(--sp-4)" }}>
          সেটিংস সেভ হয়েছে!
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
        {SETTING_GROUPS.map((group) => (
          <div
            key={group.category}
            style={{
              background: "var(--white)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              padding: "var(--sp-5)",
            }}
          >
            <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--sp-4)" }}>{group.title}</h2>
            <div className="admin-form-grid">
              {group.fields.map((field) => (
                <div key={field.key} className="admin-form-group admin-form-span-2">
                  <label className="admin-label">{field.label}</label>
                  {field.type === "textarea" ? (
                    <textarea
                      className="admin-input admin-textarea"
                      value={settings[field.key] || ""}
                      onChange={(e) => updateValue(field.key, e.target.value)}
                      rows={3}
                    />
                  ) : field.type === "number" ? (
                    <input
                      type="number"
                      className="admin-input"
                      value={settings[field.key] ?? ""}
                      onChange={(e) => updateValue(field.key, e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  ) : (
                    <input
                      className="admin-input"
                      value={settings[field.key] || ""}
                      onChange={(e) => updateValue(field.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
