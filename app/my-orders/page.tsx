"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function MyOrdersRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/account/orders")
  }, [router])
  return (
    <div className="container section-padding">
      <p>রিডাইরেক্ট হচ্ছে...</p>
    </div>
  )
}
