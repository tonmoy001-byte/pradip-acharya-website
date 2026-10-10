# প্রদীপ কুমার আচার্য্য — Bengali ebook store

Next.js 16 (App Router) + React 19 + InsForge (Postgres BaaS) storefront for
Bengali social novels as digital ebooks (PDF). Live site:
`https://pradipbooks.insforge.site`.

## Getting started

```bash
npm ci
npm run dev        # http://localhost:3000
```

## Environment

Copy `.env.example` to `.env.local` and fill in real values. Never commit
`.env.local`. Required for tests and local runs:

- `NEXT_PUBLIC_SITE_URL` — canonical public origin (only change needed for a custom domain)
- `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY` — InsForge backend
- `NAGORIKPAY_API_KEY`, `NAGORIKPAY_BASE_URL`, `NAGORIKPAY_WEBHOOK_SECRET` — payment gateway
- `GMAIL_USER`, `GMAIL_APP_PASSWORD` — contact-form mail (server-only)
- `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_GA_ID` — optional, empty until the owner provides them

## Checks

```bash
npm test            # vitest run (needs the two NEXT_PUBLIC_INSFORGE_* vars)
npm run typecheck   # tsc --noEmit
npm run build && npm start
```

No ESLint is configured; typecheck + tests + build are the quality gates.

## Payments

Flow: `/checkout` → `/api/orders` → `/api/payment/create` → NagorikPay gateway → `/payment/success` → `/api/payment/verify`; webhook in parallel at `/api/payment/webhook`.

Statuses handled:
- `COMPLETED` / `SUCCESS` → `paid` → order marked paid, grants issued immediately
- `PENDING` → `payment_review` → polls `/api/payment/verify` every 5s (max 2min); second webhook completes it
- `ERROR` / unknown → `failed` or verification error page (never shows as paid)

`fulfill_paid_order` (migration `012`) creates `download_grants` for each digital `order_item`; idempotent and callable by service client.

Testing a signed webhook locally:
```bash
node -e "
const crypto = require('crypto')
const ts = Math.floor(Date.now()/1000)
const body = 'transactionId=TEST123&status=completed'
const secret = process.env.NAGORIKPAY_WEBHOOK_SECRET
console.log(ts)
console.log('sha256=' + crypto.createHmac('sha256', secret).update(ts + '.' + body).digest('hex'))
"
# curl -X POST http://localhost:3000/api/payment/webhook \
#   -H "Content-Type: application/x-www-form-urlencoded" \
#   -H "X-NagorikPay-Timestamp: <ts>" \
#   -H "X-NagorikPay-Signature: sha256=<sig>" \
#   -d "transactionId=TEST123&status=completed"
```

Gor diagnostic: `node scripts/check-nagorikpay.mjs` (requires `NAGORIKPAY_API_KEY` and `SITE_URL`).

## Deploys (owner-run)

Deploys go through `node scripts/deploy-direct.mjs` with an admin API key
(`INSFORGE_API_KEY` in env) — deploying is the owner's job, never the agent's.
SEO smoke checks: `node scripts/verify-seo.mjs`,
`node scripts/verify-structured-data.mjs`, `node scripts/smoke-test.mjs`
(all accept `SITE_URL` env, defaulting to the canonical host).
