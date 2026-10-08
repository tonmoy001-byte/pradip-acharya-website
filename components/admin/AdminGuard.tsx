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

    window.fetch = async (...args) => {
      const res = await originalFetch(...args)

      const input = args[0]
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request)?.url ?? ""
      const isAdminApi = url.includes("/api/admin") || url.includes("/api/profile")

      if (isAdminApi) {
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

    return () => {
      window.fetch = originalFetch
    }
  }, [router])

  if (state === "forbidden") return <AdminAccessMessage kind="forbidden" />
  if (state === "system") return <AdminAccessMessage kind="system" />

  return <>{children}</>
}
