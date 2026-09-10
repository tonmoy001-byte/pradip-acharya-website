# Full Admin Panel — Design Spec

**Date:** 2026-09-03
**Status:** Draft
**Scope:** Complete admin dashboard for managing products, posts, orders, customers, and site settings

---

## 1. Goal

Replace the current minimal order-only admin panel with a full-featured dashboard that lets the site admin manage every aspect of the website from a single interface. The admin should be able to:

- Manage books/products (add, edit, delete, upload covers, manage formats)
- Manage blog posts and static pages (create, edit, delete, publish/unpublish)
- View and manage orders (approve, reject, track status)
- View customers and their profiles
- Configure site settings (homepage banner, featured books, store info)
- See a real-time dashboard with key stats

---

## 2. Current State

### What Exists
- Admin sidebar layout (`app/admin/layout.tsx`) with dark ink background
- Order management page (`app/admin/orders/page.tsx`) with stats, filters, table, approve/reject modals
- 4 API routes: stats, orders list, approve, reject
- Admin auth via `requireAdmin()` → `is_admin()` RPC
- Toast notification system (`components/admin/Toast.tsx`)
- ApproveModal, RejectModal, OrderRow components
- ~360 lines of admin CSS in `app/globals.css`

### What's Missing
- No product management (books exist in DB but no admin UI to manage them)
- No blog/post system (no `posts` table, no UI)
- No customer management
- No site settings management
- No file upload handling (covers, PDFs)
- Dashboard shows only 4 basic stats

---

## 3. New Database Tables

### 3.1 `posts` (Blog posts + static pages)

```sql
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  excerpt TEXT,
  cover_image TEXT,
  author_name TEXT DEFAULT 'প্রদীপ কুমার আচার্য্য',
  post_type TEXT NOT NULL DEFAULT 'blog' CHECK (post_type IN ('blog', 'page')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  tags TEXT[] DEFAULT '{}',
  meta_title TEXT,
  meta_description TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_post_type ON posts(post_type);
```

### 3.2 `site_settings` (Key-value store for site config)

```sql
CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default settings
INSERT INTO site_settings (key, value, category) VALUES
('site_name', '"প্রদীপ কুমার আচার্য্য"', 'general'),
('site_tagline', '"বাংলা সাহিত্যের একটি নতুন অধ্যায়"', 'general'),
('hero_title', '"প্রদীপ কুমার আচার্য্য"', 'homepage'),
('hero_subtitle', '"ছেঁড়া পুষ্প — একটি সময়ের গল্প"', 'homepage'),
('promo_banner_text', '"৭৫০ টাকার বেশি অর্ডারে বিনামূল্যে ডেলিভারি"', 'homepage'),
('featured_book_ids', '[]', 'homepage'),
('footer_text', '"© ২০২৬ প্রদীপ কুমার আচার্য্য। সর্বস্বত্ব সংরক্ষিত।"', 'general'),
('contact_email', '""', 'general'),
('contact_phone', '""', 'general'),
('social_facebook', '""', 'social'),
('social_youtube', '""', 'social');
```

### 3.3 `categories` (Book categories/subcategories)

```sql
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed defaults
INSERT INTO categories (name, slug, sort_order) VALUES
('উপন্যাস', 'novels', 1),
('সাহিত্য', 'literature', 2),
('কবিতা', 'poetry', 3),
('প্রবন্ধ', 'essays', 4);
```

---

## 4. New RPC Functions

### 4.1 Admin Book Management

