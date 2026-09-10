"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const redirected = useRef(false)

  useEffect(() => {
    const originalFetch = window.fetch

    window.fetch = async (...args) => {
      const res = await originalFetch(...args)

      // If any admin API call returns 401, redirect to login once
      if ((res.status === 401 || res.status === 403) && !redirected.current) {
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url ?? ""
        if (url.includes("/api/admin") || url.includes("/api/profile")) {
          redirected.current = true
          router.replace("/login")
        }
      }

      return res
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [router])

  return <>{children}</>
}
