"use client"

import { useState, useEffect } from "react"

const FIXED_MESSAGES = [
  "প্রদীপ কুমার আচার্য্যের নতুন উপন্যাস — ছেঁড়া পুষ্প — এখন উপলব্ধ",
  "সকল বইয়ে ডেমো পড়ার সুযোগ",
]

export default function AnnouncementBar() {
  const [messages, setMessages] = useState(FIXED_MESSAGES)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const promo = data.promo_banner_text
        if (promo) {
          setMessages([promo, ...FIXED_MESSAGES])
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [messages.length])

  return (
    <div className="announcement-bar" role="status" aria-live="polite">
      {messages[index]}
    </div>
  )
}
