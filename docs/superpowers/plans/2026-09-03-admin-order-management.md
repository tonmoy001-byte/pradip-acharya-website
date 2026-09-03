# Admin Order Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal admin panel with sidebar layout, order stats, orders table with filters, approve/reject modals, and auto-grant digital delivery on approval.

**Architecture:** Reuse the existing `account-layout` CSS sidebar pattern for the admin sidebar. Rewrite `app/admin/orders/page.tsx` to include stats cards, expandable order rows, and modal-based approve/reject. Add a stats API route. Modify the `approve_order_payment` RPC to auto-grant downloads for digital items.

**Tech Stack:** Next.js 16 App Router, TypeScript, CSS (no Tailwind), InsForge SDK (`@insforge/sdk`), InsForge PostgreSQL RPCs

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `app/admin/layout.tsx` | Create | Admin layout with sidebar (client component) |
| `app/admin/page.tsx` | Create | Redirect to `/admin/orders` |
| `app/admin/orders/page.tsx` | Rewrite | Stats + orders table + modals |
| `app/api/admin/stats/route.ts` | Create | Dashboard stats API |
| `components/admin/ApproveModal.tsx` | Create | Approve confirmation modal |
| `components/admin/RejectModal.tsx` | Create | Reject confirmation modal |
| `components/admin/Toast.tsx` | Create | Toast notification system |
| `components/admin/OrderRow.tsx` | Create | Expandable order row component |
| `app/globals.css` | Modify | Add admin-specific styles |

---

### Task 0: Fix Approve Route to Accept Optional Payment Reference

**Files:**
- Modify: `app/api/admin/orders/[orderId]/approve/route.ts`

- [ ] **Step 1: Update approve route to accept optional payment reference**

Replace the `if (!paymentReference)` check with a softer approach:

```typescript
// app/api/admin/orders/[orderId]/approve/route.ts
// POST: Admin approves payment for an order.

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

type RouteParams = { params: Promise<{ orderId: string }> }

export async function POST(req: Request, { params }: RouteParams) {
  try {
    await requireAdmin()

    const client = await createServerClient()
    const { orderId } = await params
    const body = await req.json()
    const { paymentReference } = body

    const { data, error } = await client.database.rpc("approve_order_payment", {
      p_order_id: orderId,
      p_payment_reference: paymentReference || null,
    })

    if (error) {
      return NextResponse.json({ error: error.message || "Approval failed" }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/orders/[orderId]/approve/route.ts
git commit -m "fix(admin): accept optional payment reference in approve route"
```

---

### Task 1: Stats API Route

**Files:**
- Create: `app/api/admin/stats/route.ts`

- [ ] **Step 1: Create the stats API route**

```typescript
// app/api/admin/stats/route.ts
// GET: Admin dashboard stats — total orders, pending, revenue, pending deliveries.

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export async function GET() {
  try {
    await requireAdmin()
    const client = await createServerClient()

    const { data: allOrders, error: allErr } = await client.database
      .from("orders")
      .select("id, payment_status, fulfillment_status, total")

    if (allErr) {
      return NextResponse.json({ error: allErr.message }, { status: 500 })
    }

    const orders = allOrders || []
    const totalOrders = orders.length
    const pendingVerification = orders.filter(
      (o) => o.payment_status === "pending_verification"
    ).length
    const totalRevenue = orders
      .filter((o) => o.payment_status === "paid")
      .reduce((sum, o) => sum + Number(o.total), 0)
    const pendingDeliveries = orders.filter(
      (o) => o.payment_status === "paid" && o.fulfillment_status !== "delivered"
    ).length

    return NextResponse.json({
      totalOrders,
      pendingVerification,
      totalRevenue,
      pendingDeliveries,
    })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify the route compiles**

Run: `npx next build --turbopack 2>&1 | head -30`
Expected: No errors for `app/api/admin/stats/route.ts`

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/stats/route.ts
git commit -m "feat(admin): add stats API route"
```

---

### Task 2: Toast Component

**Files:**
- Create: `components/admin/Toast.tsx`

- [ ] **Step 1: Create Toast component**

```typescript
// components/admin/Toast.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/Toast.tsx
git commit -m "feat(admin): add toast notification component"
```

---

### Task 3: Approve Modal

**Files:**
- Create: `components/admin/ApproveModal.tsx`

- [ ] **Step 1: Create ApproveModal component**

```typescript
// components/admin/ApproveModal.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/ApproveModal.tsx
git commit -m "feat(admin): add approve payment modal"
```

---

### Task 4: Reject Modal

**Files:**
- Create: `components/admin/RejectModal.tsx`

