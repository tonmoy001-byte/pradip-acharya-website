"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth"

interface Address {
  id: string
  label: string | null
  recipient_name: string
  phone: string
  address_line: string
  district: string
  upazila: string | null
  postal_code: string | null
  is_default: boolean
  created_at: string
}

interface AddressFormData {
  label: string
  recipient_name: string
  phone: string
  address_line: string
  district: string
  upazila: string
  postal_code: string
  is_default: boolean
}

const emptyForm: AddressFormData = {
  label: "বাসা",
  recipient_name: "",
  phone: "",
  address_line: "",
  district: "",
  upazila: "",
  postal_code: "",
  is_default: false,
}

function labelBadgeStyle(label: string | null) {
  if (label === "বাসা") return { background: "rgba(74, 103, 65, 0.1)", color: "var(--green)" }
  if (label === "অফিস") return { background: "rgba(59, 130, 246, 0.1)", color: "#1d4ed8" }
  return { background: "rgba(107, 114, 128, 0.08)", color: "#374151" }
}

export default function AccountAddressesPage() {
  const { user, loading: authLoading } = useAuth()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AddressFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return

    async function fetchAddresses() {
      try {
        const res = await fetch("/api/addresses", { credentials: "include" })
        const json = await res.json()

        if (!res.ok) {
          setError(json.error || "ঠিকানা লোড করা যায়নি")
          return
        }

        setAddresses(json.data || [])
      } catch {
        setError("ঠিকানা লোড করা যায়নি")
      } finally {
        setLoading(false)
      }
    }

    fetchAddresses()
  }, [user, authLoading])

  function handleAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
    setError("")
  }

  function handleEdit(address: Address) {
    setEditingId(address.id)
    setForm({
      label: address.label || "বাসা",
      recipient_name: address.recipient_name,
      phone: address.phone,
      address_line: address.address_line,
      district: address.district,
      upazila: address.upazila || "",
      postal_code: address.postal_code || "",
      is_default: address.is_default,
    })
    setShowForm(true)
    setError("")
  }

  function handleCancel() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    setError("")
  }

  async function handleSave() {
    if (!form.recipient_name.trim() || !form.phone.trim() || !form.address_line.trim() || !form.district.trim()) {
      setError("প্রয়োজনীয় তথ্য পূরণ করুন")
      return
    }

    setSaving(true)
    setError("")

    try {
      const payload = {
        label: form.label,
        recipient_name: form.recipient_name.trim(),
        phone: form.phone.trim(),
        address_line: form.address_line.trim(),
        district: form.district.trim(),
        upazila: form.upazila.trim() || null,
        postal_code: form.postal_code.trim() || null,
        is_default: form.is_default,
      }

      let res: Response
      if (editingId) {
        res = await fetch(`/api/addresses/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch("/api/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        })
      }

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || "সংরক্ষণ করা যায়নি")
        return
      }

      const listRes = await fetch("/api/addresses", { credentials: "include" })
      const listJson = await listRes.json()
      if (listRes.ok) {
        setAddresses(listJson.data || [])
      }
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
    } catch {
      setError("সংরক্ষণ করা যায়নি")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("আপনি কি এই ঠিকানাটি মুছে ফেলতে চান?")) return

    setDeletingId(id)
    try {
      const res = await fetch(`/api/addresses/${id}`, { method: "DELETE", credentials: "include" })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || "মুছে ফেলা যায়নি")
        return
      }

      setAddresses((prev) => prev.filter((a) => a.id !== id))
    } catch {
      setError("মুছে ফেলা যায়নি")
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSetDefault(id: string) {
    try {
      const res = await fetch(`/api/addresses/${id}/default`, { method: "PUT", credentials: "include" })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || "ডিফল্ট সেট করা যায়নি")
        return
      }

      setAddresses((prev) =>
        prev.map((a) => ({ ...a, is_default: a.id === id }))
      )
    } catch {
      setError("ডিফল্ট সেট করা যায়নি")
    }
  }

  if (authLoading || loading) {
    return (
      <div>
        <div className="page-header">
          <h1>সংরক্ষিত ঠিকানা</h1>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 140, borderRadius: "var(--radius-lg)" }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header" style={{ paddingBottom: "var(--sp-4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--sp-3)" }}>
          <div>
            <h1>সংরক্ষিত ঠিকানা</h1>
            <p style={{ color: "var(--ink-muted)", marginTop: "var(--sp-2)" }}>
              আপনার ডেলিভারি ঠিকানা পরিচালনা করুন
            </p>
          </div>
          {!showForm && (
            <button onClick={handleAdd} className="btn btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              নতুন ঠিকানা যোগ করুন
            </button>
          )}
        </div>
      </div>

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

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card" style={{ padding: "var(--sp-6)", marginBottom: "var(--sp-6)" }}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.125rem",
              fontWeight: "var(--font-weight-bold)",
              marginBottom: "var(--sp-5)",
            }}
          >
            {editingId ? "ঠিকানা সম্পাদনা করুন" : "নতুন ঠিকানা যোগ করুন"}
          </h2>

          {/* Label */}
          <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
            <label className="form-label" htmlFor="addr-label">লেবেল</label>
            <select
              id="addr-label"
              className="form-input"
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              style={{ fontFamily: "var(--font-body)" }}
            >
              <option value="বাসা">বাসা</option>
              <option value="অফিস">অফিস</option>
              <option value="অন্যান্য">অন্যান্য</option>
            </select>
          </div>

          {/* Recipient Name */}
          <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
            <label className="form-label" htmlFor="addr-name">প্রাপকের নাম *</label>
            <input
              id="addr-name"
              type="text"
              className="form-input"
              value={form.recipient_name}
              onChange={(e) => setForm((p) => ({ ...p, recipient_name: e.target.value }))}
              placeholder="প্রাপকের নাম লিখুন"
            />
          </div>

          {/* Phone */}
          <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
            <label className="form-label" htmlFor="addr-phone">ফোন নম্বর *</label>
            <input
              id="addr-phone"
              type="tel"
              className="form-input"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="০১XXXXXXXXX"
            />
          </div>

          {/* Address Line */}
          <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
            <label className="form-label" htmlFor="addr-line">ঠিকানা *</label>
            <input
              id="addr-line"
              type="text"
              className="form-input"
              value={form.address_line}
              onChange={(e) => setForm((p) => ({ ...p, address_line: e.target.value }))}
              placeholder="বাসা/ফ্ল্যাট নম্বর, রোড, এলাকা"
            />
          </div>

          {/* District */}
          <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
            <label className="form-label" htmlFor="addr-district">জেলা *</label>
            <input
              id="addr-district"
              type="text"
              className="form-input"
              value={form.district}
              onChange={(e) => setForm((p) => ({ ...p, district: e.target.value }))}
              placeholder="জেলা"
            />
          </div>

          {/* Upazila */}
          <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
            <label className="form-label" htmlFor="addr-upazila">উপজেলা</label>
            <input
              id="addr-upazila"
              type="text"
            className="form-input"
              value={form.upazila}
              onChange={(e) => setForm((p) => ({ ...p, upazila: e.target.value }))}
              placeholder="উপজেলা (ঐচ্ছিক)"
            />
          </div>

          {/* Postal Code */}
          <div className="form-group" style={{ marginBottom: "var(--sp-4)" }}>
            <label className="form-label" htmlFor="addr-postal">পোস্টাল কোড</label>
            <input
              id="addr-postal"
              type="text"
              className="form-input"
              value={form.postal_code}
              onChange={(e) => setForm((p) => ({ ...p, postal_code: e.target.value }))}
              placeholder="পোস্টাল কোড (ঐচ্ছিক)"
            />
          </div>

          {/* Default Checkbox */}
          <div className="form-group" style={{ marginBottom: "var(--sp-6)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", cursor: "pointer", fontSize: "0.875rem" }}>
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))}
                style={{ accentColor: "var(--terracotta)" }}
              />
              ডিফল্ট ঠিকানা হিসাবে সেট করুন
            </label>
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
              ) : "সংরক্ষণ করুন"}
            </button>
            <button onClick={handleCancel} className="btn btn-secondary">
              বাতিল
            </button>
          </div>
        </div>
      )}

      {/* Address List */}
      {addresses.length === 0 && !showForm ? (
        <div className="cart-empty">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--stone)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: "var(--sp-4)", opacity: 0.5 }}
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <p style={{ color: "var(--ink-muted)", marginBottom: "var(--sp-4)", fontSize: "1rem" }}>
            কোনো সংরক্ষিত ঠিকানা নেই
          </p>
          <button onClick={handleAdd} className="btn btn-primary">
            নতুন ঠিকানা যোগ করুন
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          {addresses.map((address) => (
            <div
              key={address.id}
              className="card"
              style={{ padding: "var(--sp-5)", position: "relative" }}
            >
              {/* Badges Row */}
              <div style={{ display: "flex", gap: "var(--sp-2)", marginBottom: "var(--sp-3)", flexWrap: "wrap" }}>
                {address.label && (
                  <span className="badge" style={labelBadgeStyle(address.label)}>
                    {address.label}
                  </span>
                )}
                {address.is_default && (
                  <span className="badge badge-green">
                    ডিফল্ট
                  </span>
                )}
              </div>

              {/* Details */}
              <p style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "var(--sp-1)" }}>
                {address.recipient_name}
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--ink-muted)", marginBottom: "var(--sp-2)" }}>
                {address.phone}
              </p>
              <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "var(--ink)" }}>
                {address.address_line}
                {address.upazila && <>, {address.upazila}</>}
                <>, {address.district}</>
                {address.postal_code && <>, {address.postal_code}</>}
              </p>

              {/* Actions */}
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  marginTop: "var(--sp-4)",
                  paddingTop: "var(--sp-3)",
                  display: "flex",
                  gap: "var(--sp-3)",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => handleEdit(address)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--terracotta)",
                    cursor: "pointer",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    padding: 0,
                    fontFamily: "inherit",
                  }}
                >
                  সম্পাদনা
                </button>
                {!address.is_default && (
                  <button
                    onClick={() => handleSetDefault(address.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--terracotta)",
                      cursor: "pointer",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      padding: 0,
                      fontFamily: "inherit",
                    }}
                  >
                    ডিফল্ট সেট করুন
                  </button>
                )}
                <button
                  onClick={() => handleDelete(address.id)}
                  disabled={deletingId === address.id}
                  style={{
                    background: "none",
                    border: "none",
                    color: deletingId === address.id ? "var(--stone)" : "#991b1b",
                    cursor: deletingId === address.id ? "not-allowed" : "pointer",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    padding: 0,
                    fontFamily: "inherit",
                  }}
                >
                  {deletingId === address.id ? "মুছে ফেলা হচ্ছে..." : "মুছে ফেলুন"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
