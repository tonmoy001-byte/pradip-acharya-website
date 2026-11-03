# Migration Plan: InsForge → Cloudflare

**Project:** pradip-acharya-website (Next.js 16 App Router)
**Current hosting:** InsForge (`https://cpd9mnqf.insforge.site`, DB + auth + storage + functions)
**Target:** Cloudflare (Workers via OpenNext + Hyperdrive Postgres + R2 + third-party auth)
**Prepared:** 2026-10-28

---

## 1. What InsForge features are actually used

Audited from `app/`, `lib/`, `db/migrations/`. No realtime, no edge functions, no AI gateway, no InsForge email are used.

| InsForge feature | Usage in code |
|---|---|
| **Auth** | `@insforge/sdk`, `@insforge/sdk/ssr` — email/password sign-in/up, email verification (OTP), password reset, session cookies, `auth.getCurrentUser()`, `auth.uid()` in RLS/RPC, `is_admin()` RPC. Files: `lib/insforge.ts`, `lib/insforge-server.ts`, `app/actions/auth.ts`, `lib/auth-helpers.ts`, `app/api/auth/*`. |
| **Database (Postgres)** | 14 tables: `books`, `book_formats`, `digital_assets`, `categories`, `orders`, `order_items`, `download_grants`, `profiles`, `posts`, `wishlists`, `site_settings`, `admin_memberships`, `customer_profiles`, `contact_rate_limits`, `payment_events`. PostgREST-style reads (`/api/database/records/...`, `/api/database/rpc/...`) in `lib/api.ts`. SDK query builder `.database.from().select().eq()` in ~40 API routes. |
| **RPC functions (Postgres)** | ~20 SECURITY DEFINER functions: admin CRUD (`admin_*_impl`), `approve/reject_order_payment`, `refund_order`, `fulfill_paid_order`, `consume_download`, `create_ebook_order`, `create_order_from_cart`, `get_user_orders`, `get_user_order_detail`, `get_user_downloads`, `get_user_profile`, `upsert_profile`, `set_default_address`, `toggle_wishlist`, `is_in_wishlist`, `get_wishlist`, `get_site_settings`, `is_admin`, `require_admin`. Heavy use of RLS. |
| **Storage** | 3 buckets: `book-covers` (public), `digital-books` (private), `payment-receipts` (private). Upload in admin routes; download streamed via service client in `app/api/my-downloads/[grantId]/route.ts`; public cover URLs built in `lib/api.ts` (`resolveCoverImage`). |
| **Hosting** | InsForge site (Next.js SSR) at `cpd9mnqf.insforge.site`. Deployed via CLI. |
| **Service role** | `INSFORGE_SERVICE_KEY` bypasses RLS for payment settlement, download self-heal, contact rate limit. |
| **Email** | NOT InsForge — Gmail SMTP via `nodemailer` in `app/api/contact/route.ts`. |

**Not used:** realtime, edge functions, AI gateway, InsForge email, schedules.

---

## 2. Cloudflare target architecture (recommended)

```
┌──────────────────────────────────────────────────────┐
│  Cloudflare (edge)                                   │
│  ├── Workers (Next.js via OpenNext adapter)          │  ← replaces InsForge hosting
│  ├── R2 buckets (book-covers, digital-books,         │  ← replaces InsForge storage
│  │    payment-receipts)                              │
│  ├── Hyperdrive (connection pooling)                 │  ← to managed Postgres
│  └── Workers Secrets (env vars)                      │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────┐
│  Managed Postgres (Neon / Supabase / Cloudflare      │  ← keeps all SQL, RLS, RPC
│  Hyperdrive-compatible)                              │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────┐
│  Auth provider (Clerk OR Better Auth)                │  ← replaces InsForge auth
│  Email (Resend HTTP API)                             │  ← replaces nodemailer SMTP
└──────────────────────────────────────────────────────┘
```

### Why keep Postgres (not D1)
The app has 14 tables, ~20 SECURITY DEFINER RPCs, RLS policies, `auth.uid()` checks, pgcrypto. Moving to D1 (SQLite) means rewriting all SQL, dropping RLS (must enforce in app code), and losing Postgres features. **Keep Postgres via Hyperdrive** — lowest risk, preserves all DB logic. Neon (serverless Postgres) is the natural fit (HTTP/WebSocket driver works on Workers).

### Auth choice
- **Clerk**: simplest drop-in, free tier 10k MAU, but adds vendor + cost at scale.
- **Better Auth**: self-hosted on Workers + Postgres, free, supports email/password + OTP + reset out of the box, runs on Workers. Recommended for cost/control. Requires a `users`/`sessions`/`accounts`/`verification` schema (Better Auth manages these).
- **Supabase Auth**: only if you also use Supabase Postgres (then you get Supabase-js client with identical `.from().select()` API — biggest code savings). But that's not "Cloudflare-hosted DB".