- [ ] **Step 1: Create RejectModal component**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/RejectModal.tsx
git commit -m "feat(admin): add reject order modal"
```

---

### Task 5: OrderRow Component

**Files:**
- Create: `components/admin/OrderRow.tsx`

- [ ] **Step 1: Create OrderRow component**

```typescript
// components/admin/OrderRow.tsx
"use client"

import { useState } from "react"
import { money } from "@/lib/format"

interface OrderItem {
  id: string
  title_snapshot: string
  format_snapshot: string
  delivery_type_snapshot: string
  quantity: number
  unit_price_snapshot: number
  line_total: number
}

interface Order {
  id: string
  payment_status: string
  fulfillment_status: string
  total: number
  contact: { name?: string; email?: string; phone?: string }
  created_at: string
  bkash_trx_id?: string | null
  order_items: OrderItem[]
}

interface OrderRowProps {
  order: Order
  onApprove: (order: Order) => void
  onReject: (order: Order) => void
}

function paymentBadge(status: string) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    pending_verification: { label: "যাচাইকরণ অপেক্ষমান", bg: "#fef3c7", fg: "#92400e" },
    pending_payment: { label: "পেমেন্ট অপেক্ষমান", bg: "#f3f4f6", fg: "#374151" },
    paid: { label: "পেইড", bg: "#dcfce7", fg: "#166534" },
    refunded: { label: "রিফান্ডেড", bg: "#fee2e2", fg: "#991b1b" },
    failed: { label: "ব্যর্থ", bg: "#fee2e2", fg: "#991b1b" },
  }
  const info = map[status] || { label: status, bg: "#f3f4f6", fg: "#374151" }
  return (
    <span className="admin-status-badge" style={{ background: info.bg, color: info.fg }}>
      {info.label}
    </span>
  )
}

