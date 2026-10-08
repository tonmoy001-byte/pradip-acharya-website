# Design: Contact Form → Gmail (No Database)

**Date:** 2026-09-27
**Status:** Approved
**Scope:** A public contact form at `/contact` that emails submissions to an admin-configurable Gmail inbox via server-side SMTP. No message storage of any kind.

## Goal

Let visitors contact the author through a form; every submission arrives as a normal email in the owner's Gmail inbox, where it is read and replied to (Reply-To = visitor). Explicit non-goal: no ContactMessage table, no dashboard, no storage — Gmail is the inbox of record.

## User decisions (this session)

| Decision | Choice |
|---|---|
| Recipient inbox | **Admin-configurable** — reuse existing `site_settings.contact_email` (অ্যাডমিন → সেটিংস → সাধারণ → ইমেইল). Changeable anytime, no redeploy. Current value: `itay89640@gmail.com` |
| About page `ইমেইল` button | **Points to `/contact`** (internal link, same tab). Gmail-compose behavior is replaced |
| Spam protection | **Honeypot + minimum-time + per-IP rate limit** (no CAPTCHA) |
| `/contact` page content | **Form only** — existing পাঠক সহায়তা / অর্ডার সহায়তা sections and placeholder email removed entirely |
| Email sender | **Gmail SMTP via nodemailer + Gmail App Password** (chosen over Resend free tier and InsForge Pro upgrade; InsForge plan is `free`, custom email requires paid) |

## Architecture & data flow

```text
Visitor (/contact form, client component)
   → POST /api/contact                      (Next.js route handler, Node runtime)
       ├─ 1. honeypot + minimum-time + per-IP rate-limit checks (reject = silent fake success)
       ├─ 2. server-side validation (never trust the browser)
       ├─ 3. recipient = await getSiteSettings() → contact_email   (read-only)
       ├─ 4. sanitize (strip CR/LF from name/subject/email/message)
       └─ 5. nodemailer → smtp.gmail.com:587 (STARTTLS), auth GMAIL_USER / GMAIL_APP_PASSWORD
   → Email:  To: contact_email
             From: GMAIL_USER (display name: site/author name)
             Reply-To: visitor email
             Subject: "Website Contact: <subject or (no subject)>"
   → Owner reads in Gmail, clicks Reply → goes to visitor. Nothing persisted. ✔ no DB
```

Failure paths (all produce a friendly Bengali inline message; details logged server-side only, never credentials):

| Condition | API response | Visitor sees |
|---|---|---|
| Invalid input | `400` + field errors | Red inline message |
| Honeypot filled / too-fast submit (`startedAt` < 3 s or missing) | `200 { ok: true }` (indistinguishable from success) | Fake success (bots learn nothing) |
| Rate limit exceeded (3+ sends / 10 min / IP) | `429` | Red inline message: try again in a few minutes |
| `contact_email` empty | `503` | "যোগাযোগ ইমেইল সেটআপ করা হয়নি" style message |
| SMTP error / timeout (10s) | `502` | "পাঠানো যায়নি, অনুগ্রহ করে আবার চেষ্টা করুন" style message |
| Success | `200 { ok: true }` | Green confirmation, form resets |

## Frontend

### `/contact` page (`app/contact/page.tsx`)

- Server component shell keeps existing metadata (title `যোগাযোগ | প্রদীপ কুমার আচার্য্য`).
- Content: `page-header` heading **যোগাযোগ** + the form component only. Max-width 600px centered container (as today). All existing help sections and the placeholder `info@pradeep-acharya.example.com` block are removed.

### `components/ContactForm.tsx` (new client component)

- Fields (Bengali labels, `*` = required):

  | Field | Name | Required | Limits |
  |---|---|---|---|
  | নাম | `name` | yes | 2–100 |
  | ইমেইল | `email` | yes | basic email shape, ≤254 |
  | বিষয় | `subject` | no | ≤200 |
  | বার্তা | `message` | yes | 10–5000 |
  | (honeypot) | `website` | — | hidden; any value = bot |

- Honeypot field: visually hidden (position absolute off-screen, 1×1, `aria-hidden="true"`, `tabIndex={-1}`, `autoComplete="off"`), not rendered inside a `<label>`.
- Anti-bot timestamp: client captures mount time into a hidden `startedAt` field; server rejects (as fake-success) submissions with `Date.now() - startedAt < 3000` **or** `startedAt` missing/absent.
- Submit button: disabled + label **পাঠানো হচ্ছে…** while pending.
- Success: green inline alert (e.g., **আপনার বার্তা পাঠানো হয়েছে। ধন্যবাদ!**), form fields reset.
- Error: red inline alert with the API's Bengali message.
- Client-side HTML5 validation (`required`, `type="email"`, `maxLength`) for fast feedback only — server re-validates everything.
- Styling: existing CSS custom properties (`var(--border)`, `var(--terracotta)`, radius/spacing vars) matching the site's admin/login forms; buttons follow site button styles. No new CSS framework.

### About page (`app/about/page.tsx`)

