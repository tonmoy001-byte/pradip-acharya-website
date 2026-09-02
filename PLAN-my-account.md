# My Account Section — Implementation Plan

## Overview
Build a complete customer account section with 6 features: Profile, My Orders, Saved Addresses, Wishlist, Change Password, Logout. Includes sidebar navigation, proper Bengali icons, database tables, API routes, and checkout integration.

---

## Database Schema (3 new tables)

### 1. `profiles`
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2. `addresses`
```sql
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'বাসা',
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line TEXT NOT NULL,
  district TEXT NOT NULL,
  upazila TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3. `wishlists`
```sql
CREATE TABLE wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_id)
);
```

### RLS Policies
- `profiles`: Users can read/update own profile; admin full access
- `addresses`: Users can CRUD own addresses; admin read access
- `wishlists`: Users can read/add/delete own wishlist items; admin read access

### RPC Functions
- `upsert_profile(p_full_name, p_phone)` — insert or update profile
- `set_default_address(p_address_id)` — unset old default, set new
- `toggle_wishlist(p_book_id)` — add or remove from wishlist
- `is_in_wishlist(p_book_id)` — check if book is in user's wishlist

---

## Auth System Updates

### `lib/auth.tsx` Changes
- Add `name` field to `AuthUser` interface
- On sign-in/sign-up, fetch profile from `profiles` table to get `full_name`
- Add `refreshProfile()` method to re-fetch profile data
- Store `name` in AuthUser after profile fetch

### `lib/auth-helpers.ts` Changes
- Update `AuthUser` to include `name`
- `requireUser()` now also fetches profile name

---

## Route Structure

```
/account                    → Account Dashboard (overview)
/account/profile            → Profile settings
/account/orders             → My Orders (move from /my-orders)
/account/orders/[id]        → Order Detail
/account/addresses          → Saved Addresses
/account/wishlist           → Wishlist
/account/change-password    → Change Password
```

**Redirect:** `/my-orders` → `/account/orders` (301)

---

## Component Architecture

### Layout: `app/account/layout.tsx`
- Sidebar navigation (desktop) / stacked menu (mobile)
- 6 menu items with icons
- Active state highlighting
- Responsive: sidebar on desktop, top menu on mobile

### Account Sidebar Items (with SVG icons)

| Icon | Label | Route | Badge |
|------|-------|-------|-------|
| 👤 User | প্রোফাইল | `/account/profile` | — |
| 📋 Clipboard | আমার অর্ডার | `/account/orders` | Active order count |
| 📍 Map Pin | সংরক্ষিত ঠিকানা | `/account/addresses` | Address count |
| ❤️ Heart | উইশলিস্ট | `/account/wishlist` | Wishlist count |
| 🔒 Lock | পাসওয়ার্ড পরিবর্তন | `/account/change-password` | — |
| 🚪 Log Out | লগ আউট | — (action) | — |

### Icon SVGs (inline, stroke-based, matching existing Navbar style)
- Profile: `M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2` + `circle cx=12 cy=7 r=4`
- Orders: `M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z` + `polyline points="14 2 14 8 20 8"` + `line x1=16 y1=13 x2=8 y2=13` + `line x1=16 y1=17 x2=8 y2=17`
- Addresses: `path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"` + `circle cx=12 cy=10 r=3`
- Wishlist: `path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"`
- Change Password: `rect x=3 y=11 width=18 height=11 rx=2 ry=2` + `path d="M7 11V7a5 5 0 0 1 10 0v4"`
- Logout: `path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"` + `polyline points="16 17 21 12 16 7"` + `line x1=21 y1=12 x2=9 y2=12`

---

## Pages

### 1. Account Dashboard (`app/account/page.tsx`)
- Welcome message with user name
- Quick stats: Active Orders, Total Orders, Wishlist Items, Saved Addresses
- Recent order (last 1)
- Quick links to all sections

### 2. Profile (`app/account/profile/page.tsx`)
- Display: Full Name, Email (read-only), Phone
- Edit mode: toggle between view/edit
- Save button → calls `upsert_profile()` RPC
- Email verification status badge
- Account creation date

### 3. My Orders (`app/account/orders/page.tsx`)
- Move existing `/my-orders` logic here
- Enhanced: show book thumbnails, titles, quantities
- Status badges with colors
- Link to order detail page

### 4. Order Detail (`app/account/orders/[id]/page.tsx`)
- Full order info: items, pricing, delivery, payment
- Order timeline (visual steps)
- Actions: Track, Download Invoice, Contact Support, Reorder

### 5. Saved Addresses (`app/account/addresses/page.tsx`)
- List of address cards
- Each card: label, recipient, phone, full address, district/upazila
- Actions: Edit, Delete, Set as Default
- Add New Address button → modal/form
- Default address highlighted

