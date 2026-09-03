"use client"

import { useEffect, useState } from "react"

export interface ToastMessage {
  id: string
  type: "success" | "error" | "info"
  text: string
}

let toastListeners: ((msg: ToastMessage) => void)[] = []

export function showToast(type: ToastMessage["type"], text: string) {
  const msg: ToastMessage = { id: crypto.randomUUID(), type, text }
  toastListeners.forEach((fn) => fn(msg))
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    function handle(msg: ToastMessage) {
      setToasts((prev) => [...prev, msg])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id))
      }, 3000)
    }
    toastListeners.push(handle)
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== handle)
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="admin-toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`admin-toast admin-toast-${t.type}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}
