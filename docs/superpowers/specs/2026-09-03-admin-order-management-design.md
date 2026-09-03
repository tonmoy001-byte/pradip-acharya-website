# Admin Order Management — Design Spec

**Date**: 2026-09-03
**Scope**: Order management only (no product/customer management)
**Status**: Approved

## Overview

Build a minimal admin panel for managing orders. Admin can view all orders, verify bKash payments, approve/reject orders, and auto-deliver digital products. Uses a dedicated admin sidebar layout.

## Architecture

### Existing Components (Reuse)
- `lib/auth-helpers.ts` — `requireAdmin()` for server-side auth
- `app/api/admin/orders/route.ts` — GET list orders (already works)
- `app/api/admin/orders/[orderId]/approve/route.ts` — POST approve (already works)
- `app/api/admin/orders/[orderId]/reject/route.ts` — POST reject (already works)
- Database RPCs: `approve_order_payment()`, `reject_order_payment()`, `is_admin()`

### New Components
- `app/admin/layout.tsx` — Admin layout with sidebar
- `app/admin/page.tsx` — Redirect to `/admin/orders`
- `app/admin/orders/page.tsx` — Rewrite with stats + table + modals
- `app/api/admin/stats/route.ts` — GET dashboard stats
- `components/admin/AdminSidebar.tsx` — Sidebar navigation
- `components/admin/OrderStats.tsx` — Stats cards
- `components/admin/OrderTable.tsx` — Orders table with filters
- `components/admin/ApproveModal.tsx` — Approve confirmation modal
- `components/admin/RejectModal.tsx` — Reject confirmation modal
- `components/admin/Toast.tsx` — Simple toast notification

### Database Changes
- Add `pending_verification` and `failed` to `orders_payment_status_check` constraint (already done)
- Add `order_items_insert_own` RLS policy (already done)
- Modify `approve_order_payment()` RPC to auto-create `download_grants` for digital items

## Design Details

### 1. Admin Layout (`app/admin/layout.tsx`)

- Server component that checks `requireAdmin()` on render
- Full-height layout: sidebar (240px) + main content area
- Sidebar: `var(--ink)` background, white text
  - Logo: "অ্যাডমিন" badge in `var(--gold)`
  - Nav items with icons:
    - "অর্ডার" → `/admin/orders` (active: `var(--gold)` left border + background highlight)
  - Bottom: user email + logout button
- Mobile: sidebar collapses to hamburger toggle
- Main area: `var(--cream)` background, padding

### 2. Stats Cards (top of orders page)

Four stat cards in a responsive grid (2x2 on mobile, 4x1 on desktop):

| Card | Label | Data Source |
|------|-------|-------------|
| Total Orders | মোট অর্ডার | `COUNT(*)` from orders |
| Pending Verification | যাচাইকরণ অপেক্ষমান | `COUNT(*)` where `payment_status = 'pending_verification'` |
| Total Revenue | মোট আয় | `SUM(total)` where `payment_status = 'paid'` |
| Pending Deliveries | ডেলিভারি বাকি | `COUNT(*)` where `payment_status = 'paid'` and `fulfillment_status != 'delivered'` |

API: `GET /api/admin/stats` → returns `{ totalOrders, pendingVerification, totalRevenue, pendingDeliveries }`

### 3. Orders Table

**Columns**:
| Column | Width | Notes |
|--------|-------|-------|
| অর্ডার আইডি | 100px | Truncated UUID (first 8 chars) |
| তারিখ | 120px | Bengali formatted date |
| গ্রাহক | auto | Name + email + phone from `contact` JSONB |
| মোট | 100px | Bengali numerals via `money()` |
| পেমেন্ট | 140px | Status badge |
| কাজ | 160px | Approve + Reject buttons |

**Status Badges**:
- `pending_verification` → orange badge "যাচাইকরণ অপেক্ষমান"
- `pending_payment` → gray badge "পেমেন্ট অপেক্ষমান"
- `paid` → green badge "পেইড"
- `refunded` → red badge "রিফান্ডেড"
- `failed` → red badge "ব্যর্থ"

