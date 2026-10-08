# Contact Icons (About Page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the About-page WhatsApp/Email button text labels with icon-only inline SVG glyphs (approach A), keeping pill shapes, colors, and link behavior.

**Architecture:** Single-file UI edit in `app/about/page.tsx` — swap label text for 22px `currentColor` SVGs, add `aria-label`/`title` to the links, convert button padding to a 44×44 icon-button box. Verification via tsc, build, and live browser checks.

**Tech Stack:** Next.js 16 (React 19), inline SVG (repo convention — no icon library), scoped `<style>` block already in the page.

**Repo rules (override skill defaults):** NEVER commit or push — all changes stay uncommitted; HEAD must remain `3d6241f`. PowerShell 5.1: chain with `;`, never `&&`. Deploy: `npx -y @insforge/cli deployments deploy . --json` (timeout 600000).

**Spec:** `docs/superpowers/specs/2026-09-27-contact-icons-design.md`

---

### Task 1: Markup + styles in `app/about/page.tsx`

**Files:**
- Modify: `app/about/page.tsx:44-58` (`.about-contact` block)
- Modify: `app/about/page.tsx:157-167` (`.about-contact-btn` rule)

- [ ] **Step 1: Replace the button markup**

Old (lines 44–58):

```tsx
            <div className="about-contact">
              {whatsappUrl && (
                <a
                  className="about-contact-btn about-contact-whatsapp"
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  হোয়াটসঅ্যাপ
                </a>
              )}
              <Link href="/contact" className="about-contact-btn about-contact-email">
                ইমেইল
              </Link>
            </div>
```

New:

```tsx
            <div className="about-contact">
              {whatsappUrl && (
                <a
                  className="about-contact-btn about-contact-whatsapp"
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="হোয়াটসঅ্যাপে বার্তা পাঠান"
                  title="হোয়াটসঅ্যাপে বার্তা পাঠান"
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                </a>
              )}
              <Link
                href="/contact"
                className="about-contact-btn about-contact-email"
                aria-label="যোগাযোগ ফর্ম"
                title="যোগাযোগ ফর্ম"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
              </Link>
            </div>
```

- [ ] **Step 2: Replace the `.about-contact-btn` style rule**

Old (lines 157–167):

```css
        .about-contact-btn {
          display: inline-flex;
          align-items: center;
          padding: var(--sp-2) var(--sp-4);
          border-radius: var(--radius-md);
          border: 1px solid transparent;
          font-size: 0.875rem;
          font-weight: 600;
          text-decoration: none;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
```

New:

```css
        .about-contact-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          border: 1px solid transparent;
          text-decoration: none;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
```

(Unchanged: `.about-contact` container, `.about-contact-whatsapp`/`-email` colors, `:hover`, `:focus-visible`, reduced-motion override.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no output (exit 0). Failure = JSX syntax error → fix and re-run.

### Task 2: Production build

**Files:** none new (Task 1 edits only)

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, `/about` listed, exit 0.

### Task 3: Deploy + live verification

**Files:** none new

- [ ] **Step 1: Deploy**

Run: `npx -y @insforge/cli deployments deploy . --json`
Expected (timeout 600000): `"status": "READY"`, url `https://pradipbooks.insforge.site`. Capture deployment id.

- [ ] **Step 2: A11y + render check**

Browser → `https://pradipbooks.insforge.site/about`, take a11y snapshot:
Expected: two links named `হোয়াটসঅ্যাপে বার্তা পাঠান` (url `https://wa.me/8801761575734`) and `যোগাযোগ ফর্ম` (url `…/contact`); no visible button text; each contains one `svg`. Screenshot confirms: WhatsApp glyph white on green pill, envelope glyph dark on outlined pill, both ~22px, pills ~44×44, layout unchanged (figcaption still above, centered row).

- [ ] **Step 3: Interaction checks**

- Hover each button (visual hover state changes), `Tab` to each → focus outline visible.
- Click Email → same-tab navigation to `/contact`, form present.
- Back → click WhatsApp → new tab opens `wa.me/8801761575734` (close it).
- Resize to ≤720px (mobile): buttons stay 44×44, no overflow.

- [ ] **Step 4: Final regression**

Run: `npx tsc --noEmit; npm run build` — both clean. Confirm nothing committed: `git status --short` shows modified/untracked files only; `git log --oneline -1` = `3d6241f …`.

**Fallback:** if either glyph renders incorrectly (malformed path), replace that `d` attribute with the canonical source (WhatsApp: simple-icons `whatsapp.svg`; envelope: Google Material Icons `mail`) and repeat Tasks 2–3.

**Not in scope:** no lint run (no `lint` script exists — report unavailable), no email/WhatsApp link behavior changes, no other pages.
