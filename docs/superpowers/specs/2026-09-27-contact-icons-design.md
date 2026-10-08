# Contact Icons Design — About Page Icon-Only Buttons

**Date:** 2026-09-27
**Status:** Approved (approach A)
**Scope:** `app/about/page.tsx` only

## Goal

Replace the text labels of the two About-page contact buttons (WhatsApp, Email) with icons only — per user choice "Icon only" over icon+text and circular variants.

## Decision (Approach A)

Keep the existing pill-shaped buttons and their colors/hover/focus behavior; swap the label text for a single centered glyph each, and add accessible names.

## Changes

### Markup (`app/about/page.tsx`, `.about-contact` block, currently lines 44–58)

- WhatsApp link (conditional on `whatsappUrl`, unchanged):
  - Label text `হোয়াটসঅ্যাপ` removed; replaced by inline SVG, `aria-hidden="true"`, `focusable="false"`, `width="22" height="22" viewBox="0 0 24 24"`, `fill="currentColor"` (renders white via `.about-contact-whatsapp { color: #fff }`).
  - Glyph: filled WhatsApp brand mark (simple-icons path).
  - Link gains `aria-label="হোয়াটসঅ্যাপে বার্তা পাঠান"` and `title="হোয়াটসঅ্যাপে বার্তা পাঠান"`.
  - `target="_blank"`, `rel="noopener noreferrer"`, `href={whatsappUrl}` unchanged.
- Email link (`<Link href="/contact">`, unchanged destination):
  - Label text `ইমেইল` removed; replaced by inline SVG, same sizing conventions.
  - Glyph: filled envelope (Material "mail" style path) — fills visually balance the solid WhatsApp mark.
  - Link gains `aria-label="যোগাযোগ ফর্ম"` and `title="যোগাযোগ ফর্ম"`.

### Styles (page's existing scoped `<style>` block)

`.about-contact-btn`:
- Replace `padding: var(--sp-2) var(--sp-4)` with square icon-button sizing: `padding: 0`, `width: 44px`, `height: 44px`, `justify-content: center` (44px meets touch-target minimum; `display: inline-flex`/`align-items: center` already set).
- Remove `font-size` and `font-weight` (no text remains).
- Everything else unchanged: `border-radius: var(--radius-md)`, colors (`#075E54` / hover `#064E47`; transparent / `var(--border)` / hover `var(--ink)`), `focus-visible` outline, `transition`, reduced-motion override.

`.about-contact` container: unchanged (flex, centered, `gap: var(--sp-3)`, `order: 1`).

## Non-Goals

- No change to `toWhatsAppUrl`, link targets, button order, or `/contact` route.
- No icon library dependency (repo convention is inline SVG).
- No circular variant (declined), no icon+text variant (declined).
- Not applied to the footer/other nav links.

## Verification

1. `npx tsc --noEmit` clean; `npm run build` clean (no lint script exists).
2. Browser (live after deploy): both glyphs render at 22px, correctly colored; buttons ~44×44; hover and `focus-visible` still work; `aria-label` present in a11y snapshot for both links.
3. Click-through: WhatsApp opens `wa.me` in new tab; Email navigates same-tab to `/contact` with working form.
4. Mobile width (≤720px): buttons keep size, no layout break under `.about-photo`.
5. Nothing committed (repo rule: working tree stays uncommitted).