**Filter Pills** (above table):
- সকল (All) — default
- যাচাইকরণ অপেক্ষমান (Pending Verification)
- পেইড (Paid)
- রিফান্ডেড (Refunded)

**Expandable Rows**:
- Click a row to expand and show order items:
  - Book title (`title_snapshot`), format (`format_snapshot`), quantity, line total
  - bKash TrxID if present (`bkash_trx_id`)

### 4. Approve Modal

**Trigger**: Click "কনফার্ম করুন" button on order row
**Modal contents**:
- Title: "পেমেন্ট কনফার্ম করুন"
- Order info: Order ID, amount, customer name
- If bkash order: show TrxID
- Input: "পেমেন্ট রেফারেন্স" (text, optional) — for admin's internal reference
- Buttons: "বাতিল" (Cancel) + "কনফার্ম করুন" (Confirm, primary)
- On confirm: `POST /api/admin/orders/{id}/approve` with `{ paymentReference }`
- On success: close modal, show toast "অর্ডার কনফার্ম হয়েছে", refresh order list
- On error: show error in modal

### 5. Reject Modal

**Trigger**: Click "বাতিল" button on order row
**Modal contents**:
- Title: "অর্ডার বাতিল করুন"
- Order info: Order ID, amount, customer name
- Input: "কারণ" (textarea, optional) — rejection reason
- Buttons: "বাতিল" (Cancel) + "বাতিল করুন" (Reject, red)
- On confirm: `POST /api/admin/orders/{id}/reject` with `{ reason }`
- On success: close modal, show toast "অর্ডার বাতিল হয়েছে", refresh order list

### 6. Digital Delivery Auto-Grant

When `approve_order_payment()` RPC runs:
1. Sets `payment_status = 'paid'`, `paid_at = now()`
2. For each order item where `delivery_type_snapshot = 'digital'`:
   - Check if `download_grants` record already exists for this order_item
   - If not, create one: `download_grants(order_id, order_item_id, user_id, token_hash, max_downloads=5, expires_at=now()+30days)`
   - `token_hash` = random token hashed with SHA-256 (for secure download URLs)
3. Customer sees download button in My Orders immediately after approval

**Implementation**: Modify the existing `approve_order_payment` SQL function to include the digital delivery logic.

### 7. Toast Notifications

Simple toast component:
- Position: top-right corner
- Types: success (green), error (red), info (blue)
- Auto-dismiss after 3 seconds
- Stack multiple toasts

## API Routes

### Existing (No Changes)
- `GET /api/admin/orders` — list orders with items
- `POST /api/admin/orders/{id}/approve` — approve payment
- `POST /api/admin/orders/{id}/reject` — reject payment

### New
- `GET /api/admin/stats` — dashboard stats (4 numbers)

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `app/admin/layout.tsx` | Create | Admin layout with sidebar |
| `app/admin/page.tsx` | Create | Redirect to `/admin/orders` |
| `app/admin/orders/page.tsx` | Rewrite | Stats + table + modals |
| `app/api/admin/stats/route.ts` | Create | Dashboard stats API |
| `components/admin/AdminSidebar.tsx` | Create | Sidebar navigation |
| `components/admin/OrderStats.tsx` | Create | Stats cards |
| `components/admin/OrderTable.tsx` | Create | Orders table with filters |
| `components/admin/ApproveModal.tsx` | Create | Approve confirmation modal |
| `components/admin/RejectModal.tsx` | Create | Reject confirmation modal |
| `components/admin/Toast.tsx` | Create | Toast notification system |

## Database Migration

Modify `approve_order_payment` RPC to auto-grant downloads for digital items:

```sql
CREATE OR REPLACE FUNCTION approve_order_payment(p_order_id uuid, p_payment_reference text DEFAULT NULL)
RETURNS void AS $$
BEGIN
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

## Success Criteria

1. Admin can log in and see the admin sidebar
2. Stats cards show correct numbers
3. Orders list loads with all orders, filterable by status
4. Clicking a row shows order items inline
5. Approve modal opens, accepts payment reference, marks order as paid
6. Reject modal opens, accepts reason, marks order as refunded
7. Digital orders auto-grant download links on approval
8. Toast notifications appear on success/error
9. Non-admin users cannot access `/admin/*`
