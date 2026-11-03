"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import AdminAccessMessage from "./AdminAccessMessage"

type GuardState = "ok" | "forbidden" | "system"

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const redirected = useRef(false)
  const [state, setState] = useState<GuardState>("ok")

  useEffect(() => {
    const originalFetch = window.fetch
    const wrapped: typeof window.fetch = async (...args) => {
      const res = await originalFetch(...args)

      const input = args[0]
      const rawUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request)?.url ?? ""
      let path = ""
      try {
        path = new URL(rawUrl, window.location.origin).pathname
      } catch {
        // Relative or opaque URL — not an admin API call.
      }

      // Admin API only. /api/profile and every other surface are left
      // alone: they have their own 401 handling, and patching them here
      // would mislabel ordinary session expiry as an admin error.
      if (path.startsWith("/api/admin/")) {
        if (res.status === 401 && !redirected.current) {
          redirected.current = true
          router.replace("/login")
        } else if (res.status === 403) {
          setState((s) => (s === "ok" ? "forbidden" : s))
        } else if (res.status >= 500) {
          setState((s) => (s === "ok" ? "system" : s))
        }
      }

      return res
    }

    window.fetch = wrapped
    return () => {
      // Only undo our own patch; never clobber someone else's wrapper.
      if (window.fetch === wrapped) window.fetch = originalFetch
    }
  }, [router])

  if (state === "forbidden") return <AdminAccessMessage kind="forbidden" />
  if (state === "system") return <AdminAccessMessage kind="system" />

  return <>{children}</>
}
