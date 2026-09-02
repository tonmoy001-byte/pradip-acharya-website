"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"

interface DownloadGrant {
  id: string
  order_id: string
  max_downloads: number
  download_count: number
  expires_at: string
  revoked_at: string | null
  created_at: string
  last_downloaded_at: string | null
}

export default function MyDownloadsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [grants, setGrants] = useState<DownloadGrant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/login")
      return
    }

    async function fetchGrants() {
      try {
        const res = await fetch("/api/my-downloads", { credentials: "include" })
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || "Failed to load downloads")
          return
        }

        setGrants(data.data || [])
      } catch {
        setError("Failed to load downloads")
      } finally {
        setLoading(false)
      }
    }

    fetchGrants()
  }, [user, authLoading, router])

  async function handleDownload(grantId: string) {
    setDownloading(grantId)
    try {
      const res = await fetch(`/api/my-downloads/${grantId}`, { credentials: "include" })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Download failed")
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "ebook.pdf"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Refresh grants
      setGrants((prev) =>
        prev.map((g) =>
          g.id === grantId
            ? { ...g, download_count: g.download_count + 1, last_downloaded_at: new Date().toISOString() }
            : g,
        ),
      )
    } catch {
      alert("Download failed")
    } finally {
      setDownloading(null)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="container section-padding">
        <div className="page-header"><h1>আমার ডাউনলোড</h1></div>
        <p>লোড হচ্ছে...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container section-padding">
        <div className="page-header"><h1>আমার ডাউনলোড</h1></div>
        <div role="alert" style={{ padding: "var(--sp-3) var(--sp-4)", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius)", color: "#991b1b", fontSize: "0.875rem" }}>
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="container section-padding">
      <div className="page-header">
        <h1>আমার ডাউনলোড</h1>
      </div>

      {grants.length === 0 ? (
        <div className="cart-empty">
          <p style={{ marginBottom: "var(--sp-6)" }}>আপনার কোনো ডাউনলোড নেই।</p>
          <Link href="/books" className="btn btn-primary">সকল বই দেখুন</Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          {grants.map((grant) => {
            const isExpired = new Date(grant.expires_at) < new Date()
            const isRevoked = !!grant.revoked_at
            const isLimitReached = grant.download_count >= grant.max_downloads
            const canDownload = !isExpired && !isRevoked && !isLimitReached

            return (
              <div key={grant.id} className="cart-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: "var(--sp-3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "var(--sp-2)" }}>
                  <div>
                    <p style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.875rem" }}>
                      অর্ডার #{grant.order_id.slice(0, 8)}...
                    </p>
                    <p style={{ fontSize: "0.8125rem", color: "var(--stone)" }}>
                      ডাউনলোড: {grant.download_count}/{grant.max_downloads}
                    </p>
                    <p style={{ fontSize: "0.8125rem", color: "var(--stone)" }}>
                      মেয়াদ: {new Date(grant.expires_at).toLocaleDateString("bn-BD")}
                    </p>
                  </div>
                  <div>
                    {canDownload ? (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleDownload(grant.id)}
                        disabled={downloading === grant.id}
                        style={{ fontSize: "0.875rem" }}
                      >
                        {downloading === grant.id ? "ডাউনলোড হচ্ছে..." : "ডাউনলোড"}
                      </button>
                    ) : (
                      <span style={{ fontSize: "0.8125rem", color: "var(--stone)" }}>
                        {isExpired ? "মেয়াদোত্তীর্ণ" : isRevoked ? "বাতিল" : "সীমা শেষ"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
