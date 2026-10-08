# Mobile Homepage Fixes (Approach A — Minimal Patches)

**Date:** 2026-09-26
**Status:** Approved (user: "approve")
**Scope:** Homepage mobile UX at ~390–640px viewports; 7 issues selected by user in visual companion.

## Overview

Seven mobile issues on the homepage, fixed with targeted CSS/markup patches only. No hero redesign, no section-system refactor. Desktop layout (>640px) stays as-is except the intentional `<h1>`→`<h2>` semantic fix.

## Issues → Fixes

### 1. Featured "বিশেষ প্রকাশনা" section stuck at 2-column on phones
- **Cause:** `app/page.tsx:62` inline `gridTemplateColumns: "1fr 1fr"` with no breakpoint.
- **Fix:** Replace inline style with class `.featured-grid`.
  - Default: `display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-12); align-items: center;`
  - `@media (max-width: 640px)`: `grid-template-columns: 1fr;` — image first (`order`), text block second so the cover leads on mobile.

### 2. Hero text fights the busy video
- **Cause:** ≤640px `.hero-overlay` gradient too weak in the mid band (ends ~0.78 alpha).
- **Fix:** Strengthen ≤640px overlay, e.g. `rgba(22,19,15,0.25) 0% → 0.65 45% → 0.88 100%`. No markup change.

### 3. Hero CTAs & spacing on narrow widths
- **Cause:** `.hero-actions` only stacks at ≤480px; 481–640px side-by-side feels tight.
- **Fix:** Move the stack rule (`flex-direction: column`, full-width buttons, max-width ~280px) to ≤640px. Keep existing `padding-bottom` + `env(safe-area-inset-bottom)` on `.hero-content`.

### 4. Book grid goes 1-column ≤480px
- **Cause:** `globals.css:333-337` forces `grid-template-columns: 1fr`.
- **Fix:** Delete the ≤480px `grid-template-columns: 1fr` rule so 2 columns persist at all widths. Optionally tighten `.book-grid` gap at ≤480px so 2-up cards breathe.

### 5. Large empty band before featured section
- **Cause:** Author intro + featured both use full `section-padding` (`var(--sp-16)` block).
- **Fix:** ≤640px, `.section-padding { padding-block: var(--sp-10); }` (global mobile shrink — simple, consistent).

### 6. Featured CTA row may not wrap
- **Cause:** Plain `display: flex; gap` row, no wrap/stack.
- **Fix:** Add `flex-wrap: wrap` on the actions container; ≤480px stack buttons full-width (same pattern as hero CTAs).

### 7. Two `<h1>` on homepage
- **Cause:** Hero + featured both render `<h1>`.
- **Fix:** `page.tsx:65` featured title → `<h2>`. Hero keeps the sole `<h1>`. Preserve visual weight (existing heading styles or a small class tweak if needed).

## Files Touched

| File | Changes |
|------|---------|
| `app/globals.css` | `.featured-grid` (+640px), overlay ≤640px, `.hero-actions` ≤640px, `.book-grid` ≤480px, `.section-padding` ≤640px |
| `app/page.tsx` | featured grid → `.featured-grid` class, `<h1>`→`<h2>`, CTA flex wrap/stack |

## Out of Scope

- Hero card/redesign, navbar/drawer, section extraction refactor (Approach B/C)
- Non-homepage pages (they benefit from `.section-padding` mobile shrink incidentally)
- Committing (only when explicitly requested)

## Verification

1. `npx tsc --noEmit`
2. Local/visual check at ~390px and ~640px (featured stacked, CTAs stacked, 2-col books, tighter gaps, readable hero, one `<h1>`)
3. Vitest untouched (16 tests still pass if env provided)
4. Deploy: `node scripts/deploy-direct.mjs` → poll `GET …/api/deployments/{ID}` with `x-api-key` until `READY` → smoke-test prod mobile