**Recommendation: Better Auth** (free, Postgres-backed, Workers-compatible, no vendor lock-in). Clerk if you want zero auth-code work.

---

## 3. Code changes required (file-by-file)

### 3.1 Database client layer — biggest change
Current: `lib/insforge-server.ts`, `lib/insforge-service.ts`, `lib/api.ts`, `lib/payment-settlement.ts`, all `app/api/**/route.ts` use `@insforge/sdk` query builder.

New: use `postgres` (postgres.js) or `@neondatabase/serverless` driver against Hyperdrive binding, plus (recommended) **Drizzle ORM** for type-safe query building that mirrors the current `.from().select().eq()` style.

| Current call | New equivalent |
|---|---|
| `client.database.from("books").select("*, book_formats(*)")` | Drizzle `db.query.books.findMany({ with: { book_formats: true } })` or raw SQL |
| `client.database.rpc("consume_download", { p_grant_id })` | `await sql\`SELECT consume_download(${id})\`` (function stays in Postgres) |
| `client.database.from("x").insert([...])` | `db.insert(x).values([...])` |
| Service client (bypass RLS) | Same driver with a role that bypasses RLS, OR keep RLS and pass user JWT. Simpler: keep a `DATABASE_URL` with a privileged role for server routes (mirrors service client), and a separate RLS-enforcing role for user-scoped reads. |

**Effort:** 3–5 days. ~40 call sites. Tests mock `createServerClient`/`createServiceClient` — those mocks must be updated to mock the new driver.

### 3.2 Auth layer
Files: `lib/insforge.ts`, `lib/insforge-server.ts`, `app/actions/auth.ts`, `lib/auth-helpers.ts`, `app/api/auth/*`, `app/api/auth/refresh/route.ts`.

- Replace `@insforge/sdk/ssr` client with Better Auth (or Clerk) client.
- `requireUser()` → use Better Auth's `auth.api.getSession({ headers })` / Clerk's `auth()`.
- `requireAdmin()` → keep calling `is_admin()` RPC, but pass the new user id.
- Cookie/session handling: Better Auth sets its own cookies; remove InsForge cookie refresh route.
- `app/actions/auth.ts` signUp/signIn/verifyEmail/resend/reset → rewrite to provider APIs.

### 3.3 RLS adaptation (DB-side)
Current policies use `auth.uid()` and `auth.users(id)` FK. New auth provider stores users in its own table (Better Auth: `user` table with `id` text).

Options:
- **(Recommended) Move authorization to app code**: remove RLS, enforce `user_id` filters in every query. Riskier but simplest given the service client already bypasses RLS for most writes. Add a code-review checklist + tests for ownership checks.
- **Keep RLS with JWT claims**: set `SET LOCAL request.jwt.claims = '{"sub":"<uid>"}'` per transaction, and rewrite policies to read `current_setting('request.jwt.claims', true)::json->>'sub'`. Works but adds per-request overhead and complexity on Hyperdrive.

### 3.4 Storage layer
Files: `lib/api.ts` (`resolveCoverImage`), `app/api/admin/books/upload/route.ts`, `upload-pdf/route.ts`, `app/api/admin/posts/upload/route.ts`, `app/api/my-downloads/[grantId]/route.ts`.