```sql
-- Create a new book with formats
CREATE OR REPLACE FUNCTION admin_create_book(
  p_title TEXT, p_author TEXT, p_category TEXT, p_subcategory TEXT,
  p_subcategory_slug TEXT, p_description TEXT, p_synopsis TEXT,
  p_cover_primary TEXT, p_cover_hover TEXT, p_featured BOOLEAN,
  p_is_new BOOLEAN, p_trending BOOLEAN, p_is_demo BOOLEAN,
  p_formats JSONB
) RETURNS UUID AS $$
DECLARE
  v_book_id UUID;
  v_fmt JSONB;
BEGIN
  INSERT INTO books (title, author, category, subcategory, subcategory_slug,
    description, synopsis, cover_primary, cover_hover, featured, is_new, trending, is_demo)
  VALUES (p_title, p_author, p_category, p_subcategory, p_subcategory_slug,
    p_description, p_synopsis, p_cover_primary, p_cover_hover, p_featured, p_is_new, p_trending, p_is_demo)
  RETURNING id INTO v_book_id;

  FOR v_fmt IN SELECT * FROM jsonb_array_elements(p_formats)
  LOOP
    INSERT INTO book_formats (book_id, format_name, price, compare_at_price, available, delivery_type)
    VALUES (v_book_id, v_fmt->>'name', (v_fmt->>'price')::numeric,
      (v_fmt->>'compareAtPrice')::numeric, (v_fmt->>'available')::boolean,
      v_fmt->>'delivery_type');
  END LOOP;

  RETURN v_book_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update a book
CREATE OR REPLACE FUNCTION admin_update_book(
  p_book_id UUID, p_title TEXT, p_author TEXT, p_category TEXT,
  p_subcategory TEXT, p_subcategory_slug TEXT, p_description TEXT,
  p_synopsis TEXT, p_cover_primary TEXT, p_cover_hover TEXT,
  p_featured BOOLEAN, p_is_new BOOLEAN, p_trending BOOLEAN, p_is_demo BOOLEAN,
  p_formats JSONB
) RETURNS VOID AS $$
DECLARE
  v_fmt JSONB;
BEGIN
  UPDATE books SET
    title = p_title, author = p_author, category = p_category,
    subcategory = p_subcategory, subcategory_slug = p_subcategory_slug,
    description = p_description, synopsis = p_synopsis,
    cover_primary = p_cover_primary, cover_hover = p_cover_hover,
    featured = p_featured, is_new = p_is_new, trending = p_trending, is_demo = p_is_demo
  WHERE id = p_book_id;

  -- Delete old formats and re-insert
  DELETE FROM book_formats WHERE book_id = p_book_id;
  FOR v_fmt IN SELECT * FROM jsonb_array_elements(p_formats)
  LOOP
    INSERT INTO book_formats (book_id, format_name, price, compare_at_price, available, delivery_type)
    VALUES (p_book_id, v_fmt->>'name', (v_fmt->>'price')::numeric,
      (v_fmt->>'compareAtPrice')::numeric, (v_fmt->>'available')::boolean,
      v_fmt->>'delivery_type');
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete a book
CREATE OR REPLACE FUNCTION admin_delete_book(p_book_id UUID) RETURNS VOID AS $$
BEGIN
  DELETE FROM book_formats WHERE book_id = p_book_id;
  DELETE FROM books WHERE id = p_book_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4.2 Admin Post Management

```sql
-- Create post
CREATE OR REPLACE FUNCTION admin_create_post(
  p_title TEXT, p_slug TEXT, p_content TEXT, p_excerpt TEXT,
  p_cover_image TEXT, p_post_type TEXT, p_status TEXT, p_tags TEXT[]
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO posts (title, slug, content, excerpt, cover_image, post_type, status, tags, published_at)
  VALUES (p_title, p_slug, p_content, p_excerpt, p_cover_image, p_post_type, p_status, p_tags,
    CASE WHEN p_status = 'published' THEN now() ELSE NULL END)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update post
CREATE OR REPLACE FUNCTION admin_update_post(
  p_post_id UUID, p_title TEXT, p_slug TEXT, p_content TEXT, p_excerpt TEXT,
  p_cover_image TEXT, p_post_type TEXT, p_status TEXT, p_tags TEXT[]
) RETURNS VOID AS $$
BEGIN
  UPDATE posts SET
    title = p_title, slug = p_slug, content = p_content, excerpt = p_excerpt,
    cover_image = p_cover_image, post_type = p_post_type, status = p_status,
    tags = p_tags, updated_at = now(),
    published_at = CASE
      WHEN p_status = 'published' AND published_at IS NULL THEN now()
      WHEN p_status = 'published' THEN published_at
      ELSE NULL
    END
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete post
CREATE OR REPLACE FUNCTION admin_delete_post(p_post_id UUID) RETURNS VOID AS $$
BEGIN
  DELETE FROM posts WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4.3 Site Settings

```sql
-- Upsert a setting
CREATE OR REPLACE FUNCTION admin_upsert_setting(
  p_key TEXT, p_value JSONB, p_category TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO site_settings (key, value, category, updated_at)
  VALUES (p_key, p_value, p_category, now())
  ON CONFLICT (key) DO UPDATE SET value = p_value, category = p_category, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all settings (public, no auth needed for reading)
CREATE OR REPLACE FUNCTION get_site_settings() RETURNS JSONB AS $$
BEGIN
  RETURN (SELECT jsonb_object_agg(key, value) FROM site_settings);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 5. Admin Pages — Route Map

### 5.1 Existing (To Update)

| Route | File | Changes |
|-------|------|---------|
| `/admin` | `app/admin/page.tsx` | Update redirect to `/admin/dashboard` |
| `/admin/layout.tsx` | `app/admin/layout.tsx` | Add more sidebar links |
| `/admin/orders` | `app/admin/orders/page.tsx` | Minor updates (no major changes) |

### 5.2 New Pages

| Route | File | Description |
|-------|------|-------------|
| `/admin/dashboard` | `app/admin/dashboard/page.tsx` | Real-time dashboard with stats |
| `/admin/books` | `app/admin/books/page.tsx` | Book list with search/filter |
| `/admin/books/new` | `app/admin/books/new/page.tsx` | Create new book form |
| `/admin/books/[id]/edit` | `app/admin/books/[id]/edit/page.tsx` | Edit book form |
| `/admin/posts` | `app/admin/posts/page.tsx` | Post list (blog + pages) |
| `/admin/posts/new` | `app/admin/posts/new/page.tsx` | Create new post |
| `/admin/posts/[id]/edit` | `app/admin/posts/[id]/edit/page.tsx` | Edit post |
| `/admin/customers` | `app/admin/customers/page.tsx` | Customer list |
| `/admin/customers/[id]` | `app/admin/customers/[id]/page.tsx` | Customer detail |
| `/admin/settings` | `app/admin/settings/page.tsx` | Site settings editor |

### 5.3 New API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/books` | GET | List all books |
| `/api/admin/books` | POST | Create book (JSON body) |
| `/api/admin/books/[id]` | GET | Get single book |
| `/api/admin/books/[id]` | PUT | Update book |
| `/api/admin/books/[id]` | DELETE | Delete book |
| `/api/admin/books/upload` | POST | Upload cover image to `book-covers` bucket |
| `/api/admin/posts` | GET | List all posts |
| `/api/admin/posts` | POST | Create post |
| `/api/admin/posts/[id]` | GET | Get single post |
| `/api/admin/posts/[id]` | PUT | Update post |
| `/api/admin/posts/[id]` | DELETE | Delete post |
| `/api/admin/posts/upload` | POST | Upload post cover image |
| `/api/admin/customers` | GET | List all customers (auth.users + profiles) |
| `/api/admin/customers/[id]` | GET | Get customer detail |
| `/api/admin/settings` | GET | Get all settings |
| `/api/admin/settings` | PUT | Upsert settings |
| `/api/admin/stats` | GET | Enhanced dashboard stats |
| `/api/admin/books/upload-pdf` | POST | Upload eBook PDF to `digital-books` bucket |

---

## 6. Admin Pages — Detailed Design

### 6.1 Dashboard (`/admin/dashboard`)

**Stats Cards (6):**
1. মোট অর্ডার (Total Orders)
2. মোট আয় (Total Revenue)
3. পেইড অর্ডার (Paid Orders)
4. মোট বই (Total Books)
5. মোট পোস্ট (Total Posts)
6. মোট গ্রাহক (Total Customers)

**Recent Orders Table (last 5)**
**Quick Actions:** Add Book, Add Post, View Orders

### 6.2 Book Management

**Book List (`/admin/books`):**
- Table: Cover thumbnail, Title, Author, Category, Formats (price badges), Featured/New/Trending flags
- Search by title/author
- Filter by category
- Actions: Edit, Delete (with confirmation)
- "Add Book" button → `/admin/books/new`

**Book Form (`/admin/books/new` + `/admin/books/[id]/edit`):**
- Title (Bengali text input)
- Author (Bengali text input)
- Category (dropdown: উপন্যাস, সাহিত্য, কবিতা, প্রবন্ধ)
- Subcategory (text input)
- Subcategory Slug (auto-generated from subcategory, editable)
- Description (textarea, Bengali)
- Synopsis (textarea, Bengali, optional)
- Cover Primary (file upload → `book-covers` bucket)
- Cover Hover (file upload → `book-covers` bucket, optional)
- Formats section (dynamic, can add/remove):
  - Format Name (Paperback / eBook)
  - Price (number)
  - Compare At Price (number, optional)
  - Available (checkbox)
  - Delivery Type (physical / digital)
  - For eBook: PDF upload (file upload → `digital-books` bucket)
- Flags: Featured, New, Trending, Demo (checkboxes)
- Save button (calls RPC)

### 6.3 Post Management

**Post List (`/admin/posts`):**
- Table: Title, Type (blog/page badge), Status (draft/published badge), Date
- Filter by type (All / Blog / Pages)
- Filter by status (All / Draft / Published)
- Actions: Edit, Delete
- "Add Post" button → `/admin/posts/new`

**Post Form (`/admin/posts/new` + `/admin/posts/[id]/edit`):**
- Title (text input)
- Slug (auto-generated from title, editable)
- Post Type (radio: Blog / Page)
- Status (radio: Draft / Published)
- Cover Image (file upload)
- Content (large textarea or markdown editor)
- Excerpt (textarea, optional)
- Tags (comma-separated input)
- Meta Title (SEO, optional)
- Meta Description (SEO, optional)
- Save button

### 6.4 Customer Management

**Customer List (`/admin/customers`):**
- Table: Name, Email, Joined date, Orders count
- Search by name/email
- Click → detail page

**Customer Detail (`/admin/customers/[id]`):**
- Profile info (name, email, phone)
- Order history
- Addresses

### 6.5 Site Settings

**Settings Page (`/admin/settings`):**
- Organized in sections/tabs:
  - **General:** Site name, tagline, contact email, phone
  - **Homepage:** Hero title, hero subtitle, promo banner text, featured book selector
  - **Footer:** Footer text
  - **Social:** Facebook URL, YouTube URL
- Save button per section (calls `admin_upsert_setting` RPC)

---

## 7. Admin Sidebar — Updated Navigation

```
┌──────────────────────┐
│  অ্যাডমিন প্যানেল     │
│  admin@example.com   │
├──────────────────────┤
│  📊 ড্যাশবোর্ড        │  ← /admin/dashboard
│  📦 বই ম্যানেজমেন্ট   │  ← /admin/books
│  ✏️  পোস্ট ম্যানেজমেন্ট  │  ← /admin/posts
│  🛒 অর্ডার            │  ← /admin/orders
│  👥 গ্রাহক            │  ← /admin/customers
│  ⚙️  সেটিংস           │  ← /admin/settings
├──────────────────────┤
│  🏠 সাইট দেখুন        │  ← / (opens in new tab)
│  🚪 লগ আউট           │  ← sign out
└──────────────────────┘
```

---

## 8. File Upload Strategy

### Cover Images
- Target: `book-covers` bucket (public)
- Endpoint: `POST /api/admin/books/upload`
- Flow: FormData → InsForge SDK `storage.from('book-covers').upload(path, file)` → return public URL
- Path format: `books/{bookId}-{timestamp}.{ext}`

### Post Cover Images
- Same bucket: `book-covers`
- Endpoint: `POST /api/admin/posts/upload`
- Path format: `posts/{postId}-{timestamp}.{ext}`

### eBook PDFs
- Target: `digital-books` bucket (private)
- Endpoint: `POST /api/admin/books/upload-pdf`
- Flow: FormData → InsForge SDK `storage.from('digital-books').upload(path, file)` → return storage key
- Path format: `ebooks/{bookId}-{formatId}.pdf`

---

## 9. Implementation Phases

### Phase A: Database + Dashboard (Tasks 0-3)
- Create tables via InsForge SQL
- Create RPC functions
- Build enhanced dashboard page
- Update admin sidebar navigation

### Phase B: Book Management (Tasks 4-8)
- Book list page
- Book create/edit form
- Cover image upload
- PDF upload for eBooks
- Wire up CRUD operations

### Phase C: Post Management (Tasks 9-12)
- Post list page
- Post create/edit form
- Post image upload
- Wire up CRUD operations

### Phase D: Customers + Settings (Tasks 13-16)
- Customer list + detail pages
- Site settings page
- Settings API + RPC

### Phase E: Polish (Tasks 17-19)
- Public pages read from `site_settings` (homepage, footer)
- Public blog pages for published posts
- Final testing + deploy

---

## 10. Design Principles

- **Bengali UI**: All labels, buttons, placeholders in Bengali
- **Reuse existing admin CSS**: Extend `.admin-*` classes, keep consistent look
- **Reuse existing components**: Toast, modals, badge patterns from order management
- **No new dependencies**: Use native HTML inputs, no rich text editor library
- **Mobile responsive**: Admin usable on tablet/mobile (sidebar collapses)
- **InsForge SDK only**: All DB ops via RPC or `.from()` calls, no raw SQL from client
- **Admin auth required**: All `/api/admin/*` routes use `requireAdmin()`
