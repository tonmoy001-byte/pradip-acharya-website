"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import SeoNoindex from "@/components/SeoNoindex"

export default function MyOrdersRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/account/orders")
  }, [router])
  return (
    <div className="container section-padding">
      <SeoNoindex />
      <p>রিডাইরেক্ট হচ্ছে...</p>
    </div>
  )
}
