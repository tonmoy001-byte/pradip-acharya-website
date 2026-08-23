"use client"

import { useState, useEffect } from "react"

const MESSAGES = [
  "প্রদীপ কুমার আচার্য্যের নতুন উপন্যাস — ছেঁড়া পুষ্প — এখন উপলব্ধ",
  "৭৫০ টাকার বেশি অর্ডারে বিনামূল্যে ডেলিভারি",
  "সকল বইয়ে ডেমো পড়ার সুযোগ",
]

export default function AnnouncementBar() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % MESSAGES.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="announcement-bar" role="status" aria-live="polite">
      {MESSAGES[index]}
    </div>
  )
}
