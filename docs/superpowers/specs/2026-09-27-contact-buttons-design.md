# Design: Admin-Editable WhatsApp & Email Buttons on About Page

**Date:** 2026-09-27
**Status:** Approved (Approach A)
**Scope:** Contact buttons below the author name on the About page, values managed from the admin panel.

## Goal

Let customers contact the author directly from the About page (below the author name under the photo) via WhatsApp and email, with both values editable later from the admin settings panel — no code changes, no redeploy.

## Data & Admin Panel

- **Keys:** reuse existing `contact_email`; add new `contact_whatsapp`. Both category `general`.
- **Admin UI:** one new field in `app/admin/settings/page.tsx` `SETTING_GROUPS` → সাধারণ group:
  `{ key: "contact_whatsapp", label: "হোয়াটসঅ্যাপ", type: "text" }`
- **No API or DB migration.** The existing `PUT /api/admin/settings` upserts arbitrary keys through the `admin_upsert_setting` RPC and then calls `invalidateSettings()`, clearing the `settings` cache tag. Homepage settings already work this way.
- **Propagation:** public reads go through `getCachedSiteSettings()` (`unstable_cache`, tag `settings`, revalidate 60s); admin save invalidates the tag immediately, with 60s as backstop.

## Rendering (About page)

`app/about/page.tsx` becomes an async server component:

1. `const settings = await getCachedSiteSettings()` (import from `@/lib/public-cache`).
2. Derive URLs via helpers: `toWhatsAppUrl(settings.contact_whatsapp)`, `toMailtoUrl(settings.contact_email)`.
3. Render below `<figcaption>প্রদীপ কুমার আচার্য্য</figcaption>` (inside the `<figure>`), centered:
   - **WhatsApp button** — `href` from helper, `target="_blank"`, `rel="noopener noreferrer"`, label `হোয়াটসঅ্যাপ`, solid WhatsApp-green (#25D366) with white text.
   - **Email button** — `href` from helper, label `ইমেইল`, neutral outline style (border `var(--border)`, ink text).
   - Each button renders **only if its URL is non-null**; both null → nothing renders, page looks exactly as today.
4. Styles added to the page's existing scoped `<style>` block: `.about-contact` flex row, centered, gap; pill-ish buttons (radius `var(--radius-md)`, padding, `font-size: 0.875rem`), hover + `focus-visible` states, no animation.

## Helpers

New `lib/contact.ts`:

- `toWhatsAppUrl(value: unknown): string | null` — coerce to string, trim, keep only digits; return `null` if empty or fewer than 7 digits **before** normalization (rejects junk early). Then normalize into Bangladesh international format:
  1. starts with `880` → unchanged (`+880-1712 345 678` → `8801712345678`)
  2. starts with `0` → replace the leading `0` with `880` (`01712-345678` → `8801712345678`)
  3. otherwise → unchanged (assumed already international)

  Returns `https://wa.me/<digits>`. Admin may enter either BD local (`017...`) or international (`+880...`) format.
- `toMailtoUrl(value: unknown): string | null` — trim; return `null` if empty or missing `@`, else `mailto:<trimmed>`. Intentionally lightweight — no full email validation (mail client handles real validity).

New `lib/contact.test.ts` — cases: BD local `01712-345678` → `8801712345678`; international `+880-1712 345 678` → `8801712345678`; already-`880` unchanged; other leading-`0` lengths still normalized; empty/null/garbage → null; fewer than 7 digits → null; valid email, empty/no-`@` → null.

## Error handling & degradation

- Settings fetch failure currently yields `{}` (pre-existing swallow in `getSiteSettings`, out of scope) → both helpers return null → buttons hidden. No crash, no wrong links.
- Empty/whitespace values in admin → button simply hidden.

## Out of scope

- `/contact` page placeholder email (follow-up candidate).
- `contact_phone` key — left unused.
- Fixing `getSiteSettings` error-swallowing / cache poisoning (previously deferred).
- proxy.ts / soft-404 fix (deferred).

## Verification

1. `npx tsc --noEmit` — 0 errors.
2. `npx vitest run` with env preamble — all tests pass (existing 41 + new contact tests).
3. No lint script exists in this repo (reported as unavailable).
4. `npm run build` locally, then `npx -y @insforge/cli deployments deploy .` from `H:\website` (poll to READY).
5. Live checks: About page renders with no buttons when values empty; set values via admin settings (admin creds on file), confirm both buttons render with correct `wa.me`/`mailto:` hrefs; then restore the values that existed before the test (clear them if they were empty) unless the user supplies real ones.

## Repo constraints honored

- All changes remain **uncommitted** (repo rule overrides the skill's spec-commit step).
- No edits to `.gitignore`/`.superpowers/`; PowerShell 5.1 chaining with `;`.

## Amendment (2026-09-27, post-deploy)

Two decisions supersede sections above, both user-approved after live testing:

1. **Email button href: `mailto:` → Gmail compose URL.** Production diagnosis found the site's `mailto:` link was correct, but the owner's machine has a broken mailto handler (Windows routes `mailto:` to Chrome, which has no mail handler; Outlook installed but not default), so clicks died silently. User chose: button opens `https://mail.google.com/mail/?view=cm&fs=1&to=<encoded>` directly (with `target="_blank"`), replacing `toMailtoUrl` with `toGmailComposeUrl` in `lib/contact.ts`. Tradeoff accepted: visitors using non-Gmail mail apps are directed to Gmail. The WhatsApp helper and rendering behavior are unchanged.
2. **DOM order deviation (from final review):** `<figcaption>` is the last child of `<figure>` (valid HTML) and appears visually above the buttons via `.about-photo { display: flex; flex-direction: column }` + `.about-contact { order: 1 }`. Screen readers announce the two links before the caption (accepted Minor). WhatsApp button color is `#075E54`/hover `#064E47` for WCAG AA contrast (white-on-#25d366 was 1.98:1).