### 6. Wishlist (`app/account/wishlist/page.tsx`)
- Grid of saved books
- Each: cover image, title, author, price
- Actions: Add to Cart, Remove
- Empty state with link to browse books

### 7. Change Password (`app/account/change-password/page.tsx`)
- Current Password field
- New Password field
- Confirm New Password field
- Password requirements shown
- Success message after change

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/profile` | Get current user's profile |
| PUT | `/api/profile` | Update profile |
| GET | `/api/addresses` | List user's addresses |
| POST | `/api/addresses` | Create address |
| PUT | `/api/addresses/[id]` | Update address |
| DELETE | `/api/addresses/[id]` | Delete address |
| PUT | `/api/addresses/[id]/default` | Set as default |
| GET | `/api/wishlist` | List user's wishlist |
| POST | `/api/wishlist` | Toggle wishlist item |
| GET | `/api/wishlist/check/[bookId]` | Check if book is in wishlist |

---

## Checkout Integration

### Update `app/checkout/page.tsx`
- If user is logged in, show "সংরক্ষিত ঠিকানা ব্যবহার করুন" section
- Fetch user's addresses from `/api/addresses`
- Radio buttons to select saved address OR "নতুন ঠিকানা" option
- When saved address selected, auto-fill shipping fields
- When "নতুন ঠিকানা" selected, show empty form
- After order, optionally save new address

---

## Navbar Updates

### `components/Navbar.tsx`
- Replace `/my-orders` link with `/account` (account icon)
- Account icon: user avatar or generic user icon
- Mobile drawer: "আমার অ্যাকাউন্ট" link → `/account`

---

## CSS Additions (`app/globals.css`)

### Account Layout
```css
.account-layout { display: grid; grid-template-columns: 260px 1fr; gap: var(--sp-8); }
.account-sidebar { ... }
.account-sidebar-link { ... }
.account-sidebar-link.active { ... }
.account-content { ... }
```

### Responsive
- `@media (max-width: 768px)`: stack sidebar on top
- Mobile sidebar becomes horizontal scrollable menu

---

## Implementation Order

### Phase 1: Database + Auth (Backend)
1. Create `profiles`, `addresses`, `wishlists` tables via InsForge MCP
2. Add RLS policies
3. Create RPC functions
4. Update `lib/auth.tsx` to include `name` in AuthUser
5. Create API routes

### Phase 2: Account Layout + Navigation
6. Create `app/account/layout.tsx` with sidebar
7. Update Navbar to link to `/account`
8. Add account CSS to `globals.css`

### Phase 3: Account Pages
9. Account Dashboard (`/account`)
10. Profile page (`/account/profile`)
11. My Orders page (`/account/orders`) — migrate from `/my-orders`
12. Order Detail page (`/account/orders/[id]`)
13. Saved Addresses page (`/account/addresses`)
14. Wishlist page (`/account/wishlist`)
15. Change Password page (`/account/change-password`)

### Phase 4: Integration
16. Update checkout to use saved addresses
17. Add wishlist toggle to BookCard
18. Add order count badges to sidebar

### Phase 5: Deploy + Test
19. Deploy all changes
20. Test full flow: signup → profile → browse → wishlist → cart → checkout → orders

---

## Files to Create/Modify

### New Files
- `app/account/layout.tsx` — sidebar layout
- `app/account/page.tsx` — dashboard
- `app/account/profile/page.tsx` — profile settings
- `app/account/orders/page.tsx` — order list (migrated)
- `app/account/orders/[id]/page.tsx` — order detail
- `app/account/addresses/page.tsx` — address management
- `app/account/wishlist/page.tsx` — wishlist
- `app/account/change-password/page.tsx` — password change
- `app/api/profile/route.ts` — profile API
- `app/api/addresses/route.ts` — addresses list/create
- `app/api/addresses/[id]/route.ts` — address update/delete
- `app/api/addresses/[id]/default/route.ts` — set default
- `app/api/wishlist/route.ts` — wishlist list/toggle
- `app/api/wishlist/check/[bookId]/route.ts` — check wishlist

### Modified Files
- `lib/auth.tsx` — add `name` to AuthUser, fetch profile
- `lib/auth-helpers.ts` — update AuthUser type
- `components/Navbar.tsx` — account link, remove old orders link
- `app/checkout/page.tsx` — saved address integration
- `components/BookCard.tsx` — wishlist toggle button
- `app/globals.css` — account layout styles
- `app/my-orders/page.tsx` — redirect to `/account/orders`

---

## Estimated Effort
- Database + Auth: ~30 min
- Account Layout + Navigation: ~20 min
- 7 Account Pages: ~90 min
- API Routes (6 files): ~40 min
- Checkout Integration: ~20 min
- Navbar + BookCard updates: ~15 min
- CSS: ~20 min
- Deploy + Test: ~15 min
- **Total: ~4 hours**
