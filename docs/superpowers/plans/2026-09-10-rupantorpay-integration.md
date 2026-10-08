# RupantorPay Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate RupantorPay as an online payment option alongside Cash on Delivery, with full payment lifecycle management.

**Architecture:** Redirect-based payment flow using RupantorPay's `/checkout` API. Order created first with pending status, then customer redirected to RupantorPay for payment. On success, payment verified via `/verify-payment` API and order updated. Webhook provides server-to-server backup notification.

**Tech Stack:** Next.js App Router, TypeScript, InsForge (PostgREST + Auth), RupantorPay REST API

---

## File Structure

| File | Purpose |
|------|---------|
| `lib/rupantor.ts` | RupantorPay API client (create payment, verify payment) |
| `app/api/payment/create/route.ts` | POST: Creates payment via RupantorPay API |
| `app/api/payment/verify/route.ts` | GET: Verifies payment after redirect |
| `app/api/payment/webhook/route.ts` | POST: Webhook handler for server-to-server notifications |
| `app/payment/success/page.tsx` | Success redirect page |
| `app/payment/cancel/page.tsx` | Cancel redirect page |
| `app/checkout/page.tsx` | MODIFY: Add payment method selector |
| `.env.local` | ADD: RupantorPay environment variables |

---

### Task 1: Add Environment Variables

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add RupantorPay env vars to .env.local**

```bash
# Add to .env.local
RUPANTOR_PAY_API_KEY=your_api_key_here
RUPANTOR_PAY_BASE_URL=https://payment.rupantorpay.com/api/payment
NEXT_PUBLIC_SITE_URL=https://pradipbooks.insforge.site
```

- [ ] **Step 2: Verify env vars are accessible**

```bash
# Test in dev
npm run dev
# In another terminal, create a test API route or check console
```

---

### Task 2: Create RupantorPay API Client

**Files:**
- Create: `lib/rupantor.ts`

- [ ] **Step 1: Create the RupantorPay client library**

```typescript
// lib/rupantor.ts
// RupantorPay API client for payment creation and verification.

const RUPANTOR_API_KEY = process.env.RUPANTOR_PAY_API_KEY!
const RUPANTOR_BASE_URL = process.env.RUPANTOR_PAY_BASE_URL || "https://payment.rupantorpay.com/api/payment"

interface RupantorCreatePayload {
  fullname: string
  email: string
  amount: string
  success_url: string
  cancel_url: string
  webhook_url?: string
  metadata?: Record<string, any>
}

interface RupantorCreateResponse {
  status: number
  message: string
  payment_url: string
}

interface RupantorVerifyPayload {
  transaction_id: string
}

interface RupantorVerifyResponse {
  fullname: string
  email: string
  amount: string
  transaction_id: string
  trx_id: string
  payment_method: string
  status: string
  metadata?: Record<string, any>
}

/**
 * Create a RupantorPay payment session.
 * Returns the payment URL to redirect the customer to.
 */
export async function createRupantorPayment(payload: RupantorCreatePayload): Promise<RupantorCreateResponse> {
  const res = await fetch(`${RUPANTOR_BASE_URL}/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": RUPANTOR_API_KEY,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`RupantorPay create failed: ${res.status} ${error}`)
  }

  return res.json()
}

/**
 * Verify a RupantorPay transaction.
 * Returns the payment status and details.
 */
