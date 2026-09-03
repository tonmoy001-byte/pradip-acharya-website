// components/admin/RejectModal.tsx
"use client"

import { useState } from "react"
import { money } from "@/lib/format"

interface RejectModalProps {
  orderId: string
  orderTotal: number
  customerName: string
  onConfirm: (reason: string) => Promise<void>
  onCancel: () => void
}

export default function RejectModal({
  orderId,
  orderTotal,
  customerName,
  onConfirm,
  onCancel,
}: RejectModalProps) {
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm(reason)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={onCancel}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="admin-modal-title">অর্ডার বাতিল করুন</h3>

        <div className="admin-modal-body">
          <div className="admin-modal-info-row">
            <span>অর্ডার</span>
            <span>#{orderId.slice(0, 8)}...</span>
          </div>
          <div className="admin-modal-info-row">
            <span>গ্রাহক</span>
            <span>{customerName || "নাম নেই"}</span>
          </div>
          <div className="admin-modal-info-row">
            <span>মোট</span>
            <span style={{ fontWeight: 600 }}>{money(orderTotal)}</span>
          </div>

          <label className="admin-modal-label">
            কারণ (ঐচ্ছিক)
          </label>
          <textarea
            className="admin-modal-input"
            placeholder="বাতিলের কারণ লিখুন..."
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="admin-modal-actions">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            বাতিল
          </button>
          <button
            className="btn btn-primary"
            style={{ background: "#991b1b", borderColor: "#991b1b" }}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "বাতিল হচ্ছে..." : "বাতিল করুন"}
          </button>
        </div>
      </div>
    </div>
  )
}
