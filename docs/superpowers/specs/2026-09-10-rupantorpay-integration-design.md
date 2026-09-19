# RupantorPay Payment Gateway Integration

## Overview
Integrate RupantorPay as an online payment option alongside existing Cash on Delivery (COD). Customers can choose between online payment (bKash/Nagad/Rocket via RupantorPay) or COD at checkout.

## Payment Flow

### Online Payment (RupantorPay)
```
1. Customer fills checkout form → selects "অনলাইন পেমেন্ট"
2. Submit → POST /api/orders (creates order with payment_status: "pending_payment")
3. POST /api/payment/create (calls RupantorPay /checkout API)
4. Redirect customer to RupantorPay payment_url
5. Customer pays via bKash/Nagad/Rocket
6. RupantorPay redirects to /payment/success?transaction_id=XXX
7. GET /api/payment/verify?transaction_id=XXX (verifies payment)
8. Update order: payment_status → "paid", payment_reference → transaction_id
9. Show success confirmation
```

### Cash on Delivery (COD)
```
1. Customer fills checkout form → selects "ক্যাশ অন ডেলিভারি"
2. Submit → POST /api/orders (creates order with payment_method: "cod")
3. Show success confirmation (current flow)
```

### Webhook (Server-to-Server)
```
1. RupantorPay POSTs to /api/payment/webhook when payment completes
2. Verify webhook signature (if supported) or transaction
3. Update order status accordingly
4. Log payment event
```

## API Endpoints

### POST /api/payment/create
- **Purpose**: Initiate RupantorPay payment
- **Auth**: Required (logged-in user)
- **Body**: `{ order_id: string }`
- **Logic**:
  1. Fetch order from DB (verify it belongs to user, status is pending)
  2. Call RupantorPay `/checkout` API with order details
  3. Return `payment_url` to client
- **Response**: `{ payment_url: string }`

### GET /api/payment/verify
- **Purpose**: Verify payment after redirect
- **Auth**: None (public, called from success page)
- **Query**: `?transaction_id=XXX`
- **Logic**:
  1. Call RupantorPay `/verify-payment` API
  2. If status is "COMPLETED" → update order payment_status to "paid"
  3. Store transaction_id in payment_reference
  4. Log payment event
- **Response**: `{ status: "paid" | "failed", order_id: string }`

### POST /api/payment/webhook
- **Purpose**: Receive server-to-server payment notification
- **Auth**: None (but verify source)
- **Body**: RupantorPay webhook payload
- **Logic**:
  1. Extract transaction_id from payload
  2. Verify payment via RupantorPay API
  3. Update order if not already updated
  4. Log payment event
- **Response**: `{ received: true }`

## Pages

### /payment/success
- Client-side page that reads `transaction_id` from URL
- Calls `/api/payment/verify` to verify payment
- Shows success confirmation with order details
- Links to "আমার অর্ডার" and "আরও বই দেখুন"

### /payment/cancel
- Shows payment was cancelled
- Links back to order or checkout to retry

## Checkout Page Changes

### Payment Method Selector
Replace static "ক্যাশ অন ডেলিভারি" with radio buttons:
```
○ অনলাইন পেমেন্ট (bKash, Nagad, Rocket)
○ ক্যাশ অন ডেলিভারি
```

### Form Submission Logic
- If "অনলাইন পেমেন্ট" selected:
  1. Create order via `/api/orders`
  2. Call `/api/payment/create` with order_id
  3. Redirect to `payment_url`
- If "ক্যাশ অন ডেলিভারি" selected:
  1. Create order via `/api/orders` (current flow)
  2. Show success confirmation

## Database Changes

### orders table
- `payment_method`: `"rupantor"` | `"cod"` (existing column, no schema change)
- `payment_status`: `"pending_payment"` → `"paid"` | `"failed"` (existing column)
- `payment_reference`: stores RupantorPay `transaction_id` (existing column)

### No schema migrations required
All needed columns already exist in the orders table.

## Environment Variables

```
RUPANTOR_PAY_API_KEY=your_api_key_here
RUPANTOR_PAY_BASE_URL=https://payment.rupantorpay.com/api/payment
NEXT_PUBLIC_SITE_URL=https://cpd9mnqf.insforge.site
```

## Error Handling

### Payment Creation Failed
- Show error on checkout page
- Order remains in "pending_payment" state
- Customer can retry

### Payment Verification Failed
- Show error on success page
- Order remains in "pending_payment" state
- Customer can retry via order page

### Webhook Failures
- Log error
- Order status unchanged
- Admin can manually verify/approve

## Security Considerations

1. **API Key**: Stored in environment variables, never exposed to client
2. **Order Verification**: Always verify order belongs to authenticated user before creating payment
3. **Webhook**: Verify transaction via RupantorPay API before updating order
4. **Idempotency**: Check if order already paid before updating (prevent double-processing)

## Testing Checklist

- [ ] Create order with RupantorPay → redirect works
- [ ] Create order with COD → current flow works
- [ ] Payment success → order marked as paid
- [ ] Payment cancel → order remains pending, can retry
- [ ] Webhook → order updated correctly
- [ ] Duplicate webhook → no double-processing
- [ ] Expired/pending payment → handled gracefully
