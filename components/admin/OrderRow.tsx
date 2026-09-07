"use client"

import { useState } from "react"
import { money } from "@/lib/format"
import { showToast } from "./Toast"
import ApproveModal from "./ApproveModal"
import RejectModal from "./RejectModal"

export interface AdminOrder {
  id: string
  payment_status: string
  fulfillment_status: string
  total: number
  contact: { name?: string; email?: string; phone?: string }
  payment_method?: string | null
  payment_reference?: string | null
  shipping_address?: { city?: string; district?: string } | null
  created_at: string
}

const PAYMENT_LABELS: Record<string, string> = {
  pending_payment: "অপেক্ষমান",
  pending_verification: "যাচাই বাকি",
  paid: "পেইড",
  refunded: "ফেরত",
  failed: "ব্যর্থ",
}

const PAYMENT_BADGE_CLASSES: Record<string, string> = {
  pending_payment: "admin-badge-admin",
  pending_verification: "admin-badge-admin",
  paid: "admin-badge-published",
  refunded: "admin-badge-draft",
  failed: "admin-badge-admin",
}

export default function OrderRow({ order }: { order: AdminOrder }) {
  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const badgeClass = PAYMENT_BADGE_CLASSES[order.payment_status] || "admin-badge-draft"

  async function handleApprove(paymentReference: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentReference }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Approval failed" }))
        throw new Error(err.error || "Approval failed")
      }
      showToast("success", "পেমেন্ট কনফার্ম হয়েছে")
      setShowApprove(false)
      window.dispatchEvent(new Event("admin-order-updated"))
    } catch (err: any) {
      showToast("error", err.message || "সমস্যা হয়েছে")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject(reason: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Reject failed" }))
        throw new Error(err.error || "Reject failed")
      }
      showToast("success", "অর্ডার বাতিল হয়েছে")
      setShowReject(false)
      window.dispatchEvent(new Event("admin-order-updated"))
    } catch (err: any) {
      showToast("error", err.message || "সমস্যা হয়েছে")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <tr className="admin-table-row">
        <td>
          <span className="admin-order-id">#{order.id.slice(0, 8)}</span>
        </td>
        <td>
          <div>{order.contact?.name || "নাম নেই"}</div>
          <div className="admin-table-subtext">{order.contact?.phone || ""}</div>
        </td>
        <td>{money(order.total)}</td>
        <td>
          <span className={`admin-badge ${badgeClass}`}>
            {PAYMENT_LABELS[order.payment_status] || order.payment_status}
          </span>
        </td>
        <td>{order.created_at ? new Date(order.created_at).toLocaleDateString("bn-BD") : "—"}</td>
        <td>
          {order.payment_status === "pending_verification" ? (
            <div className="admin-action-btns">
              <button
                className="btn btn-sm btn-primary"
                disabled={actionLoading}
                onClick={() => setShowApprove(true)}
              >
                কনফার্ম
              </button>
              <button
                className="btn btn-sm btn-secondary"
                disabled={actionLoading}
                onClick={() => setShowReject(true)}
              >
                বাতিল
              </button>
            </div>
          ) : (
            <span className="admin-no-action">—</span>
          )}
        </td>
      </tr>

      {showApprove && (
        <tr>
          <td colSpan={6}>
            <ApproveModal
              orderId={order.id}
              orderTotal={order.total}
              customerName={order.contact?.name || ""}
              onConfirm={handleApprove}
              onCancel={() => setShowApprove(false)}
            />
          </td>
        </tr>
      )}

      {showReject && (
        <tr>
          <td colSpan={6}>
            <RejectModal
              orderId={order.id}
              orderTotal={order.total}
              customerName={order.contact?.name || ""}
              onConfirm={handleReject}
              onCancel={() => setShowReject(false)}
            />
          </td>
        </tr>
      )}
    </>
  )
}
