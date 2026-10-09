# Mobile Homepage Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 mobile homepage issues (390–640px) with minimal CSS/markup patches; desktop (>640px) unchanged except featured `<h1>`→`<h2>`.

**Architecture:** Move featured section inline styles to `.featured-grid`/`.featured-actions` classes in `globals.css`, strengthen hero overlay and stack CTAs at ≤640px, keep `.book-grid` 2-up at all widths, shrink mobile `section-padding`, and demote the featured title to `<h2>` (hero keeps the only `<h1>`).

**Tech Stack:** Next.js 16 (App Router), plain CSS in `app/globals.css`, TypeScript check via `npx tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-09-26-mobile-homepage-fixes-design.md`

**Note:** Do NOT commit or push unless the user explicitly asks (repo convention). Verification = tsc + visual checks; there are no unit tests for CSS (existing vitest suite is unrelated but must still pass).

---

### Task 1: Featured section markup + CSS (issues #1, #6, #7)

**Files:**
- Modify: `app/page.tsx:58-91`
- Modify: `app/globals.css` (insert after `.book-grid` media queries, ~line 337)

- [ ] **Step 1: Replace featured section markup in `app/page.tsx`**

Replace the whole `{highlight && ( ... )}` block (current lines 58–91) with:

```tsx
      {/* Featured Highlight */}
      {highlight && (
        <section className="section-padding" style={{ background: "var(--bg-alt)" }}>
          <div className="container">
            <ScrollReveal>
              <div className="featured-grid">
                <div>
                  <span className="badge badge-terracotta" style={{ marginBottom: "var(--sp-4)" }}>বিশেষ প্রকাশনা</span>
                  <h2 className="featured-title">{highlight.title}</h2>
                  <p style={{ fontSize: "1.0625rem", marginBottom: "var(--sp-4)" }}>
                    {highlight.description}
                  </p>
                  <div className="featured-actions">
                    <Link href={`/book/${highlight.id}`} className="btn btn-primary">
                      এখনই কিনুন
                    </Link>
                    <Link href="/novels" className="btn btn-secondary">
                      সকল উপন্যাস
                    </Link>
                  </div>
                </div>
                <div className="featured-media">
                  <img
                    src={highlight.images.primary}
                    alt={highlight.title}
                    width={900}
                    height={600}
                    style={{ width: "100%", height: "auto", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)" }}
                  />
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}
```

Changes vs. current: inline `gridTemplateColumns` → `className="featured-grid"`; `<h1 style={{marginBottom}}>` → `<h2 className="featured-title">`; flex inline style → `className="featured-actions"`; image wrapper gets `className="featured-media"`.

- [ ] **Step 2: Add featured CSS to `app/globals.css`**

Insert immediately after the `@media (max-width: 480px) { .book-grid { ... } }` block (after line 337):

```css
/* --- Featured Highlight --- */
.featured-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-12);
  align-items: center;
}

.featured-title {
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  margin-bottom: var(--sp-4);
}

.featured-actions {
  display: flex;
  gap: var(--sp-4);
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .featured-grid {
    grid-template-columns: 1fr;
    gap: var(--sp-8);
  }

  .featured-media {
    order: -1;
  }
}

@media (max-width: 480px) {
  .featured-actions {
    flex-direction: column;
  }

  .featured-actions .btn {
    width: 100%;
    text-align: center;
  }
}
```

`featured-title` font-size matches the old `<h1>` global (`clamp(1.75rem, 4vw, 2.5rem)`, `globals.css:141-143`) so visual weight is preserved after the semantic change.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (exit 0)

---

### Task 2: Hero overlay + CTA stacking (issues #2, #3)

**Files:**
- Modify: `app/globals.css:1456-1465` (overlay ≤640px)
- Modify: `app/globals.css:1534-1545` (actions media query)

- [ ] **Step 1: Strengthen mobile hero overlay**

Replace the ≤640px `.hero-overlay` block (lines 1456–1465) with:

```css
@media (max-width: 640px) {
  .hero-overlay {
    background: linear-gradient(
      to bottom,
      rgba(22, 19, 15, 0.25) 0%,
      rgba(22, 19, 15, 0.65) 45%,
      rgba(22, 19, 15, 0.88) 100%
    );
  }
}
```

- [ ] **Step 2: Stack hero CTAs at ≤640px**

Replace the `@media (max-width: 480px)` block wrapping `.hero-actions` (lines 1534–1545) with the same rules at 640px:

```css
@media (max-width: 640px) {
  .hero-actions {
    flex-direction: column;
    width: 100%;
    max-width: 280px;
  }

  .hero-actions .btn {
    width: 100%;
    text-align: center;
  }
}
```

Leave `.hero-content` padding/safe-area as-is (already correct).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (exit 0)

---

### Task 3: Book grid + section spacing (issues #4, #5)

**Files:**
- Modify: `app/globals.css:327-337` (book-grid media queries)
- Modify: `app/globals.css:172-174` (section-padding)

- [ ] **Step 1: Keep book grid 2-up at ≤480px**

Replace the book-grid media queries (lines 327–337):

```css
@media (max-width: 820px) {
  .book-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .book-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--sp-4);
  }
}
```

(Deletes the `1fr` single-column rule; adds tighter gap at ≤480px.)

- [ ] **Step 2: Shrink mobile section padding**

After the `.section-padding` rule (line 172–174), add:

```css
@media (max-width: 640px) {
  .section-padding {
    padding-block: var(--sp-10);
  }
}
```

(`--sp-10: 40px` vs `--sp-16: 64px` — closes the empty band between stacked sections.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (exit 0)

---

### Task 4: Verification

**Files:** none (read-only checks)

- [ ] **Step 1: Full typecheck + existing tests**

Run: `npx tsc --noEmit` then `npx vitest run lib/auth-helpers.test.ts lib/api.test.ts`
Expected: tsc exit 0; vitest `16 passed`

- [ ] **Step 2: Visual check (local dev or after deploy)**

Check at 390×844 and 640×900:
1. Featured section stacks: image on top, text below; CTAs stack full-width ≤480px
2. Hero copy readable over video; both CTAs stacked ≤640px
3. Book cards 2-up at 390px (no 1-column)
4. No large empty band between author intro and featured
5. Page has exactly one `<h1>` (hero) — verify: `document.querySelectorAll('h1').length === 1`

- [ ] **Step 3: Fix any visual regressions found**

If a check fails, patch `globals.css`/`page.tsx` and re-run Step 1–2.

---

### Task 5: Deploy + production smoke test

**Files:** none (deploy scripts)

- [ ] **Step 1: Deploy**

Run: `node scripts/deploy-direct.mjs`
Expected: prints a deployment ID (script runs `npx tsc --noEmit` first).

- [ ] **Step 2: Poll until READY**

Poll `GET https://cpd9mnqf.ap-southeast.insforge.app/api/deployments/{ID}` with header `x-api-key: <REDACTED-ADMIN-KEY>` every ~15s until `"status": "READY"` (not `/status` — that 404s).

- [ ] **Step 3: Smoke-test prod mobile**

Open `https://pradipbooks.insforge.site` at 390px: confirm the 5 visual checks from Task 4 Step 2.

---

## Self-Review

1. **Spec coverage:** Issues 1+6+7 → Task 1; issues 2+3 → Task 2; issues 4+5 → Task 3; verification/deploy → Tasks 4–5. ✅
2. **Placeholder scan:** All steps contain exact code/commands. ✅
3. **Type consistency:** Class names `.featured-grid`, `.featured-title`, `.featured-actions`, `.featured-media` match between Task 1 markup and CSS. ✅