export async function verifyRupantorPayment(transactionId: string): Promise<RupantorVerifyResponse> {
  const res = await fetch(`${RUPANTOR_BASE_URL}/verify-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": RUPANTOR_API_KEY,
    },
    body: JSON.stringify({ transaction_id: transactionId }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`RupantorPay verify failed: ${res.status} ${error}`)
  }

  return res.json()
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit lib/rupantor.ts
```

Expected: No errors

---

### Task 3: Create Payment Create API Route

**Files:**
- Create: `app/api/payment/create/route.ts`

- [ ] **Step 1: Create the payment creation endpoint**

```typescript
// app/api/payment/create/route.ts
// POST: Initiate RupantorPay payment for an order.

import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { createRupantorPayment } from "@/lib/rupantor"

export const dynamic = "force-dynamic"

interface OrderRow {
  id: string
  user_id: string
  total: number
  payment_status: string
  contact: { name: string; email: string; phone: string }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const client = await createServerClient()
    const body = await req.json()
    const { order_id } = body as { order_id: string }

    if (!order_id) {
      return NextResponse.json({ error: "order_id required" }, { status: 400 })
    }

    // Fetch order and verify ownership
    const { data: order, error: orderError } = await client.database
      .from("orders")
      .select("id, user_id, total, payment_status, contact")
      .eq("id", order_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const orderRow = order as OrderRow

    if (orderRow.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (orderRow.payment_status !== "pending_payment") {
      return NextResponse.json({ error: "Order already processed" }, { status: 400 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pradipbooks.insforge.site"

    // Create RupantorPay payment
    const payment = await createRupantorPayment({
      fullname: orderRow.contact.name,
      email: orderRow.contact.email,
      amount: String(orderRow.total),
      success_url: `${siteUrl}/payment/success?transaction_id={transaction_id}`,
      cancel_url: `${siteUrl}/payment/cancel?order_id=${order_id}`,
      webhook_url: `${siteUrl}/api/payment/webhook`,
      metadata: {
        order_id: order_id,
        user_id: user.id,
      },
    })

    // Update order with payment method
    await client.database
      .from("orders")
      .update({ payment_method: "rupantor" })
      .eq("id", order_id)

    return NextResponse.json({ payment_url: payment.payment_url })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors

---

### Task 4: Create Payment Verify API Route

**Files:**
- Create: `app/api/payment/verify/route.ts`

- [ ] **Step 1: Create the payment verification endpoint**

```typescript
// app/api/payment/verify/route.ts
// GET: Verify RupantorPay payment after customer redirect.

import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/insforge-server"
import { verifyRupantorPayment } from "@/lib/rupantor"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const transactionId = searchParams.get("transaction_id")

    if (!transactionId) {
      return NextResponse.json({ error: "transaction_id required" }, { status: 400 })
    }

    // Verify with RupantorPay
    const result = await verifyRupantorPayment(transactionId)

    const client = await createServerClient()

    // Find order by transaction_id in metadata or payment_reference
    const { data: orders, error: findError } = await client.database
      .from("orders")
      .select("id, payment_status")
      .or(`payment_reference.eq.${transactionId},id.eq.${result.metadata?.order_id || ""}`)
      .limit(1)

    if (findError || !orders || orders.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const order = orders[0]

    if (order.payment_status === "paid") {
      // Already processed
      return NextResponse.json({ status: "paid", order_id: order.id })
    }

    if (result.status === "COMPLETED") {
      // Update order to paid
      const { error: updateError } = await client.database
        .from("orders")
        .update({
          payment_status: "paid",
          payment_reference: transactionId,
          paid_at: new Date().toISOString(),
        })
        .eq("id", order.id)

      if (updateError) {
        console.error("Failed to update order:", updateError)
        return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
      }

      // Log payment event
      await client.database.from("payment_events").insert({
        provider: "rupantor",
        provider_transaction_id: transactionId,
        order_id: order.id,
        status: "completed",
        verified: true,
      })

      return NextResponse.json({ status: "paid", order_id: order.id })
    }

    return NextResponse.json({ status: "failed", order_id: order.id })
  } catch (err: any) {
    console.error("Verify error:", err)
    return NextResponse.json({ error: err.message || "Verification failed" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors

---

### Task 5: Create Payment Webhook Route

**Files:**
- Create: `app/api/payment/webhook/route.ts`

- [ ] **Step 1: Create the webhook handler**

```typescript
// app/api/payment/webhook/route.ts
// POST: RupantorPay webhook for server-to-server payment notifications.

import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/insforge-server"
import { verifyRupantorPayment } from "@/lib/rupantor"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { transaction_id } = body

    if (!transaction_id) {
      return NextResponse.json({ error: "transaction_id required" }, { status: 400 })
    }

    // Verify with RupantorPay API
    const result = await verifyRupantorPayment(transaction_id)

    const client = await createServerClient()

    // Find order
    const orderId = result.metadata?.order_id
    if (!orderId) {
      return NextResponse.json({ error: "No order_id in metadata" }, { status: 400 })
    }

    const { data: orders, error: findError } = await client.database
      .from("orders")
      .select("id, payment_status")
      .eq("id", orderId)
      .limit(1)

    if (findError || !orders || orders.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const order = orders[0]

    if (order.payment_status === "paid") {
      // Already processed
      return NextResponse.json({ received: true })
    }

    if (result.status === "COMPLETED") {
      // Update order
      await client.database
        .from("orders")
        .update({
          payment_status: "paid",
          payment_reference: transaction_id,
          paid_at: new Date().toISOString(),
        })
        .eq("id", order.id)

      // Log payment event
      await client.database.from("payment_events").insert({
        provider: "rupantor",
        provider_transaction_id: transaction_id,
        order_id: order.id,
        status: "completed",
        verified: true,
      })
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error("Webhook error:", err)
    return NextResponse.json({ error: err.message || "Webhook processing failed" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors

---

### Task 6: Create Payment Success Page

**Files:**
- Create: `app/payment/success/page.tsx`

- [ ] **Step 1: Create the success page**

```tsx
// app/payment/success/page.tsx
// Payment success redirect page. Verifies payment and shows confirmation.

"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { money } from "@/lib/format"

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const transactionId = searchParams.get("transaction_id")
  const orderId = searchParams.get("order_id")

  const [status, setStatus] = useState<"loading" | "paid" | "failed">("loading")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!transactionId) {
      setStatus("failed")
      setError("Transaction ID not found")
      return
    }

    fetch(`/api/payment/verify?transaction_id=${encodeURIComponent(transactionId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "paid") {
          setStatus("paid")
        } else {
          setStatus("failed")
          setError("পেমেন্ট যাচাইকরণ ব্যর্থ হয়েছে")
        }
      })
      .catch(() => {
        setStatus("failed")
        setError("পেমেন্ট যাচাইকরণে ত্রুটি")
      })
  }, [transactionId])

  if (status === "loading") {
    return (
      <div className="container section-padding">
        <div className="order-confirm">
          <h1>পেমেন্ট যাচাই হচ্ছে...</h1>
          <p>অনুগ্রহ করে অপেক্ষা করুন।</p>
        </div>
      </div>
    )
  }

  if (status === "failed") {
    return (
      <div className="container section-padding">
        <div className="order-confirm">
          <h1>পেমেন্ট ব্যর্থ</h1>
          <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
            {error || "পেমেন্ট প্রক্রিয়াকরণে সমস্যা হয়েছে।"}
          </p>
          <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
            {orderId && (
              <Link href={`/account/orders`} className="btn btn-primary">আমার অর্ডার</Link>
            )}
            <Link href="/books" className="btn btn-secondary">আরও বই দেখুন</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container section-padding">
      <div className="order-confirm">
        <h1>পেমেন্ট সম্পন্ন!</h1>
        <p>আপনার পেমেন্ট সফলভাবে সম্পন্ন হয়েছে।</p>
        <p style={{ color: "var(--stone)", marginBottom: "var(--sp-2)" }}>
          ট্রানজেকশন আইডি: {transactionId}
        </p>
        <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
          অর্ডার আইডি: {orderId}
        </p>
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", marginTop: "var(--sp-4)" }}>
          <Link href="/account/orders" className="btn btn-primary">আমার অর্ডার</Link>
          <Link href="/books" className="btn btn-secondary">আরও বই দেখুন</Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors

---

### Task 7: Create Payment Cancel Page

**Files:**
- Create: `app/payment/cancel/page.tsx`

- [ ] **Step 1: Create the cancel page**

```tsx
// app/payment/cancel/page.tsx
// Payment cancel redirect page. Shows retry option.

"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

export default function PaymentCancelPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("order_id")

  return (
    <div className="container section-padding">
      <div className="order-confirm">
        <h1>পেমেন্ট বাতিল</h1>
        <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
          আপনি পেমেন্ট প্রক্রিয়া বাতিল করেছেন।
        </p>
        <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)", fontSize: "0.875rem" }}>
          চিন্তা করবেন না — আপনার অর্ডার সুরক্ষিত আছে। আপনি পরে আবার পেমেন্ট করতে পারবেন।
        </p>
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          {orderId && (
            <Link href={`/account/orders`} className="btn btn-primary">আমার অর্ডার</Link>
          )}
          <Link href="/books" className="btn btn-secondary">আরও বই দেখুন</Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors

---

### Task 8: Update Checkout Page with Payment Method Selector

**Files:**
- Modify: `app/checkout/page.tsx`

- [ ] **Step 1: Add paymentMethod state and radio buttons**

In `app/checkout/page.tsx`, find the payment section (around line 322-334) and replace:

```tsx
// BEFORE (static COD):
            {/* Payment */}
            <div className="checkout-section">
              <h2>পেমেন্ট পদ্ধতি</h2>
              <div style={{
                padding: "var(--sp-3) var(--sp-4)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)", background: "var(--white)",
              }}>
                <span style={{ fontWeight: 600 }}>ক্যাশ অন ডেলিভারি</span>
                <span style={{ fontSize: "0.75rem", color: "var(--stone)", marginLeft: "var(--sp-2)" }}>
                  ডেলিভারির সময় পেমেন্ট
                </span>
              </div>
            </div>

// AFTER (with selector):
            {/* Payment */}
            <div className="checkout-section">
              <h2>পেমেন্ট পদ্ধতি</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
                <label style={{
                  display: "flex", alignItems: "flex-start", gap: "var(--sp-3)",
                  padding: "var(--sp-3) var(--sp-4)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)", cursor: "pointer",
                  background: paymentMethod === "rupantor" ? "#fff7ed" : "var(--white)",
                  borderColor: paymentMethod === "rupantor" ? "var(--terracotta)" : "var(--border)",
                }}>
                  <input
                    type="radio"
                    name="payment-method"
                    value="rupantor"
                    checked={paymentMethod === "rupantor"}
                    onChange={() => setPaymentMethod("rupantor")}
                    style={{ marginTop: "2px" }}
                  />
                  <div>
                    <span style={{ fontWeight: 600 }}>অনলাইন পেমেন্ট</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--stone)", marginLeft: "var(--sp-2)" }}>
                      bKash, Nagad, Rocket
                    </span>
                  </div>
                </label>
                <label style={{
                  display: "flex", alignItems: "flex-start", gap: "var(--sp-3)",
                  padding: "var(--sp-3) var(--sp-4)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)", cursor: "pointer",
                  background: paymentMethod === "cod" ? "#fff7ed" : "var(--white)",
                  borderColor: paymentMethod === "cod" ? "var(--terracotta)" : "var(--border)",
                }}>
                  <input
                    type="radio"
                    name="payment-method"
                    value="cod"
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                    style={{ marginTop: "2px" }}
                  />
                  <div>
                    <span style={{ fontWeight: 600 }}>ক্যাশ অন ডেলিভারি</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--stone)", marginLeft: "var(--sp-2)" }}>
                      ডেলিভারির সময় পেমেন্ট
                    </span>
                  </div>
                </label>
              </div>
            </div>
```

- [ ] **Step 2: Add paymentMethod state**

Find the state declarations (around line 31-38) and add `paymentMethod`:

```tsx
const [form, setForm] = useState({
  name: "", email: "", phone: "",
  address: "", city: "", zip: "",
})
const [paymentMethod, setPaymentMethod] = useState<"rupantor" | "cod">("rupantor")
const [errors, setErrors] = useState<Record<string, string>>({})
```

- [ ] **Step 3: Update handleSubmit to handle RupantorPay redirect**

Replace the `handleSubmit` function (around line 108-148) with:

```tsx
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  if (!validate() || items.length === 0) return

  setSubmitting(true)
  setServerError("")

  try {
    const hasPhysical = items.some((i) => i.format === "Paperback")
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        cartItems: items.map((i) => ({
          book_id: i.bookId,
          format_name: i.format,
          quantity: i.quantity,
        })),
        contact: { name: form.name, email: form.email, phone: form.phone },
        shippingAddress: hasPhysical ? {
          address: form.address,
          city: form.city,
          postal_code: form.zip,
        } : null,
        paymentMethod: paymentMethod,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "অর্ডার তৈরি ব্যর্থ হয়েছে")

    const orderId = data.data.order_id || data.data.id

    if (paymentMethod === "rupantor") {
      // Create RupantorPay payment and redirect
      const payRes = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ order_id: orderId }),
      })
      const payData = await payRes.json()
      if (!payRes.ok) throw new Error(payData.error || "পেমেন্ট তৈরি ব্যর্থ")

      clearCart()
      window.location.href = payData.payment_url
    } else {
      // COD — show success
      clearCart()
      setOrderResult({
        order_id: orderId,
        total: total,
      })
    }
  } catch (err: any) {
    setServerError(err.message || "একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।")
  } finally {
    setSubmitting(false)
  }
}
```

- [ ] **Step 4: Update success view to show payment method**

Find the success view (around line 151-170) and update the payment text:

```tsx
// BEFORE:
<p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
  পেমেন্ট: ক্যাশ অন ডেলিভারি
</p>

// AFTER (conditional):
<p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
  পেমেন্ট: {orderResult.payment_method === "rupantor" ? "অনলাইন পেমেন্ট" : "ক্যাশ অন ডেলিভারি"}
</p>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors

---

### Task 9: Deploy to InsForge

**Files:**
- None (deployment only)

- [ ] **Step 1: Add env vars to InsForge deployment**

```bash
# The env vars need to be passed during deployment
# Use insforge_start-deployment with envVars parameter
```

- [ ] **Step 2: Deploy using direct upload script**

```bash
node scripts/deploy-direct.mjs
```

- [ ] **Step 3: Verify deployment**

- Visit https://pradipbooks.insforge.site/checkout
- Verify payment method selector appears
- Test COD flow
- Test RupantorPay flow (if test API key available)

---

### Task 10: Testing Checklist

- [ ] **Test 1: COD flow works**
  1. Add book to cart
  2. Checkout with "ক্যাশ অন ডেলিভারি"
  3. Order created with `payment_method: "cod"`
  4. Success page shows confirmation

- [ ] **Test 2: RupantorPay flow works**
  1. Add book to cart
  2. Checkout with "অনলাইন পেমেন্ট"
  3. Redirected to RupantorPay page
  4. Complete payment (or cancel)
  5. Return to success/cancel page

- [ ] **Test 3: Payment verification works**
  1. After successful payment, verify page shows "paid"
  2. Order in DB has `payment_status: "paid"`
  3. `payment_reference` contains transaction_id

- [ ] **Test 4: Webhook works**
  1. RupantorPay sends webhook
  2. Order updated correctly
  3. Payment event logged

- [ ] **Test 5: Error handling**
  1. Invalid transaction_id → shows error
  2. Already paid order → no double processing
  3. Network error → graceful error message
