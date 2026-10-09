# Contact Buttons (About Page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-editable WhatsApp and email buttons below the author name on the About page.

**Architecture:** Two pure helpers normalize admin-entered contact values into `wa.me`/`mailto:` URLs. The About page (async server component) reads site settings via the existing cached settings getter and renders each button only when its value exists. A new `contact_whatsapp` field joins the existing admin settings form; the existing PUT→RPC→`invalidateSettings()` flow needs no changes.

**Tech Stack:** Next.js App Router (server components), Vitest, Tailwind-free scoped `<style>` blocks, InsForge settings (`site_settings` table, `admin_upsert_setting` RPC).

**Repo rules (override skill defaults):** NEVER commit or push — all changes stay uncommitted. PowerShell 5.1: chain with `;`, never `&&`. Use `curl.exe` for HTTP probes. No lint script exists in this repo (lint step is skipped everywhere and reported as unavailable).

**Spec:** `docs/superpowers/specs/2026-09-27-contact-buttons-design.md`

---

### Task 1: Contact URL helpers (TDD)

**Files:**
- Create: `lib/contact.test.ts`
- Create: `lib/contact.ts`

- [ ] **Step 1: Write the failing test file `lib/contact.test.ts` (complete content)**

```ts
import { describe, it, expect } from "vitest"
import { toMailtoUrl, toWhatsAppUrl } from "./contact"

describe("toWhatsAppUrl", () => {
  it("converts BD local format to international 880", () => {
    expect(toWhatsAppUrl("01712-345678")).toBe("https://wa.me/8801712345678")
  })

  it("normalizes international format with +, spaces and dashes", () => {
    expect(toWhatsAppUrl("+880-1712 345 678")).toBe("https://wa.me/8801712345678")
  })

  it("keeps already-880 numbers unchanged", () => {
    expect(toWhatsAppUrl("8801712345678")).toBe("https://wa.me/8801712345678")
  })

  it("leaves non-BD international numbers unchanged", () => {
    expect(toWhatsAppUrl("+1 415 555 2671")).toBe("https://wa.me/14155552671")
  })

  it("returns null for empty or non-numeric input", () => {
    expect(toWhatsAppUrl("")).toBeNull()
    expect(toWhatsAppUrl("   ")).toBeNull()
    expect(toWhatsAppUrl(null)).toBeNull()
    expect(toWhatsAppUrl(undefined)).toBeNull()
    expect(toWhatsAppUrl("abc")).toBeNull()
  })

  it("returns null when fewer than 7 digits", () => {
    expect(toWhatsAppUrl("012345")).toBeNull()
    expect(toWhatsAppUrl("12-34")).toBeNull()
  })
})

describe("toMailtoUrl", () => {
  it("builds a mailto URL and trims whitespace", () => {
    expect(toMailtoUrl(" reader@example.com ")).toBe("mailto:reader@example.com")
  })

  it("returns null for empty or missing @", () => {
    expect(toMailtoUrl("")).toBeNull()
    expect(toMailtoUrl("   ")).toBeNull()
    expect(toMailtoUrl(null)).toBeNull()
    expect(toMailtoUrl("not-an-email")).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run (workdir `H:\website`): `npx vitest run lib/contact.test.ts`
Expected: FAIL — cannot resolve `./contact` (module not found).

- [ ] **Step 3: Write the implementation `lib/contact.ts` (complete content)**

```ts
export function toWhatsAppUrl(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "")
  if (digits.length < 7) return null
  let normalized: string
  if (digits.startsWith("880")) {
    normalized = digits
  } else if (digits.startsWith("0")) {
    normalized = `880${digits.slice(1)}`
  } else {
    normalized = digits
  }
  return `https://wa.me/${normalized}`
}

