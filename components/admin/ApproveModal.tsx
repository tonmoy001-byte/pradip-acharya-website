"use client"

import { useState } from "react"
import { money } from "@/lib/format"

interface ApproveModalProps {
  orderId: string
  orderTotal: number
  customerName: string
  bkashTrxId?: string | null
  onConfirm: (paymentReference: string) => Promise<void>
  onCancel: () => void
}

export default function ApproveModal({
  orderId,
  orderTotal,
  customerName,
  bkashTrxId,
  onConfirm,
  onCancel,
}: ApproveModalProps) {
  const [paymentRef, setPaymentRef] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm(paymentRef)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={onCancel}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="admin-modal-title">পেমেন্ট কনফার্ম করুন</h3>

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
          {bkashTrxId && (
            <div className="admin-modal-info-row">
              <span>bKash TrxID</span>
              <span style={{ fontFamily: "monospace" }}>{bkashTrxId}</span>
            </div>
          )}

          <label className="admin-modal-label">
            পেমেন্ট রেফারেন্স (ঐচ্ছিক)
          </label>
          <input
            type="text"
            className="admin-modal-input"
            placeholder="e.g. manual cash, bank transfer ref..."
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
          />
        </div>

        <div className="admin-modal-actions">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            বাতিল
          </button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
            {loading ? "কনফার্ম হচ্ছে..." : "কনফার্ম করুন"}
          </button>
        </div>
      </div>
    </div>
  )
}
