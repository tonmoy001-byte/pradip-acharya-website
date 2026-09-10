# Full Admin Panel — Implementation Plan

**Date:** 2026-09-03
**Spec:** `docs/superpowers/specs/2026-09-03-full-admin-panel.md`
**Stack:** Next.js App Router + TypeScript + InsForge SDK + PostgreSQL RPCs

---

## Overview

This plan builds a complete admin panel in 5 phases with 20 tasks. Each phase produces a deployable increment.

---

## Phase A: Database + Dashboard (4 tasks)

### Task 0: Create Database Tables via InsForge SQL

**Goal:** Create `posts`, `site_settings`, and `categories` tables in the InsForge database.

**Steps:**
1. Use `insforge_run-raw-sql` to create the three tables
2. Seed `site_settings` with default values
3. Seed `categories` with default categories
4. Verify tables exist by querying them

**Tables to create:**
- `posts` (id, title, slug, content, excerpt, cover_image, author_name, post_type, status, tags, meta_title, meta_description, published_at, created_at, updated_at)
- `site_settings` (key, value, category, updated_at)
- `categories` (id, name, slug, description, parent_id, sort_order, created_at)

**Verification:** List all tables via InsForge, confirm columns match spec.

---

### Task 1: Create Database RPC Functions

**Goal:** Create all admin RPC functions for book, post, and settings management.

**Functions to create (via `insforge_run-raw-sql`):**
- `admin_create_book(...)` → returns UUID
- `admin_update_book(...)` → returns void
- `admin_delete_book(p_book_id)` → returns void
- `admin_create_post(...)` → returns UUID
- `admin_update_post(...)` → returns void
- `admin_delete_post(p_post_id)` → returns void
- `admin_upsert_setting(p_key, p_value, p_category)` → returns void
- `get_site_settings()` → returns JSONB

**Grant permissions:** `GRANT EXECUTE ON FUNCTION admin_* TO authenticated;` and `GRANT EXECUTE ON FUNCTION get_site_settings() TO anon;`

**Verification:** Call each RPC from code to confirm they work.

---

### Task 2: Enhanced Dashboard Page

**Goal:** Replace the current redirect-only `/admin` page with a real dashboard.

**File:** `app/admin/dashboard/page.tsx` (new)
**File:** `app/api/admin/dashboard/route.ts` (new API route)

**Dashboard API (`GET /api/admin/dashboard`):**
Returns aggregated stats:
- Total orders, total revenue, paid orders
- Total books, total posts, total customers
- Recent 5 orders
- Recent 5 posts

**Dashboard UI:**
- 6 stat cards (2 rows of 3): orders, revenue, paid orders, books, posts, customers
- Recent orders mini-table
- Recent posts mini-table
- Quick action buttons: "বই যোগ করুন", "পোস্ট যোগ করুন"

**Update:** `app/admin/page.tsx` → redirect to `/admin/dashboard`

---

### Task 3: Updated Admin Sidebar

**Goal:** Expand the sidebar with full navigation.

**File:** `app/admin/layout.tsx`

**Sidebar links:**
1. ড্যাশবোর্ড → `/admin/dashboard`
2. বই ম্যানেজমেন্ট → `/admin/books`
3. পোস্ট ম্যানেজমেন্ট → `/admin/posts`
4. অর্ডার → `/admin/orders`
5. গ্রাহক → `/admin/customers`
6. সেটিংস → `/admin/settings`
7. সাইট দেখুন → `/` (target="_blank")
8. লগ আউট → sign out action

**Active state:** Highlight current section based on pathname.

---

## Phase B: Book Management (5 tasks)

### Task 4: Book List Page

**Goal:** Show all books in a filterable, searchable table.

**File:** `app/admin/books/page.tsx` (new)
**File:** `app/api/admin/books/route.ts` (new)

**API (`GET /api/admin/books`):**
- Fetch all books with their formats
- Support `?search=` and `?category=` query params
- Return books with format summary (prices)