- Replace `client.storage.from(bucket).upload()` with R2 S3 SDK (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`).
- Public covers: R2 public bucket URL or custom domain (`cdn.yourdomain.com`). Update `resolveCoverImage` to build R2 public URL instead of `${INSFORGE_URL}/api/storage/buckets/...`.
- Private downloads: in download route, instead of streaming blob via service client, generate a presigned GET URL (short TTL) and `302` redirect to it — cleaner for Android and large files. Keep `consume_download` accounting before redirect.
- Migrate existing objects: rclone from InsForge (public download URLs) → R2. 3 buckets.

### 3.5 next.config.ts
- Remove InsForge `remotePatterns`/CSP origin; add R2 public hostname.
- `connect-src`/`img-src` update.

### 3.6 Env vars
Replace:
```
NEXT_PUBLIC_INSFORGE_URL, NEXT_PUBLIC_INSFORGE_ANON_KEY, INSFORGE_SERVICE_KEY, INSFORGE_API_KEY
```
with:
```
NEXT_PUBLIC_SITE_URL (new domain)
DATABASE_URL (Neon connection string, or Hyperdrive binding name)
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_* (or use bindings)
BETTER_AUTH_SECRET, BETTER_AUTH_URL  (or Clerk keys)
RESEND_API_KEY
GMAIL_* → RESEND_API_KEY (swap nodemailer for Resend HTTP)
NAGORIKPAY_* (unchanged)
```
Workers secrets via `wrangler secret put`.

### 3.7 Email (contact route)
Replace `nodemailer` SMTP with Resend HTTP API (Workers-friendly; nodemailer's TCP sockets are unreliable on Workers). `createTransport` → `fetch('https://api.resend.com/emails', ...)`.

### 3.8 Deployment
- Add `wrangler.toml` (Workers + R2 bindings + Hyperdrive binding).
- Add OpenNext: `npm i @opennextjs/cloudflare`, build `npx opennextjs-cloudflare build`, deploy `npx wrangler deploy`.
- Or use Cloudflare Pages with Git integration (simpler, but Workers needed for Hyperdrive bindings in some setups — Pages supports bindings too).
- Migrate DNS to Cloudflare, point custom domain.

### 3.9 Auth user migration
InsForge auth users must be exported and imported into the new provider. Passwords are hashed and may not be portable (depends on hash algo). Plan: export user emails + metadata; on first login in new system, force password reset. Communicate to users.

### 3.10 DB data migration
`pg_dump` from InsForge Postgres → restore into Neon. All migrations in `db/migrations/` are standard Postgres SQL and portable. RLS policies need `auth.uid()` → new approach (see 3.3). Functions use `auth.uid()` — update to read from new auth's user id passed as param or set via `set_config`.

---

## 4. Phased execution plan

| Phase | Work | Duration | Risk |
|---|---|---|---|
| 0 | Decide auth provider (Better Auth vs Clerk) and Postgres host (Neon vs others). Set up accounts. | 0.5 day | Low |
| 1 | Provision Neon Postgres, R2 buckets, Cloudflare Workers project, wrangler.toml. | 1 day | Low |
| 2 | `pg_dump` InsForge → restore to Neon. Run migrations. Verify tables/functions. | 1 day | Medium |
| 3 | Copy storage objects InsForge → R2 (rclone/script). | 1 day | Low |
| 4 | Code: DB client layer + Drizzle ORM swap (3.1). Update tests. | 3–5 days | High |
| 5 | Code: auth layer + RLS adaptation (3.2, 3.3). | 2–3 days | High |
| 6 | Code: storage URLs + upload/download routes (3.4). | 1–2 days | Medium |
| 7 | Code: email (Resend), next.config, env (3.5–3.7). | 1 day | Low |
| 8 | Auth user migration + password reset flow. | 1 day | Medium |
| 9 | Deploy to Cloudflare (staging URL), smoke test all flows (browse, cart, checkout, payment webhook, download, admin). | 2 days | Medium |
| 10 | DNS cutover + monitor. Keep InsForge running 2 weeks as fallback. | 1 day + 2 wk | Medium |

**Total:** ~2.5–3.5 weeks for one developer.

---

## 5. Risks & mitigations

1. **Auth user passwords not portable** → forced password reset for all users; send email blast before cutover. Mitigation: keep InsForge auth running in parallel during transition; allow login via both for 2 weeks.
2. **RLS security regression** if moving authz to app code → mandatory ownership checks in every query; add tests; code review. Mitigation: keep RLS with JWT-claim approach where feasible.
3. **Workers runtime limits** (nodemailer TCP, sharp) → use Resend HTTP; avoid sharp (not currently used in app code, only a dep). Audit other deps for Node-only APIs.
4. **Hyperdrive + per-request JWT claims** complexity → decide app-level authz early (phase 0) to avoid rework.
5. **Cost** → Cloudflare free tier covers Workers/Pages/R2 generous; Neon free tier 0.5GB (likely enough initially, upgrade later); Better Auth free. Clerk free 10k MAU.
6. **Downtime during cutover** → DNS TTL lowered 24h before; DB final sync during maintenance window; keep InsForge live as fallback.
7. **Payment webhook URL** must be updated in NagorikPay dashboard to new domain before cutover, and old URL kept working until DNS propagates.

---

## 6. What stays unchanged

- All UI/components/pages (no visual changes).
- NagorikPay integration logic (just webhook URL + env).
- Database schema & migrations (portable Postgres SQL).
- Business logic in API routes (only client calls change).
- Tests structure (mocks change to new driver).

---

## 7. Decision needed from you before starting

1. **Auth provider**: Better Auth (free, self-hosted) vs Clerk (paid at scale, less code)?
2. **Postgres host**: Neon (recommended, serverless) vs Supabase (gives you Supabase-js with identical query API → less code rewrite) vs Cloudflare's own Postgres (beta)?
3. **Approach to RLS**: keep RLS with JWT claims (more work, safer) vs move authz to app code (less work, needs discipline)?
4. **Email**: Resend (recommended) vs keep Gmail SMTP (needs TCP on Workers, fragile)?
5. **Custom domain**: do you have one (e.g. pradipbooks.com), or stay on `*.pages.dev` / `*.workers.dev`?

Once you decide these, I'll start with Phase 1 (provisioning) and a proof-of-concept on a staging Worker.
