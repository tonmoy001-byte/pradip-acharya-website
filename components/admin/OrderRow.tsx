"use client"

import Link from "next/link"
import { money } from "@/lib/format"

export interface AdminOrder {
  id: string
  payment_status: string
  total: number
  contact: { name?: string; email?: string; phone?: string }
  payment_method?: string | null
  payment_reference?: string | null
  created_at: string
}

const PAYMENT_LABELS: Record<string, string> = {
  pending_payment: "অপেক্ষমান",
  pending_verification: "যাচাই বাকি", // legacy: manual-verification era
  payment_review: "পেমেন্ট নিশ্চিত হচ্ছে",
  paid: "পেইড",
  refunded: "ফেরত",
  failed: "ব্যর্থ",
}

const PAYMENT_BADGE_CLASSES: Record<string, string> = {
  pending_payment: "admin-badge-admin",
  pending_verification: "admin-badge-admin",
  payment_review: "admin-badge-admin",
  paid: "admin-badge-published",
  refunded: "admin-badge-draft",
  failed: "admin-badge-admin",
}

export default function OrderRow({ order }: { order: AdminOrder }) {
  const badgeClass = PAYMENT_BADGE_CLASSES[order.payment_status] || "admin-badge-draft"

  return (
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
        <div className="admin-action-btns">
          <Link
            href={`/admin/orders/${order.id}`}
            className="btn btn-sm btn-secondary"
          >
            বিস্তারিত
          </Link>
        </div>
      </td>
    </tr>
  )
}