- Replace the Gmail-compose anchor with an internal link keeping the same classes:
  `<Link href="/contact" className="about-contact-btn about-contact-email">ইমেইল</Link>`
  (no `target="_blank"` — same-tab internal navigation; WhatsApp button unchanged).
- Remove `toGmailComposeUrl` entirely: the import/usage in this page, the function in `lib/contact.ts`, and its 3 tests in `lib/contact.test.ts` (dead code once the page stops using it; `toWhatsAppUrl` untouched).

## API — `app/api/contact/route.ts` (new)

- `POST` only; `export const runtime = "nodejs"`; JSON body ≤ 10 KB.
- **Pure logic lives in `lib/contact-form.ts`** (unit-testable, no I/O):
  - `validateContactInput(payload)` → `{ ok: true, data }` or `{ ok: false, errors }` with limits above; unknown/extra keys ignored.
  - `sanitizeText(value)` → string with CR/LF (and surrounding control chars) stripped — applied to `name`, `subject`, `email` (header-injection defense) before building the email.
  - `isRateLimited(key, now, store)` → sliding window: **max 3 successful sends per 10 minutes per IP**, in-memory `Map` (cold starts reset it — accepted without a DB; Gmail's ~500/day is the backstop).
  - `buildContactEmail({ name, email, subject, message })` → `{ subject, text, html }`:
    - subject: `Website Contact: <sanitized subject>` or `Website Contact: (no subject)`
    - text part (owner format):
      ```text
      Name: Rahim Ahmed
      Email: rahim@gmail.com

      Message:

      Hello, I would like to discuss a website project.
      ```
    - html part: minimal escaped equivalent (same information, no remote assets).
- Route order: parse → honeypot/`startedAt` gate → validate → rate-limit → read recipient (`getSiteSettings()` — non-cached read so admin changes apply immediately) → sanitize → build → `nodemailer.createTransport({ host: "smtp.gmail.com", port: 587, secure: false, auth })` with **10s connection timeout** → send → `200`.
- Rate-limit counter increments only on **actual send success** (failed sends don't consume quota).
- Client IP: `x-forwarded-for` first hop (deployment runs behind the platform proxy).
- Logging: structured `console.error` with error message only — never env values or message bodies in production logs.

### nodemailer dependency

- Add `nodemailer` (+ `@types/nodemailer` as devDependency) to `package.json`. No other new runtime dependencies.

## Environment & secrets

| Var | Where | Scope |
|---|---|---|
| `GMAIL_USER` | deployment env + local `.env.local` | server-only (no `NEXT_PUBLIC_`) |
| `GMAIL_APP_PASSWORD` | deployment env + local `.env.local` | server-only (no `NEXT_PUBLIC_`) |

- `.env.local` is already gitignored by the Next.js template; **`.gitignore` must not be edited** (repo rule). No secrets in client bundles — route handler only.
- **Owner prerequisite (one-time, blocks live verification):** Google account → enable 2-Step Verification → create an App Password (16 chars) → provide both values for env config. Steps will be given at execution time.

## Testing (TDD — red/green per repo workflow)

Unit (vitest, pure functions in `lib/contact-form.test.ts`):

1. validation: each field's bounds (min/max/optional/email shape), extra-keys ignored
2. `sanitizeText`: strips `\r`, `\n`, `\r\n` sequences (header-injection regression test)
3. `buildContactEmail`: subject with/without value; text format matches owner spec; HTML escapes `<`, `&`, quotes
4. rate limiter: 3 allowed → 4th blocked within window; window slides open after expiry (fake timers)
5. honeypot/timing gate: honeypot filled → blocked; `startedAt` missing → blocked; < 3000 ms → blocked; normal submit passes

Integration (live, post-deploy):

- Real submission via the deployed form → owner confirms arrival in Gmail, subject format, body format, and **Reply-To = visitor address** (reply reaches the test address)
- Honeypot-filled submission → fake success, no email arrives
- 4 rapid submissions → 4th returns `429` (rate-limited) with the red inline message
- Admin changes `contact_email` → next submission goes to the new address (no redeploy)
- About page `ইমেইল` button navigates to `/contact`
- `npx tsc --noEmit` clean; full vitest suite green; `npm run build` succeeds; **no lint script exists** (reported as unavailable)

## Out of scope

- Message storage, admin inbox, read/unread status (explicit non-goal)
- CAPTCHA / Turnstile (honeypot chosen)
- Auto-reply/acknowledgment email to the visitor
- Keeping `toGmailComposeUrl`/`toMailtoUrl` (both removed — see About page section; `toWhatsAppUrl` untouched)
- Pre-existing deferred items: `getSiteSettings` error-swallow, proxy.ts soft-404, `/contact` email placeholder (this spec removes that placeholder as part of the page replacement)

## Repo constraints honored

- All changes remain **uncommitted** (repo rule overrides the skill's spec-commit step).
- No edits to `.gitignore`/`.superpowers/`; PowerShell 5.1 chains with `;` (never `&&`); `curl.exe` for HTTP probes.
- HEAD stays `3d6241f`.
