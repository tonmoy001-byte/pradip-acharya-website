# Guest Checkout

## Goal
Allow a buyer to purchase and download an ebook without creating an account, while preserving payment integrity and preventing abuse.

## Trust boundaries & assets
- Untrusted: browser form input, cart, contact details, the guest token presented for download.
- Assets: order records, payment status, PDF download access, money movement.

## Token model
- Two independent 256-bit bearer tokens per guest order, stored only as SHA-256 hex hashes:
  - `guest_token_hash` — checkout token, delivered in the httpOnly cookie `go_<orderId>`.
  - `guest_email_token_hash` — email token, minted after payment and delivered in the email link.
- Guest orders and grants have `user_id = NULL`. RLS hides NULL-owner rows.
- The browser never calls the guest RPCs directly. Every guest route runs server-side, checks the cookie/token locally, then uses the server-side `project_admin` client for the authorization RPC and (only afterwards) for private storage.

## Flow
1. `POST /api/orders` (no session) → rate-limits (IP 10/10min, email 5/30min, fail closed), mints the checkout token, calls `create_guest_ebook_order` via the service client, sets the `go_<orderId>` cookie, returns `data.order_id`.
2. `POST /api/payment/create` checks the cookie, calls `begin_guest_payment_attempt`, starts the NagorikPay session. Guest metadata omits `user_id` and the guest email.
3. NagorikPay redirects to `/payment/success?transactionId=...&order_id=...`. The success page verifies via `/api/payment/verify`, which authorizes the guest through the cookie + `get_guest_order`. Settlement calls `fulfill_paid_order` (guest branch issues grants with NULL `user_id`) and, once, sends the download email via the lease.
4. The email link `/api/guest/exchange?order_id=...&t=<email-token>` sets the `go_<orderId>` cookie (400-day max age) and redirects to `/guest/order/<orderId>`.
5. `/guest/order/<orderId>` is a server component: it reads the cookie and calls `get_guest_order` to list grant ids. Each "PDF ডাউনলোড" link points at `/api/guest-downloads/<grantId>?order_id=<orderId>`.
6. `/api/guest-downloads/<grantId>` checks the cookie, calls the service-only `consume_guest_download` RPC, then streams the PDF from the private `digital-books` bucket.

## Permissions
- Guest functions + `fulfill_paid_order` → `project_admin` only.
- `consume_download` → `authenticated` + `project_admin` (PUBLIC/anon/authenticated revoked first).
- `guest_checkout_rate_limits` → service-only (RLS on, no policies).

## Email delivery lease
- `claim_guest_delivery_email` sets `delivery_email_claimed_at` and stores the email token hash.
- `mark_guest_delivery_sent` sets `delivery_emailed_at`.
- `release_guest_delivery_email` clears both.
- A claim older than 15 minutes is reclaimable. The verify and webhook paths both call `deliverGuestOrderEmail`; only one sends.

## F1 fix
`consume_download` uses `IS DISTINCT FROM` for the ownership check so a NULL `user_id` grant can never be read by a logged-in user.

## Downloads
Unlimited, no expiry (migration 019). `download_count` / `last_downloaded_at` are statistics only.

## Security notes
- Uniform `forbidden` (403) on every guest authorization failure — no order/grant existence oracles.
- Fail closed for guest order-creation rate limits.
- Insert-only `orders_validate_guest_owner` trigger (not a CHECK constraint, so `ON DELETE SET NULL` still works).
- `amountCoversOrder`, NagorikPay webhook signature, and pricing are unchanged.
- Migration 021 is not applied; no DB changes have been made. Apply only after explicit approval.