**UI:**
- Search input (by title/author)
- Category filter dropdown
- Table: Cover thumbnail (40x56), Title, Author, Category, Format badges (price), Featured/New/Trending flags, Actions (Edit/Delete)
- Delete with confirmation modal (reuse RejectModal pattern)
- "বই যোগ করুন" button → `/admin/books/new`

---

### Task 5: Book Create/Edit Form

**Goal:** Full form for creating and editing books.

**Files:**
- `app/admin/books/new/page.tsx` (new)
- `app/admin/books/[id]/edit/page.tsx` (new)
- `components/admin/BookForm.tsx` (new, shared form component)

**Form fields:**
- Title (text, Bengali)
- Author (text, Bengali)
- Category (select: উপন্যাস / সাহিত্য / কবিতা / প্রবন্ধ)
- Subcategory (text, Bengali)
- Subcategory Slug (text, auto-generated)
- Description (textarea, Bengali)
- Synopsis (textarea, Bengali, optional)
- Cover Primary (file upload button)
- Cover Hover (file upload button, optional)
- Formats section:
  - Each format row: Name (select: Paperback/eBook), Price, CompareAtPrice, Available (toggle), DeliveryType (select: physical/digital)
  - "ফরম্যাট যোগ করুন" button to add rows
  - Remove button per row
- Checkboxes: Featured, New, Trending, Demo
- Save button → calls `admin_create_book` or `admin_update_book` RPC

**Cover upload:** On file select → `POST /api/admin/books/upload` (FormData) → get back storage key → set as `cover_primary` value.

---

### Task 6: Book Upload API Routes

**Goal:** File upload endpoints for covers and PDFs.

**Files:**
- `app/api/admin/books/upload/route.ts` (new) — cover images
- `app/api/admin/books/upload-pdf/route.ts` (new) — eBook PDFs

**Cover upload (`POST /api/admin/books/upload`):**
1. `requireAdmin()`
2. Parse FormData, get file
3. Generate path: `books/{filename}`
4. `client.storage.from('book-covers').upload(path, file, { contentType })`
5. Return `{ url: resolveCoverImage(path), path }`

**PDF upload (`POST /api/admin/books/upload-pdf`):**
1. `requireAdmin()`
2. Parse FormData, get file
3. Generate path: `ebooks/{filename}`
4. `client.storage.from('digital-books').upload(path, file, { contentType: 'application/pdf' })`
5. Return `{ storageKey: path }`

---

### Task 7: Book Delete + Edit API

**Goal:** Complete CRUD API for books.

**Files:**
- `app/api/admin/books/[id]/route.ts` (new)
- `app/api/admin/books/[id]/edit/route.ts` (if needed, or handle via same route)

**Routes:**
- `GET /api/admin/books/[id]` — return book with formats (for edit form)
- `PUT /api/admin/books/[id]` — call `admin_update_book` RPC
- `DELETE /api/admin/books/[id]` — call `admin_delete_book` RPC, also delete cover images from storage

---

### Task 8: Book Management Wiring + Test

**Goal:** Verify all book CRUD operations work end-to-end.

**Steps:**
1. Create a new book via form → verify it appears in list
2. Upload cover image → verify it displays
3. Edit the book → verify changes persist
4. Delete the book → verify it's removed
5. Test search and filter
6. Test on mobile viewport

---

## Phase C: Post Management (4 tasks)

### Task 9: Post List Page

**Goal:** Show all posts (blog + pages) in a filterable table.

**File:** `app/admin/posts/page.tsx` (new)
**File:** `app/api/admin/posts/route.ts` (new)

**API (`GET /api/admin/posts`):**
- Fetch all posts
- Support `?type=` (blog/page) and `?status=` (draft/published) filters

**UI:**
- Filter tabs: All / Blog / Pages
- Status filter: All / Draft / Published
- Table: Title, Type badge, Status badge, Date, Actions
- Delete with confirmation
- "পোস্ট যোগ করুন" button → `/admin/posts/new`

---

### Task 10: Post Create/Edit Form

**Goal:** Full form for creating and editing posts.

