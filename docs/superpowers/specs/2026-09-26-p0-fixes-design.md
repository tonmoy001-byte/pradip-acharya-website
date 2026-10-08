# P0 Fixes Design — Cart merge, Cache poisoning, Auth perf (+ soft-404)

**Date:** 2026-09-26
**Status:** Approved by user (approaches A/A/A + soft-404 add-on)
**Scope:** P0 trio only (user chose "P0 trio only"); bug #4 (soft-404 HTTP 200) included per audit follow-up.
**Repo rule:** This document and all resulting code stay **uncommitted** — never `git commit`/`git push`.

## Context

CRO audit (`docs/cro-audit-2026-09-26.md`) found three critical blockers plus a soft-404 defect:

1. **Cart lost on login** — `lib/store.tsx:69-74` reloads from the per-user key with no migration from `bookstore-cart-guest`; the save effect (`:76-80`) then overwrites with stale/empty state.
2. **Cache null-poisoning** — `lib/api.ts:155` swallows SDK errors as `null`; `lib/public-cache.ts:39-43` bakes that `null` into `unstable_cache` (rejections aren't cached, but resolved nulls are); `revalidate: 60` observed not honored on Next 16.3.2 → permanent soft-404 until manual `revalidateTag`.
3. **Serial auth bootstrap** — `lib/auth.tsx` runs `/api/profile` → `/api/auth/check-admin` (measured 2,183 ms) sequentially; `fetchAdminStatus` repeated at 5 call sites → 4–10 s skeletons.
4. **Soft-404 returns HTTP 200** — `app/book/[id]/page.tsx` body serves "পাওয়া যায়নি" with status 200 (observed), despite `notFound()` at `:29`.

## Goals

- Cart survives login (guest + user carts merged, guest key removed).
- A transient DB/SDK error produces at most **one** bad request, never a persisted 404; all such errors are logged.
- Missing book → **real HTTP 404** (status), logged distinction between "row missing" and "fetch failed".
- Account/checkout pages need **one** auth request instead of two serial ones.

## Non-goals (explicitly out of scope — user chose P0 only)

- Copy quick wins (card CTA, trust strip), checkout input polish (`autocomplete`, phone pattern), `?next=` login redirect, checkout prefill.
- Migrating all 10 `unstable_cache` wrappers to Next 16 `use cache` (follow-up; `getCachedPostBySlug` shares the bug pattern — helper is written reusable but only wired for books now).
- Reverse-merging user cart → guest on logout; server-side cart sync; og:image/canonical/h1 fixes; HTTP 200→404 for list/search pages.

---

## Fix 1 — Cart merge on login

**Files:** `lib/store.tsx`, new pure helper in `lib/cart.ts` (keeps JSX-free module for tests).

**Approach A (approved):** merge inside `CartProvider`'s user-change effect so every auth entry point (login, signup, OTP) is covered.

### Merge semantics (pure function `mergeCarts(guest, user, cap = 100)`)

- Match items on `bookId + format` (format: `"paperback" | "ebook"`).
- Match → `quantity = min(guest.qty + user.qty, 100)` (server rejects >100 via `1..100` validation in orders API).
- No match → append guest item (order: user items first, then unmatched guest items).
- Empty guest → return `user` unchanged (reference-equal not required; content equal).
- Both empty → `[]`.

### Effect logic (`lib/store.tsx`)

- Track transition type via existing `prevUserId.current`:
  - `undefined/null → userId` (**guest → user**): `merged = mergeCarts(load(guestKey), load(userKey))` → `save(userKey, merged)` → `localStorage.removeItem(guestKey)` → `setItems(merged)`.
  - `userId → userId` (account switch): load new user's key only — **no merge** (never leak cart A into account B).
  - `userId → undefined/null` (logout): load guest key only (current behavior; no reverse merge).
  - `undefined → undefined`: no-op (current early return).
- Storage writes for the merge happen **synchronously inside this effect** (before `setItems`), so the save effect's transient stale write in the same commit is corrected by the final `setItems(merged)` write — final persisted value is always `merged`.

### Tests (TDD — RED first): `lib/cart.test.ts`

1. merge sums quantities for same `bookId+format`.
2. merge caps at 100.
3. merge appends guest-only items; preserves user-only items.
4. merge treats different `format` of same book as distinct lines.
5. empty guest → user cart unchanged (content).
6. both empty → `[]`.
7. no mutation of input arrays.

---

## Fix 2 — Never cache failures (cache poisoning + error logging + soft-404)

**Files:** `lib/api.ts`, `lib/public-cache.ts`, `app/book/[id]/page.tsx`.

**Approach A (approved):** make failures **throw** (rejections are not stored by `unstable_cache`), fall back to an uncached direct query, and log everything.

### `lib/api.ts` — `getBookById` (currently `:146-158`)

- Switch `.single()` → `.maybeSingle()` (pattern already used in `app/api/profile/route.ts:74`): with `.single()`, a true 0-row miss returns `error` (PGRST116) indistinguishable from transport failure; `maybeSingle` returns `{data: null, error: null}` for 0 rows.
- Then:
  - `error` → `console.error("[books] getBookById failed", { id, error })` and **throw** (wrap in a descriptive `Error`).
  - `!data` (no error) → `return null` (true not-found; safe to cache).
  - else → `mapRowToBook(data)` (unchanged).
- **Caller hardening — `getRelated` (`:199-203`):** wraps `getBookById`; must not propagate the throw → `try { book = await getBookById(id) } catch { return [] }` (error already logged by `getBookById`). Prevents a related-books failure from 500-ing the product page.

### `lib/public-cache.ts` — `getCachedBookById` (`:39-43`)

New shape (rejection-tolerant wrapper, reusable helper exported from `lib/public-cache.ts` or `lib/cache-utils.ts`):

```ts
async function withUncachedFallback<T>(cached: () => Promise<T>, direct: () => Promise<T>): Promise<T> {
  try { return await cached() }
  catch (e) {
    console.error("[cache] cached read failed; retrying uncached", e)
    return direct() // if this also throws, caller decides
  }
}

export async function getCachedBookById(id: string): Promise<Book | null> {
  try {
    return await withUncachedFallback(() => cachedBookById(id), () => getBookById(id))
  } catch (e) {
    console.error("[cache] book read failed entirely; serving miss", { id, e })
    return null // this request 404s; result is NOT cached → next request retries fresh
  }
}
```

Behavior matrix:

| Scenario | Result | Cached? |
|---|---|---|
| Happy path | book | yes (unchanged) |
| Transient error inside cache fn | direct retry succeeds → book | no (rejection not stored; direct result not stored) |
| Persistent error | `null` → page 404s **this request only** | **no** → self-heals |
| True not-found (no error) | `null` | yes (correct; admin create triggers `invalidateBooks` anyway) |

**Scope:** helper is generic so `getCachedPostBySlug` can adopt later; only `getCachedBookById` is rewired in this change. List wrappers (`getFeatured` etc.) keep returning `[]` on error — out of scope.

### Soft-404 status (`app/book/[id]/page.tsx`)

- `generateMetadata` (`:10`): replace `if (!book) return { title: "বই পাওয়া যায়নি" }` with `if (!book) notFound()` — Next sets the 404 status during the metadata phase, before any body streams (page already calls `notFound()` at `:29`; during the incident the metadata branch returned normally, which may be why status stayed 200).
- Post-deploy verification: `curl -s -o /dev/null -w "%{http_code}" https://pradipbooks.insforge.site/book/nonexistent` → must be `404`. If still 200 → capture full response headers and investigate streaming flush (root `app/loading.tsx` exists; no route-level `loading.tsx` for `book/[id]`) before changing anything else.

### Tests (TDD — RED first): `lib/cache-utils.test.ts` (or alongside existing suites)

Using fake fns (no SDK/network — matches existing pure-test pattern):

1. `withUncachedFallback`: cached resolves → returns cached value, **direct not called**.
2. cached rejects → direct resolves → returns direct value.
3. cached rejects → direct rejects → throws (propagates).
4. `getCachedBookById` (mock `getBookById` via module mock or thin wrapper test): both paths reject → returns `null` (not a throw).
5. `getBookById` classification: extracted pure classifier `classifyMaybeSingle({data, error}, id)` — error → throws; `{data: null, error: null}` → null; row → mapped book. (Extract the branch logic so it's testable without the SDK client.)

---

## Fix 3 — Single auth round trip (isAdmin into /api/profile)

**Files:** `app/api/profile/route.ts`, `lib/auth.tsx`.

**Approach A (approved):** one endpoint returns profile **and** `is_admin`.

### Server — `GET app/api/profile/route.ts`

```ts
const [profileRes, isAdminRes] = await Promise.all([
  client.rpc("get_user_profile", { p_user_id: user.id }),
  client.rpc("is_admin", { uid: user.id }),   // same RPC pattern as check-admin/auth-helpers
])
if (profileRes.error) → 500 (unchanged)
data: { ...profileRes.data, is_admin: isAdminRes.data === true }
```

- `is_admin` failure → treat as `false` + `console.error` (non-fatal: admin mis-detect shows customer UI, recoverable; never 500 a profile fetch over it).
- RPC proven to work from server routes: `requireAdmin` (`lib/auth-helpers.ts:90-94`) and `/api/auth/check-admin` both use this exact pattern (verified live: customer → `false`, admin PUT → allowed).
- **`/api/auth/check-admin` route stays** (no consumers removed route-side; harmless, may be hit by cached pages).

### Client — `lib/auth.tsx`

- `fetchProfile()`: read `isAdmin` from the profile payload directly (`raw.is_admin === true`), return it on `AuthUser`.
- **Delete `fetchAdminStatus`** and its 5 call sites (measured 2,183 ms each; now redundant).
- Net flow: `/api/profile` (1 HTTP + parallel RPCs server-side) → page data fetch. Two serial client hops → one.

### Tests (TDD — RED first): `lib/auth.test.ts` (or extend `lib/auth-helpers.test.ts`)

Pure parser: extract `parseProfileResponse(json): AuthUser | null`:

1. maps core fields (id, email, name, phone, avatar) — unchanged behavior.
2. `is_admin: true` → `isAdmin: true`.
3. `is_admin: false`/missing → `isAdmin: false`.
4. malformed/error JSON shape → `null` (preserves current fallback).

---

## Rollout & verification

1. **TDD order per fix:** write failing test → confirm RED (`npx vitest run`) → implement → GREEN → `npx tsc --noEmit` (must exit 0) → full suite `npx vitest run lib/auth-helpers.test.ts lib/api.test.ts` plus new test files.
2. **Baseline before deploy:** re-run suite to confirm 16/16 baseline + new tests pass (env `NEXT_PUBLIC_INSFORGE_URL` set — existing requirement).
3. **Deploy:** `node scripts/deploy-direct.mjs`, poll `GET .../api/deployments/{ID}` with `x-api-key` until `"READY"`.
4. **Prod smoke (dev-browser + curl):**
   - **Cart:** incognito mobile → add Paperback → sign in as customer → cart badge still 1, cart page shows 1 item, checkout shows it; guest key gone from localStorage, user key holds merged cart.
   - **Cache/404:** `/book/chhera-pushpo` → 200 + book (2 checks spaced ≥1 min); `/book/does-not-exist` → **404** status; no new `null` poisoning (only observable via absence of regression — check logs if available).
   - **Auth perf:** logged-out → login → `/account/orders` skeleton-to-content time (was 4–10 s; expect ~half the serial chain); `/api/profile` returns `is_admin` field.
   - **Regression:** admin dashboard loads (isAdmin true still detected), customer does NOT see admin UI; order placement still works end-to-end.
5. **Rollback:** redeploy previous commit is unavailable (repo rule: uncommitted work) → mitigate by keeping changes small/reviewable; if prod breaks, fix forward with a targeted patch deploy.

## Risks

| Risk | Mitigation |
|---|---|
| `maybeSingle` unsupported by SDK 1.5.x | Already used in `app/api/profile/route.ts:74` — proven. |
| Throw from `getBookById` surprises other callers | Grep shows only `getCachedBookById` + `getRelated`; `getRelated` gets explicit catch. |
| Merge effect writes race with save effect | Storage writes synchronous in user-change effect; final `setItems(merged)` triggers save-effect correction. |
| `is_admin` RPC slow in profile | Runs parallel with profile RPC; worst case = old single-hop latency, never two serial hops. |
| Soft-404 still 200 after `notFound()` in metadata | Verification step captures headers; deeper investigation gated behind that evidence. |

## Open items / follow-ups (not this round)

- `use cache` migration for all wrappers (replaces deprecated `unstable_cache`).
- Same failure-caching guard for `getCachedPostBySlug` + list wrappers.
- P1/P2 from audit: `?next=` redirect, checkout prefill/autocomplete, copy quick wins, og:image, canonical, h1.