export function toMailtoUrl(value: unknown): string | null {
  const email = String(value ?? "").trim()
  if (!email.includes("@")) return null
  return `mailto:${email}`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/contact.test.ts`
Expected: PASS — 8/8 tests.

- [ ] **Step 5: Do not commit** (repo rule: all changes stay uncommitted).

---

### Task 2: Admin settings field

**Files:**
- Modify: `app/admin/settings/page.tsx:18-19` (SETTING_GROUPS → সাধারণ group fields)

- [ ] **Step 1: Add the `contact_whatsapp` field**

In `SETTING_GROUPS`, the সাধারণ `fields` array currently contains:

```ts
      { key: "site_name", label: "সাইটের নাম", type: "text" },
      { key: "site_tagline", label: "ট্যাগলাইন", type: "text" },
      { key: "contact_email", label: "ইমেইল", type: "text" },
      { key: "contact_phone", label: "ফোন", type: "text" },
```

Change it to:

```ts
      { key: "site_name", label: "সাইটের নাম", type: "text" },
      { key: "site_tagline", label: "ট্যাগলাইন", type: "text" },
      { key: "contact_email", label: "ইমেইল", type: "text" },
      { key: "contact_phone", label: "ফোন", type: "text" },
      { key: "contact_whatsapp", label: "হোয়াটসঅ্যাপ", type: "text" },
```

No API/DB change: `PUT /api/admin/settings` upserts arbitrary keys via the `admin_upsert_setting` RPC (verified: `site_settings(key text, value jsonb, category text)`; current `contact_email` row exists with value `""`; no `contact_whatsapp` row yet — the RPC inserts it on first save).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Do not commit** (repo rule).

---

### Task 3: About page buttons

**Files:**
- Modify: `app/about/page.tsx`

- [ ] **Step 1: Add imports**

At the top of `app/about/page.tsx`, after the existing imports (`ScrollReveal` is last), add:

```ts
import { getCachedSiteSettings } from "@/lib/public-cache"
import { toMailtoUrl, toWhatsAppUrl } from "@/lib/contact"
```

- [ ] **Step 2: Make the component async and read settings**

Replace:

```ts
export default function AboutPage() {
  return (
```

with:

```ts
export default async function AboutPage() {
  const settings = await getCachedSiteSettings()
  const whatsappUrl = toWhatsAppUrl(settings.contact_whatsapp)
  const emailUrl = toMailtoUrl(settings.contact_email)

  return (
```

(`SiteSettings` is `Record<string, any>`, so the property reads type-check directly against the `unknown` parameters.)

- [ ] **Step 3: Render the buttons below the author name**

Replace:

```tsx
            <figcaption>প্রদীপ কুমার আচার্য্য</figcaption>
          </figure>
```

with:

```tsx
            <figcaption>প্রদীপ কুমার আচার্য্য</figcaption>
            {(whatsappUrl || emailUrl) && (
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
                {emailUrl && (
                  <a className="about-contact-btn about-contact-email" href={emailUrl}>
                    ইমেইল
                  </a>
                )}
              </div>
            )}
          </figure>
```

- [ ] **Step 4: Add styles to the page's scoped `<style>` block**

Inside the existing `<style>{` ... `}</style>` block, after the `.about-photo figcaption { ... }` rule, add:

```css
        .about-contact {
          display: flex;
          justify-content: center;
          gap: var(--sp-3);
          margin-top: var(--sp-3);
        }
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
        .about-contact-whatsapp {
          background: #25d366;
          color: #ffffff;
        }
        .about-contact-whatsapp:hover {
          background: #1eb854;
        }
        .about-contact-email {
          background: transparent;
          border-color: var(--border);
          color: var(--ink);
        }
        .about-contact-email:hover {
          border-color: var(--ink);
        }
        .about-contact-btn:focus-visible {
          outline: 2px solid var(--primary, #8b1e3f);
          outline-offset: 2px;
        }
```

Also add `.about-contact-btn { transition: none; }` inside the existing `@media (prefers-reduced-motion: reduce)` block.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Do not commit** (repo rule).

---

### Task 4: Full local verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite with the env preamble**

Run (single PowerShell command):

```powershell
$env:NEXT_PUBLIC_INSFORGE_URL="https://cpd9mnqf.ap-southeast.insforge.app"; $env:NEXT_PUBLIC_INSFORGE_ANON_KEY="<REDACTED-ANON-KEY>"; npx vitest run
```

Expected: 49/49 pass (41 existing + 8 new contact tests). (Without the env preamble, 2 `resolveCoverImage` tests fail — env-dependent, not a code bug.)

- [ ] **Step 2: Type-check again**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `/about` route compiles (no lint step — repo has no lint script).

- [ ] **Step 4: Do not commit** (repo rule).

---

### Task 5: Deploy and live verification

**Files:** none (deploy + verification; script written to temp dir only)

- [ ] **Step 1: Deploy**

Run (workdir `H:\website`): `npx -y @insforge/cli deployments deploy . --json`
Expected: JSON with a deployment id. Poll until READY: `npx -y @insforge/cli deployments status <ID> --json` every 30s (deployments typically take 3–10 minutes). Fallback listing: `npx -y @insforge/cli deployments list --json`.

- [ ] **Step 2: Verify empty state on live (values are currently empty)**

```powershell
$code = curl.exe -s -o NUL -w "%{http_code}" https://pradipbooks.insforge.site/about
$html = curl.exe -s https://pradipbooks.insforge.site/about
"status: $code"
if ($html -match "wa\.me") { "FAIL: unexpected wa.me link" } else { "OK: no wa.me link" }
if ($html -match "mailto:") { "FAIL: unexpected mailto link" } else { "OK: no mailto link" }
```

Expected: `status: 200`, both OK (empty values → buttons hidden).

- [ ] **Step 3: Write the round-trip script to `%TEMP%\opencode\admin-roundtrip.js`**

Exact content (UTF-8 via the Write tool; path `C:\Users\Tonmoy\AppData\Local\Temp\opencode\admin-roundtrip.js`):

```js
const TARGET = "https://pradipbooks.insforge.site";

const page = await browser.newPage();

await page.goto(TARGET + "/login", { waitUntil: "domcontentloaded" });
await page.fill("#auth-email", "admin@pradeepacharya.com");
await page.fill("#auth-password", "admin123");
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);
console.log("login landed on:", page.url());

await page.goto(TARGET + "/admin/settings", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".admin-form-group", { timeout: 15000 });

const waInput = page.locator(".admin-form-group", { hasText: "হোয়াটসঅ্যাপ" }).locator("input");
const mailInput = page.locator(".admin-form-group", { hasText: "ইমেইল" }).locator("input");
const waCount = await waInput.count();
const mailCount = await mailInput.count();
if (waCount !== 1 || mailCount !== 1) {
  throw new Error("settings fields not found: " + JSON.stringify({ waCount, mailCount }));
}

await waInput.fill("01712-345678");
await mailInput.fill("test@example.com");
await page.click('button:has-text("সেভ করুন")');
await page.waitForSelector(".admin-alert-success", { timeout: 15000 });
console.log("settings saved via admin panel");

let waHref = null;
let mailHref = null;
for (let i = 0; i < 8; i++) {
  await page.goto(TARGET + "/about", { waitUntil: "domcontentloaded" });
  const waLoc = page.locator("a.about-contact-whatsapp");
  const mailLoc = page.locator("a.about-contact-email");
  if ((await waLoc.count()) > 0 && (await mailLoc.count()) > 0) {
    waHref = await waLoc.getAttribute("href");
    mailHref = await mailLoc.getAttribute("href");
    break;
  }
  await page.waitForTimeout(3000);
}
console.log(JSON.stringify({ waHref, mailHref }));
if (waHref !== "https://wa.me/8801712345678") throw new Error("WhatsApp href mismatch: " + waHref);
if (mailHref !== "mailto:test@example.com") throw new Error("Email href mismatch: " + mailHref);
const shotPath = await saveScreenshot(await page.screenshot(), "about-buttons.png");
console.log("screenshot:", shotPath);

await page.goto(TARGET + "/admin/settings", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".admin-form-group", { timeout: 15000 });
await page.locator(".admin-form-group", { hasText: "হোয়াটসঅ্যাপ" }).locator("input").fill("");
await page.locator(".admin-form-group", { hasText: "ইমেইল" }).locator("input").fill("");
await page.click('button:has-text("সেভ করুন")');
await page.waitForSelector(".admin-alert-success", { timeout: 15000 });
console.log("values restored to empty");

let hidden = false;
for (let i = 0; i < 8; i++) {
  await page.goto(TARGET + "/about", { waitUntil: "domcontentloaded" });
  if ((await page.locator(".about-contact").count()) === 0) {
    hidden = true;
    break;
  }
  await page.waitForTimeout(3000);
}
console.log("buttons hidden after restore:", hidden);
if (!hidden) throw new Error("buttons still visible after restore");
console.log("ROUNDTRIP OK");
```

Notes:
- `browser.newPage()` is an isolated context (fresh storage) → always starts logged out; the session lives inside that context for the whole script.
- The default login tab is `signin` (`app/login/page.tsx:9`), so `#auth-email` / `#auth-password` + submit sign in (no tab click needed).
- Finding the `হোয়াটসঅ্যাপ` field (`waCount === 1`) also proves the Task 2 field is live.
- The script is idempotent: if it fails mid-way, test values may remain — re-running it re-saves, verifies, and clears them.

- [ ] **Step 4: Run the round-trip script**

Run: `dev-browser --timeout 120 run "C:\Users\Tonmoy\AppData\Local\Temp\opencode\admin-roundtrip.js"`
Expected output ends with: `ROUNDTRIP OK`, plus `waHref: "https://wa.me/8801712345678"`, `mailHref: "mailto:test@example.com"`, `buttons hidden after restore: true`, and a screenshot path.

Recovery on mismatch: wait 70 seconds (settings data-cache TTL backstop is 60s) and re-run the same script — it is idempotent and always clears values on success. If login itself fails, screenshot the page (`saveScreenshot(await page.screenshot(), "login-debug.png")`) and inspect before retrying.

- [ ] **Step 5: Confirm DB and live state are clean**

```powershell
npx -y @insforge/cli --json db query "SELECT key, value FROM site_settings WHERE key IN ('contact_email','contact_whatsapp')"
$code = curl.exe -s -o NUL -w "%{http_code}" https://pradipbooks.insforge.site/about
$html = curl.exe -s https://pradipbooks.insforge.site/about
"status: $code"
if ($html -match "wa\.me|mailto:") { "FAIL: links present" } else { "OK: no contact links" }
```

Expected: both rows have value `""`; `status: 200`; `OK: no contact links`.

- [ ] **Step 6: Final local checks and no commit**

Run: `npx tsc --noEmit` (0 errors). Do not commit (repo rule). Report to the user: files changed, test/build/deploy results, screenshot path, and that real values can now be entered in **অ্যাডমিন → সেটিংস → সাধারণ → হোয়াটসঅ্যাপ / ইমেইল**.