export default function OrderRow({ order, onApprove, onReject }: OrderRowProps) {
  const [expanded, setExpanded] = useState(false)
  const canAct = order.payment_status !== "paid" && order.payment_status !== "refunded"

  return (
    <div className="admin-order-card">
      {/* Main row */}
      <div className="admin-order-main" onClick={() => setExpanded(!expanded)}>
        <div className="admin-order-info">
          <p className="admin-order-id">#{order.id.slice(0, 8)}...</p>
          <p className="admin-order-meta">
            {new Date(order.created_at).toLocaleDateString("bn-BD")} &bull; {order.contact?.name || "নাম নেই"}
          </p>
          <p className="admin-order-meta">
            {order.contact?.email || ""} {order.contact?.phone ? `• ${order.contact.phone}` : ""}
          </p>
        </div>
        <div className="admin-order-right">
          <p className="admin-order-total">{money(order.total)}</p>
          {paymentBadge(order.payment_status)}
        </div>
      </div>

      {/* Expanded items */}
      {expanded && (
        <div className="admin-order-items">
          {order.order_items?.map((item) => (
            <div key={item.id} className="admin-order-item">
              <span>{item.title_snapshot} ({item.format_snapshot})</span>
              <span>&times; {item.quantity}</span>
              <span>{money(item.line_total)}</span>
            </div>
          ))}
          {order.bkash_trx_id && (
            <div className="admin-order-item" style={{ color: "var(--stone)" }}>
              <span>bKash TrxID</span>
              <span style={{ fontFamily: "monospace" }}>{order.bkash_trx_id}</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {canAct && (
        <div className="admin-order-actions">
          <button
            className="btn btn-primary"
            onClick={(e) => { e.stopPropagation(); onApprove(order) }}
          >
            কনফার্ম করুন
          </button>
          <button
            className="btn btn-secondary"
            onClick={(e) => { e.stopPropagation(); onReject(order) }}
          >
            বাতিল
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/OrderRow.tsx
git commit -m "feat(admin): add expandable order row component"
```

---

### Task 6: Admin Layout

**Files:**
- Create: `app/admin/layout.tsx`

- [ ] **Step 1: Create admin layout**

```typescript
// app/admin/layout.tsx
"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth"
import ToastContainer from "@/components/admin/Toast"

const menuItems = [
  {
    label: "অর্ডার",
    href: "/admin/orders",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push("/login")
      return
    }
    // Check admin status via API
    fetch("/api/admin/stats")
      .then((res) => {
        if (!res.ok) {
          router.push("/")
        } else {
          setChecking(false)
        }
      })
      .catch(() => router.push("/"))
  }, [user, loading, router])

  function handleLogout() {
    signOut()
    router.push("/")
  }

  if (loading || checking) {
    return (
      <div className="container section-padding">
        <div className="admin-layout">
          <aside className="admin-sidebar">
            <div className="skeleton" style={{ height: 44, borderRadius: "var(--radius-md)" }} />
            <div className="skeleton" style={{ height: 44, borderRadius: "var(--radius-md)" }} />
          </aside>
          <main className="admin-content">
            <div className="skeleton" style={{ height: 320, borderRadius: "var(--radius-lg)" }} />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="container section-padding">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
            <span className="admin-sidebar-badge">অ্যাডমিন</span>
          </div>

          {menuItems.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-sidebar-link${active ? " active" : ""}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            )
          })}

          <div className="admin-sidebar-divider" />

          <Link href="/account" className="admin-sidebar-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>ব্যবহারকারী প্যানেল</span>
          </Link>

          <button
            onClick={handleLogout}
            className="admin-sidebar-link"
            style={{
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "start",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>লগ আউট</span>
          </button>
        </aside>

        <main className="admin-content">
          <ToastContainer />
          {children}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create admin redirect page**

```typescript
// app/admin/page.tsx
import { redirect } from "next/navigation"

export default function AdminPage() {
  redirect("/admin/orders")
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/layout.tsx app/admin/page.tsx
git commit -m "feat(admin): add admin layout with sidebar"
```

---

### Task 7: Admin CSS Styles

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Append admin styles to globals.css**

Add the following at the end of `app/globals.css`:

```css
/* ==========================================================
   Admin Panel
   ========================================================== */
.admin-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: var(--sp-8);
  min-height: 70vh;
}

.admin-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  background: var(--ink);
  border-radius: var(--radius-lg);
  padding: var(--sp-4);
}

.admin-sidebar-header {
  padding: var(--sp-3) var(--sp-4);
  margin-bottom: var(--sp-3);
}

.admin-sidebar-badge {
  background: var(--terracotta);
  color: var(--white);
  font-size: 0.75rem;
  font-weight: 600;
  padding: var(--sp-1) var(--sp-3);
  border-radius: var(--radius-sm);
  letter-spacing: 0.05em;
}

.admin-sidebar-link {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-md);
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  font-size: 0.9375rem;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.admin-sidebar-link:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--white);
}

.admin-sidebar-link.active {
  background: var(--terracotta);
  color: var(--white);
}

.admin-sidebar-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.15);
  margin: var(--sp-4) 0;
}

.admin-content {
  min-width: 0;
}

/* Stats */
.admin-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--sp-4);
  margin-bottom: var(--sp-6);
}

.admin-stat-card {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--sp-5);
}

.admin-stat-label {
  font-size: 0.8125rem;
  color: var(--stone);
  margin-bottom: var(--sp-1);
}

.admin-stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  font-family: var(--font-body);
  color: var(--ink);
}

/* Order cards */
.admin-order-card {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: box-shadow var(--transition-fast);
}

.admin-order-card:hover {
  box-shadow: var(--shadow-md);
}

.admin-order-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--sp-4) var(--sp-5);
  cursor: pointer;
  gap: var(--sp-4);
}

.admin-order-info {
  flex: 1;
  min-width: 0;
}

.admin-order-id {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--ink);
}

.admin-order-meta {
  font-size: 0.8125rem;
  color: var(--stone);
  margin-top: var(--sp-1);
}

.admin-order-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--sp-2);
  flex-shrink: 0;
}

.admin-order-total {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 1rem;
}

.admin-status-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.admin-order-items {
  padding: 0 var(--sp-5) var(--sp-4);
  border-top: 1px solid var(--border);
}

.admin-order-item {
  display: flex;
  gap: var(--sp-4);
  padding: var(--sp-2) 0;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}

.admin-order-item > span:first-child {
  flex: 1;
}

.admin-order-actions {
  display: flex;
  gap: var(--sp-2);
  padding: 0 var(--sp-5) var(--sp-4);
}

/* Modal */
.admin-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--sp-4);
}

.admin-modal {
  background: var(--white);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 440px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.admin-modal-title {
  font-family: var(--font-body);
  font-size: 1.125rem;
  font-weight: 600;
  padding: var(--sp-5) var(--sp-5) 0;
}

.admin-modal-body {
  padding: var(--sp-5);
}

.admin-modal-info-row {
  display: flex;
  justify-content: space-between;
  padding: var(--sp-2) 0;
  font-size: 0.875rem;
  color: var(--ink-muted);
}

.admin-modal-label {
  display: block;
  margin-top: var(--sp-4);
  margin-bottom: var(--sp-2);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--ink);
}

.admin-modal-input {
  width: 100%;
  padding: var(--sp-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: 0.875rem;
  background: var(--bg);
}

.admin-modal-input:focus {
  outline: none;
  border-color: var(--terracotta);
  box-shadow: 0 0 0 2px rgba(196, 112, 75, 0.15);
}

.admin-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-5);
  border-top: 1px solid var(--border);
}

/* Toast */
.admin-toast-container {
  position: fixed;
  top: calc(var(--nav-height) + var(--sp-4));
  right: var(--sp-4);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.admin-toast {
  padding: var(--sp-3) var(--sp-5);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  box-shadow: var(--shadow-md);
  animation: toast-in 0.2s ease;
}

.admin-toast-success {
  background: #dcfce7;
  color: #166534;
}

.admin-toast-error {
  background: #fee2e2;
  color: #991b1b;
}

.admin-toast-info {
  background: #dbeafe;
  color: #1e40af;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Filter pills */
.admin-filter-pills {
  display: flex;
  gap: var(--sp-2);
  margin-bottom: var(--sp-6);
  flex-wrap: wrap;
}

/* Responsive */
@media (max-width: 768px) {
  .admin-layout {
    grid-template-columns: 1fr;
  }

  .admin-sidebar {
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    border-radius: var(--radius-md);
    padding: var(--sp-2);
    gap: var(--sp-2);
  }

  .admin-sidebar-header,
  .admin-sidebar-divider {
    display: none;
  }

  .admin-sidebar-link {
    white-space: nowrap;
    font-size: 0.8125rem;
    padding: var(--sp-2) var(--sp-3);
  }

  .admin-stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .admin-order-main {
    flex-direction: column;
    align-items: flex-start;
  }

  .admin-order-right {
    align-items: flex-start;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat(admin): add admin panel CSS styles"
```

---

### Task 8: Rewrite Admin Orders Page

**Files:**
- Modify: `app/admin/orders/page.tsx`

- [ ] **Step 1: Rewrite the admin orders page**

Replace the entire content of `app/admin/orders/page.tsx` with:

```typescript
"use client"

import { useEffect, useState, useCallback } from "react"
import { money } from "@/lib/format"
import OrderRow from "@/components/admin/OrderRow"
import ApproveModal from "@/components/admin/ApproveModal"
import RejectModal from "@/components/admin/RejectModal"
import { showToast } from "@/components/admin/Toast"

interface OrderItem {
  id: string
  title_snapshot: string
  format_snapshot: string
  delivery_type_snapshot: string
  quantity: number
  unit_price_snapshot: number
  line_total: number
}

interface Order {
  id: string
  payment_status: string
  fulfillment_status: string
  total: number
  contact: { name?: string; email?: string; phone?: string }
  created_at: string
  bkash_trx_id?: string | null
  order_items: OrderItem[]
}

interface Stats {
  totalOrders: number
  pendingVerification: number
  totalRevenue: number
  pendingDeliveries: number
}

const filters = [
  { value: "", label: "সকল" },
  { value: "pending_verification", label: "যাচাইকরণ অপেক্ষমান" },
  { value: "paid", label: "পেইড" },
  { value: "refunded", label: "রিফান্ডেড" },
]

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState("")
  const [approveOrder, setApproveOrder] = useState<Order | null>(null)
  const [rejectOrder, setRejectOrder] = useState<Order | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [ordersRes, statsRes] = await Promise.all([
        fetch(filter ? `/api/admin/orders?status=${filter}` : "/api/admin/orders"),
        fetch("/api/admin/stats"),
      ])

      const ordersData = await ordersRes.json()
      const statsData = await statsRes.json()

      if (!ordersRes.ok) {
        setError(ordersData.error || "Failed to load orders")
        return
      }

      setOrders(ordersData.data || [])
      if (statsRes.ok) setStats(statsData)
    } catch {
      setError("Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleApproveConfirm(paymentReference: string) {
    if (!approveOrder) return
    const res = await fetch(`/api/admin/orders/${approveOrder.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentReference }),
    })
    if (!res.ok) {
      const data = await res.json()
      showToast("error", data.error || "Approval failed")
      return
    }
    showToast("success", "অর্ডার কনফার্ম হয়েছে")
    setApproveOrder(null)
    fetchData()
  }

  async function handleRejectConfirm(reason: string) {
    if (!rejectOrder) return
    const res = await fetch(`/api/admin/orders/${rejectOrder.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason || null }),
    })
    if (!res.ok) {
      const data = await res.json()
      showToast("error", data.error || "Rejection failed")
      return
    }
    showToast("success", "অর্ডার বাতিল হয়েছে")
    setRejectOrder(null)
    fetchData()
  }

  return (
    <div>
      <h1 className="page-header" style={{ marginBottom: "var(--sp-6)" }}>অর্ডার ব্যবস্থাপনা</h1>

      {/* Stats */}
      {stats && (
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <p className="admin-stat-label">মোট অর্ডার</p>
            <p className="admin-stat-value">{stats.totalOrders}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">যাচাইকরণ অপেক্ষমান</p>
            <p className="admin-stat-value">{stats.pendingVerification}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">মোট আয়</p>
            <p className="admin-stat-value">{money(stats.totalRevenue)}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">ডেলিভারি বাকি</p>
            <p className="admin-stat-value">{stats.pendingDeliveries}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="admin-filter-pills">
        {filters.map((f) => (
          <button
            key={f.value}
            className={`filter-pill ${filter === f.value ? "active" : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div role="alert" style={{
          padding: "var(--sp-3) var(--sp-4)",
          marginBottom: "var(--sp-4)",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "var(--radius)",
          color: "#991b1b",
          fontSize: "0.875rem",
        }}>
          {error}
        </div>
      )}

      {/* Orders */}
      {loading ? (
        <p>লোড হচ্ছে...</p>
      ) : orders.length === 0 ? (
        <p style={{ color: "var(--stone)" }}>কোনো অর্ডার নেই।</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              onApprove={setApproveOrder}
              onReject={setRejectOrder}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {approveOrder && (
        <ApproveModal
          orderId={approveOrder.id}
          orderTotal={approveOrder.total}
          customerName={approveOrder.contact?.name || ""}
          bkashTrxId={approveOrder.bkash_trx_id}
          onConfirm={handleApproveConfirm}
          onCancel={() => setApproveOrder(null)}
        />
      )}
      {rejectOrder && (
        <RejectModal
          orderId={rejectOrder.id}
          orderTotal={rejectOrder.total}
          customerName={rejectOrder.contact?.name || ""}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectOrder(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx next build --turbopack 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/admin/orders/page.tsx
git commit -m "feat(admin): rewrite orders page with stats, modals, expandable rows"
```

---

### Task 9: Modify approve_order_payment RPC for Digital Delivery

**Files:**
- Database migration via `insforge_run-raw-sql`

- [ ] **Step 1: Update the approve_order_payment function**

Run via `insforge_run-raw-sql`:

```sql
CREATE OR REPLACE FUNCTION approve_order_payment(p_order_id uuid, p_payment_reference text DEFAULT NULL)
RETURNS void AS $$
BEGIN
  -- Mark payment as paid
  UPDATE orders
  SET payment_status = 'paid',
      payment_reference = p_payment_reference,
      paid_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  -- Auto-grant downloads for digital items
  INSERT INTO download_grants (order_id, order_item_id, user_id, token_hash, max_downloads, expires_at)
  SELECT
    oi.order_id,
    oi.id,
    o.user_id,
    encode(sha512(gen_random_bytes(32)), 'hex'),
    5,
    now() + interval '30 days'
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.order_id = p_order_id
    AND oi.delivery_type_snapshot = 'digital'
    AND NOT EXISTS (
      SELECT 1 FROM download_grants dg WHERE dg.order_item_id = oi.id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 2: Verify the function exists**

Run via `insforge_run-raw-sql`:

```sql
SELECT proname, proargtypes::regtype[] 
FROM pg_proc 
WHERE proname = 'approve_order_payment';
```

Expected: Returns one row with the function signature.

- [ ] **Step 3: Commit (document the migration)**

```bash
git add -A
git commit -m "feat(admin): add digital delivery auto-grant to approve_order_payment RPC"
```

---

### Task 10: Verify End-to-End

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts on `http://localhost:3000`

- [ ] **Step 2: Verify admin access**

Navigate to `http://localhost:3000/admin/orders`
Expected: Admin sidebar visible, stats cards loaded, orders table displayed

- [ ] **Step 3: Test approve flow**

Click "কনফার্ম করুন" on a pending order
Expected: Modal opens with order details, enter payment reference, confirm
Expected: Toast "অর্ডার কনফার্ম হয়েছে" appears, order status changes to "পেইড"

- [ ] **Step 4: Test reject flow**

Click "বাতিল" on a pending order
Expected: Modal opens, enter reason, confirm
Expected: Toast "অর্ডার বাতিল হয়েছে" appears, order status changes to "রিফান্ডেড"

- [ ] **Step 5: Test expandable rows**

Click on an order row
Expected: Order items expand below, showing book titles, formats, quantities

- [ ] **Step 6: Test filters**

Click filter pills
Expected: Orders filter by payment status

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat(admin): complete admin order management panel"
```