**Files:**
- `app/admin/posts/new/page.tsx` (new)
- `app/admin/posts/[id]/edit/page.tsx` (new)
- `components/admin/PostForm.tsx` (new, shared)

**Form fields:**
- Title (text)
- Slug (auto-generated, editable)
- Post Type (radio: ব্লগ / পেজ)
- Status (radio: ড্রাফট / প্রকাশিত)
- Cover Image (file upload)
- Content (large textarea — plain text/markdown)
- Excerpt (textarea, optional)
- Tags (comma-separated input → array)
- Meta Title (SEO, optional)
- Meta Description (SEO, optional)
- Save button → calls `admin_create_post` or `admin_update_post` RPC

---

### Task 11: Post Upload API + CRUD

**Goal:** File upload for post covers, plus full CRUD.

**Files:**
- `app/api/admin/posts/upload/route.ts` (new)
- `app/api/admin/posts/[id]/route.ts` (new)

**Routes:**
- `POST /api/admin/posts/upload` — upload cover to `book-covers` bucket (path: `posts/{filename}`)
- `GET /api/admin/posts/[id]` — return single post
- `PUT /api/admin/posts/[id]` — call `admin_update_post` RPC
- `DELETE /api/admin/posts/[id]` — call `admin_delete_post` RPC

---

### Task 12: Post Management Wiring + Test

**Goal:** Verify all post CRUD operations work.

**Steps:**
1. Create a blog post → verify it appears in list
2. Create a static page → verify it appears with "Page" badge
3. Edit a post → verify changes persist
4. Change status from draft to published → verify badge updates
5. Delete a post → verify it's removed
6. Test filters

---

## Phase D: Customers + Settings (4 tasks)

### Task 13: Customer List Page

**Goal:** Show all registered customers.

**File:** `app/admin/customers/page.tsx` (new)
**File:** `app/api/admin/customers/route.ts` (new)

**API (`GET /api/admin/customers`):**
- Query `auth.users` for user list (via InsForge admin API or RPC)
- Join with `profiles` for display names
- Join with `orders` for order count
- Support `?search=` by email/name

**UI:**
- Search input
- Table: Name, Email, Phone, Joined date, Orders count
- Click row → `/admin/customers/[id]`

---

### Task 14: Customer Detail Page

**Goal:** Show individual customer profile and order history.

**File:** `app/admin/customers/[id]/page.tsx` (new)
**File:** `app/api/admin/customers/[id]/route.ts` (new)

**API (`GET /api/admin/customers/[id]`):**
- Fetch user profile
- Fetch all orders for this user
- Fetch addresses

**UI:**
- Profile card: Name, Email, Phone, Joined date
- Order history table (reuse order row pattern)
- Addresses list

---

### Task 15: Site Settings Page

**Goal:** Let admin configure site-wide settings.

**File:** `app/admin/settings/page.tsx` (new)
**File:** `app/api/admin/settings/route.ts` (new)

**API:**
- `GET /api/admin/settings` — returns all settings from `site_settings` table
- `PUT /api/admin/settings` — upserts settings via `admin_upsert_setting` RPC

**UI (tabbed sections):**
- **সাধারণ (General):** Site name, Tagline, Contact email, Contact phone
- **হোমপেজ (Homepage):** Hero title, Hero subtitle, Promo banner text, Featured book multi-select
- **ফুটার (Footer):** Footer text
- **সোশ্যাল (Social):** Facebook URL, YouTube URL
- Per-section save button

---

### Task 16: Customers + Settings Wiring + Test

**Goal:** Verify customer management and settings work.

**Steps:**
1. View customer list → verify users appear
2. Click customer → verify detail loads
3. Update settings → verify values persist
4. Reload page → verify settings loaded correctly

---

## Phase E: Polish + Public Integration (4 tasks)

### Task 17: Public Homepage Reads Settings

**Goal:** Homepage dynamic content reads from `site_settings` instead of hardcoded values.

**File:** `app/page.tsx`
**File:** `app/api/settings/route.ts` (new, public — no auth)

