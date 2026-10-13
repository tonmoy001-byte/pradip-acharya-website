"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import SeoNoindex from "@/components/SeoNoindex"

interface DownloadGrant {
  id: string
  order_id: string
  book_title: string | null
  revoked_at: string | null
}

const DL_ERROR_MESSAGES: Record<string, string> = {
  not_found: "ডাউনলোড লিংক পাওয়া যায়নি বা অনুমতি নেই।",
  not_paid: "এই অর্ডারের পেমেন্ট এখনো নিশ্চিত হয়নি।",
  revoked: "এই ডাউনলোড লিংকটি বাতিল করা হয়েছে।",
  no_file: "এই অর্ডারে কোনো ফাইল যুক্ত করা হয়নি।",
  storage: "ফাইলটি এখন পাওয়া যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।",
}

export default function MyDownloadsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [grants, setGrants] = useState<DownloadGrant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/login")
      return
    }

    // Redirect errors from the download route (browser navigations get a
    // 303 here instead of raw JSON). Read before any state updates.
    const dlError = new URLSearchParams(window.location.search).get("dl_error")
    if (dlError && DL_ERROR_MESSAGES[dlError]) {
      setError(DL_ERROR_MESSAGES[dlError])
      const clean = `${window.location.pathname}${window.location.hash}`
      window.history.replaceState(null, "", clean)
    }

    async function fetchGrants() {
      try {
        const res = await fetch("/api/my-downloads", { credentials: "include" })
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || "ডাউনলোড তালিকা লোড করা যায়নি")
          return
        }

        setGrants(data.data || [])
      } catch {
        setError("ডাউনলোড তালিকা লোড করা যায়নি")
      } finally {
        setLoading(false)
      }
    }

    fetchGrants()
  }, [user, authLoading, router])

  if (authLoading || loading) {
    return (
      <div className="container section-padding">
        <SeoNoindex />
        <div className="page-header"><h1>আমার ডাউনলোড</h1></div>
        <p>লোড হচ্ছে...</p>
      </div>
    )
  }

  if (error && grants.length === 0) {
    return (
      <div className="container section-padding">
        <SeoNoindex />
        <div className="page-header"><h1>আমার ডাউনলোড</h1></div>
        <div role="alert" style={{ padding: "var(--sp-3) var(--sp-4)", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius)", color: "#991b1b", fontSize: "0.875rem" }}>
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="container section-padding">
      <SeoNoindex />
      <div className="page-header">
        <h1>আমার ডাউনলোড</h1>
        <p style={{ color: "var(--ink-muted)", marginTop: "var(--sp-2)" }}>
          পেমেন্ট নিশ্চিত হলে আপনার ইবুক এখানে পাবেন।
        </p>
      </div>

      {error && (
        <div role="alert" style={{ padding: "var(--sp-3) var(--sp-4)", marginBottom: "var(--sp-4)", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius)", color: "#991b1b", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}

      {grants.length === 0 ? (
        <div className="cart-empty">
          <p style={{ marginBottom: "var(--sp-6)" }}>
            আপনার কোনো ডাউনলোড নেই। পেমেন্ট নিশ্চিত হলে এখানে দেখা যাবে।
          </p>
          <Link href="/books" className="btn btn-primary">সকল বই দেখুন</Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          {grants.map((grant) => {
            const isRevoked = !!grant.revoked_at
            const canDownload = !isRevoked

            return (
              <div key={grant.id} className="cart-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: "var(--sp-3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "var(--sp-2)" }}>
                  <div>
                    <p style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.875rem" }}>
                      {grant.book_title || "ইবুক"}
                    </p>
                    <p style={{ fontSize: "0.8125rem", color: "var(--stone)" }}>
                      ফরম্যাট: ডিজিটাল ইবুক (PDF) · অর্ডার #{grant.order_id.slice(0, 8)}...
                    </p>
                  </div>
                  <div>
                    {canDownload ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--sp-1)" }}>
                        <a href={`/api/my-downloads/${grant.id}`} className="btn btn-primary" style={{ fontSize: "0.875rem" }}>
                          ইবুক ডাউনলোড
                        </a>
                        <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", textAlign: "right", maxWidth: 220 }}>
                          ডাউনলোড না হলে লিংকটি Chrome বা অন্য ব্রাউজারে খুলুন।
                        </p>
                      </div>
                    ) : (
                      <span style={{ fontSize: "0.8125rem", color: "var(--stone)" }}>
                        বাতিল
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
