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
- `RUPANTOR_PAY_API_KEY`, `RUPANTOR_PAY_BASE_URL`, `RUPANTOR_PAY_WEBHOOK_SECRET` — payment gateway
- `GMAIL_USER`, `GMAIL_APP_PASSWORD` — contact-form mail (server-only)
- `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_GA_ID` — optional, empty until the owner provides them

## Checks

```bash
npm test            # vitest run (needs the two NEXT_PUBLIC_INSFORGE_* vars)
npm run typecheck   # tsc --noEmit
npm run build && npm start
```

No ESLint is configured; typecheck + tests + build are the quality gates.

## Deploys (owner-run)

Deploys go through `node scripts/deploy-direct.mjs` with an admin API key
(`INSFORGE_API_KEY` in env) — deploying is the owner's job, never the agent's.
SEO smoke checks: `node scripts/verify-seo.mjs`,
`node scripts/verify-structured-data.mjs`, `node scripts/smoke-test.mjs`
(all accept `SITE_URL` env, defaulting to the canonical host).