**Changes:**
- Create `GET /api/settings` that calls `get_site_settings()` RPC (anon access)
- Update homepage to fetch settings and use them for hero title, subtitle, promo text
- Keep hardcoded values as fallbacks if settings empty

---

### Task 18: Public Blog Pages

**Goal:** Published posts visible at `/blog` and `/blog/[slug]`.

**Files:**
- `app/blog/page.tsx` (new)
- `app/blog/[slug]/page.tsx` (new)
- `app/api/public/posts/route.ts` (new)
- `app/api/public/posts/[slug]/route.ts` (new)

**Blog List (`/blog`):**
- Grid of published blog posts
- Each card: Cover image, Title, Excerpt, Date
- Links to `/blog/[slug]`

**Blog Detail (`/blog/[slug]`):**
- Full post content
- Cover image
- Title, author, date
- Back link to `/blog`

---

### Task 19: Admin CSS + Responsive Polish

**Goal:** Ensure all new pages look consistent and work on mobile.

**File:** `app/globals.css` (append)

**CSS to add:**
- `.admin-book-form` styles (form layout, format rows)
- `.admin-post-form` styles (form layout)
- `.admin-customer-card` styles (profile card)
- `.admin-settings-tabs` styles (tabbed interface)
- `.admin-upload-area` styles (file upload dropzone)
- Responsive breakpoints for all new components

---

### Task 20: Final Deploy + Verification

**Goal:** Deploy and verify everything works.

**Steps:**
1. Run build locally to check for TypeScript errors
2. Commit all changes
3. Deploy via `scripts/deploy-direct.mjs`
4. Verify on live site:
   - Dashboard loads with stats
   - Can create/edit/delete books
   - Can upload cover images
   - Can create/edit/delete posts
   - Can view customers
   - Can update settings
   - Homepage reads settings
   - Blog pages load published posts
5. Test admin auth (non-admin cannot access)
6. Test mobile responsiveness

---

## File Summary

### New Files (24)

**Pages (13):**
- `app/admin/dashboard/page.tsx`
- `app/admin/books/page.tsx`
- `app/admin/books/new/page.tsx`
- `app/admin/books/[id]/edit/page.tsx`
- `app/admin/posts/page.tsx`
- `app/admin/posts/new/page.tsx`
- `app/admin/posts/[id]/edit/page.tsx`
- `app/admin/customers/page.tsx`
- `app/admin/customers/[id]/page.tsx`
- `app/admin/settings/page.tsx`
- `app/blog/page.tsx`
- `app/blog/[slug]/page.tsx`

**API Routes (10):**
- `app/api/admin/dashboard/route.ts`
- `app/api/admin/books/route.ts`
- `app/api/admin/books/[id]/route.ts`
- `app/api/admin/books/upload/route.ts`
- `app/api/admin/books/upload-pdf/route.ts`
- `app/api/admin/posts/route.ts`
- `app/api/admin/posts/[id]/route.ts`
- `app/api/admin/posts/upload/route.ts`
- `app/api/admin/customers/route.ts`
- `app/api/admin/customers/[id]/route.ts`
- `app/api/admin/settings/route.ts`
- `app/api/settings/route.ts`
- `app/api/public/posts/route.ts`
- `app/api/public/posts/[slug]/route.ts`

**Components (2):**
- `components/admin/BookForm.tsx`
- `components/admin/PostForm.tsx`

### Modified Files (4)
- `app/admin/layout.tsx` — sidebar navigation expanded
- `app/admin/page.tsx` — redirect to `/admin/dashboard`
- `app/globals.css` — new admin styles appended
- `app/page.tsx` — reads from site_settings

---

## Estimated Effort

| Phase | Tasks | Est. Effort |
|-------|-------|-------------|
| A: Database + Dashboard | 0-3 | Medium (SQL + dashboard) |
| B: Book Management | 4-8 | High (CRUD + file uploads) |
| C: Post Management | 9-12 | Medium (similar pattern to books) |
| D: Customers + Settings | 13-16 | Medium (read-heavy) |
| E: Polish | 17-20 | Low (integration + CSS) |
| **Total** | **0-20** | **~20 implementation tasks** |
