# Book eCommerce Website - Design Spec

**Date**: 2026-08-23
**Author**: প্রদীপ কুমার আচার্য্য
**Novel**: ছেঁড়া পুষ্প

## Overview

A premium Bengali author-and-book eCommerce website built with Next.js (App Router) + TypeScript. The site centers on the author and his novel, presenting a refined literary identity with Bengali copy and a premium minimal design. No Tailwind - pure CSS with custom properties.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hero media | Slideshow fallback only | No video file provided; video path remains as drop-in upgrade |
| Checkout flow | Complete dummy checkout | Full validation, fake order number, cart clear, confirmation |
| Search | Client-side filtering | Fast, no backend needed, works with mock service layer |
| Book data | 3 seed books (1 real + 2 demo) | Faster iteration; expandable via listings pipeline |
| Newsletter/Contact | Interactive UI only | Submit handlers with success toasts, no backend |
| Author portrait | Typographic author card | Abstract literary image with name, no misleading portrait |
| Build approach | Phased incremental | Testable checkpoints, low risk |
| Currency | BDT (configurable) | Bangladesh-focused Bengali audience |
| Delivery | Demo rule: ৳60 flat, free over ৳750 | Configurable demo setting |

## Tech Stack

- **Framework**: Next.js (latest stable, App Router)
- **Language**: TypeScript
- **Styling**: Single globals.css with CSS custom properties (NO Tailwind)
- **Fonts**: Google Fonts - Noto Serif Bengali (display), Noto Sans Bengali (body), Cormorant Garamond (Latin fallback), Inter (Latin body fallback)
- **Images**: next/image with Unsplash remotePatterns, onError fallback to local placeholder SVG
- **State**: React Context + localStorage for cart
- **Animations**: IntersectionObserver-based fade-up reveals, CSS keyframes
- **Accessibility**: Semantic HTML, keyboard navigation, focus traps, prefers-reduced-motion

### Installation Dependencies

```bash
npx create-next-app . --typescript --app --npm
npm install sharp  # Image optimization for import pipeline
```

## Code Structure

```
app/                    routes + layout.tsx + globals.css + loading/error/not-found
components/             shared + page-level (server by default, "use client" where needed)
lib/data.ts             BASE_BOOKS array + CATEGORIES + STORE_CONFIG + SUBCATEGORY_MAP - typed interfaces
lib/api.ts              mock async service layer (backend-swap seam)
lib/orders.ts           order creation seam (demo function, future backend swap)
lib/store.tsx           cart state: React Context + localStorage
lib/format.ts           money() helper with configurable locale
scripts/import-listings.mjs  CSV import script (uses sharp)
incoming/               listings-template.csv, README.md, images/ drop folder
README.md               structure overview
public/images/          book-placeholder.svg, author/ folder
```

## Data Architecture

### Core Types

```typescript
type BookCategory = "novels" | "books"
type BookFormatName = "Paperback" | "Hardcover" | "eBook"

// Category model:
// - category = "novels" for novels
// - category = "books" for poetry, essays and other literary books
// - subcategory = Bengali display label: "উপন্যাস", "কবিতা", "প্রবন্ধ"
// - URL slugs use English: subcategory=poetry, subcategory=essays
// - Subcategory slug-to-label mapping defined in lib/data.ts

interface BookFormat {
  name: BookFormatName
  price: number
  compareAtPrice?: number
  available: boolean
}

interface Book {
  id: string
  title: string           // Bengali
  author: string          // Bengali
  category: BookCategory
  subcategory: string     // Bengali display label: "উপন্যাস", "কবিতা", "প্রবন্ধ"
  subcategorySlug: string // English URL slug: "novels", "poetry", "essays"
  description: string     // Bengali
  synopsis?: string       // Longer Bengali
  formats: BookFormat[]
  publicationDate?: string
  publisher?: string
  isbn?: string
  pages?: number
  language?: string       // Default "বাংলা"
  images: { primary: string; hover?: string }
  featured: boolean
  isNew: boolean
  trending: boolean
  isDemo?: boolean
}
```

### Store Configuration

```typescript
const STORE_LOCALE = "bn-BD"
const STORE_CURRENCY = "BDT"
const DELIVERY_CHARGE = 60          // ৳60 flat
const FREE_DELIVERY_THRESHOLD = 750 // Free over ৳750
```

### Seed Data (3 books)

```typescript
// Subcategory slug-to-label mapping (defined in lib/data.ts)
const SUBCATEGORY_MAP: Record<string, string> = {
  "novels": "উপন্যাস",
  "poetry": "কবিতা",
  "essays": "প্রবন্ধ",
}
```

1. **ছেঁড়া পুষ্প** - featured, new, trending, isDemo: false, category: "novels", subcategory: "উপন্যাস", subcategorySlug: "novels"
2. **Demo title 1** - category: "books" (কবিতা/poetry), isDemo: true, subcategory: "কবিতা", subcategorySlug: "poetry"
3. **Demo title 2** - category: "novels", isDemo: true, subcategory: "উপন্যাস", subcategorySlug: "novels"

All prices in BDT. Unsplash images related to books/literature. Demo titles explicitly flagged in UI with a subtle "Demo" badge. With only 3 books, homepage sections render conditionally - avoid repeating the same book in every section. Show empty-state design where a section has no distinct titles.

### Service Layer (lib/api.ts)

Every function returns Promise. Thin wrappers over lib/data.ts.

- `getBooks({ category?, subcategorySlug?, sort?, query?, limit? })` - subcategorySlug uses English slugs for URL filtering
- `getBookById(id)` - returns null for missing IDs (caller calls notFound())
- `getFeatured()`
- `getNewReleases()`
- `getTrending()`
- `getRelated(id)` - returns books in same category excluding current
- `getAllSubcategories()` - returns unique subcategories from active catalogue for filter pills

**Backend-swap seam**: Replace the imports here with fetch() calls. No page-level changes needed.

### Order Seam (lib/orders.ts)

```typescript
interface OrderConfirmation {
  orderId: string
  items: CartItem[]
  total: number
  shippingAddress: string
  placedAt: string
}

function createDemoOrder(payload: {
  contact: { name: string; email: string; phone: string }
  shipping: { address: string; city: string; zip: string; country: string }
  items: CartItem[]
  total: number  // Demo only: client-supplied total accepted for display
}): Promise<OrderConfirmation>
```

Generates fake order number (ORD-XXXXX), returns confirmation. Future backend swap point for payment/inventory.

**Safety rules:**
- The demo accepts the client-supplied total for display purposes only
- A real backend MUST recalculate prices, delivery and total from book IDs, selected formats and quantities on the server - never trust client-supplied totals
- Card number, expiry and CVC must NEVER be stored in localStorage, cart, analytics or the demo order object
- The order confirmation uses only non-sensitive contact, shipping and cart information
- Client validates required fields for the demo; a future backend must validate and recalculate everything again
- The UI must clearly state that no payment is processed

### Money Helper (lib/format.ts)

`money(n)` - consistent Bengali Taka format using Bengali numerals: `"৳ ৭৫০"`. Uses STORE_LOCALE and STORE_CURRENCY config. All UI amounts use Bengali numerals consistently - never mix Bengali and Latin digit formats. The money helper converts standard JS numbers to Bengali numeral display.

## Component Architecture

### Server Components (default)
- Homepage page
- Book listing pages
- Book detail page shell
- About, Contact, Privacy stubs
- Search page

### Client Components ("use client")
- **Navbar** - mobile hamburger, search overlay, cart badge, keyboard navigable
- **AnnouncementBar** - thin strip above navbar with rotating literary messages, pauses on hover/focus
- **Hero** - auto-rotating Unsplash crossfade slideshow (3 images, 6s interval), respects prefers-reduced-motion
- **BookCard** - hover image swap, Quick Add button (shows Bengali subcategory label)
- **Gallery** - main image + thumbnails, keyboard arrow navigation
- **FormatSelector** - format tabs with format-level pricing display
- **QtyStepper** - quantity +/- with min 1, max 10
- **CartProvider** - React Context wrapping root layout
- **ScrollReveal** - IntersectionObserver fade-up wrapper, disabled for reduced-motion
- **Toast** - notification system with ARIA live region
- **SearchOverlay** - fullscreen search with live client-side filtering, Escape to close, focus trap

### Quick Add Behavior

- Books with **one format**: Quick Add adds that format immediately, shows toast
- Books with **multiple formats**: Quick Add opens a small popover with format options, selecting one adds to cart
- Selected format is stored in the cart item and affects price calculation

### Shared Layout
Root layout.tsx wraps everything in CartProvider and renders Navbar + Footer. All pages inherit nav/footer automatically.

## CSS Design System

Single globals.css with CSS custom properties:

### Palette
- `--bg: #faf8f5` (warm paper)
- `--ink: #16130f` (near-black)
- `--terracotta: #c4704b` (min 4.5:1 contrast on --bg for text)
- `--rose: #b8827a` (min 4.5:1 contrast on --bg for text)
- `--green: #4a6741`
- `--stone: #8b8178`
- `--border: #e5e0da`

### Typography
- Display: Noto Serif Bengali (Bengali), Cormorant Garamond (Latin fallback)
- Body: Noto Sans Bengali (Bengali), Inter (Latin fallback)
- Loaded via Google Fonts link in root layout

### Spacing
- 4px base unit, multiplier-based scale

### Breakpoints (mobile-first)
- 640px, 820px (nav threshold), 1024px, 1280px

### Animations
- CSS @keyframes for fade-up, slide-in, crossfade, pulse
- `.scroll-reveal` class triggered by IntersectionObserver adding `.visible`
- All animations wrapped in `@media (prefers-reduced-motion: no-preference)` - disabled when user prefers reduced motion

### Accessibility Utilities
- `.sr-only` - screen reader only
- `.focus-visible` - visible keyboard focus ring (2px offset, --terracotta outline)
- Skip-to-content link at top of page

### Layout Utilities
- `.container`, `.hairline` (border divider), `.section-padding`

## Route Behavior

| Route | Behavior |
|-------|----------|
| `/books` | Complete active catalogue - all categories (novels, poetry, essays) |
| `/novels` | Only books where category === "novels" |
| `/search?q=...` | Client-side filtering across title, author, description |

### URL Query Parameters

```
/books?subcategory=poetry&sort=price-asc
/novels?subcategory=novels&sort=newest
```

- Route-level category determines the category filter
- Query string uses English subcategory slugs (not Bengali display text)
- `subcategorySlug` field on Book maps to URL params; `subcategory` field is for display only
- `getBooks()` accepts subcategory slug for filtering, pages pass slug values

## Page Designs

### Homepage (/)
- Full-viewport hero: auto-rotating Unsplash slideshow (3 images, 6s, crossfade), paused for reduced-motion
- Staggered Bengali text entrance animation
- Author intro card: typographic card with author name and abstract literary imagery, labeled "Author placeholder - portrait to be provided"
- Featured book highlight for ছেঁড়া পুষ্প with local cover or typographic placeholder (Bengali title + author name)
- Category cards (Novels / Literary Books) with hover zoom
- Featured books grid (conditional: shows only if featured books exist beyond the hero highlight)
- New releases section (conditional: shows only if new releases exist)
- Trending section (conditional: shows only if trending books exist)
- Promotional banner strip: "৳৭৫০-এর বেশি অর্ডারে ফ্রি ডেলিভারি"
- Newsletter signup strip

### Book Listing (/books, /novels)
- Filter pills by subcategory slug (derived from active catalogue via getAllSubcategories())
- Sort dropdown: Featured, Price low-high, Price high-low, Newest
- Responsive 4-to-2-to-1 grid
- URL state: ?subcategory=<slug>&sort=... (shareable, server-readable)
- Server component reads params, calls getBooks() with subcategory slug
- "Demo" badge on books where isDemo: true
- Filter pills show Bengali labels but link to English slug values

### Book Detail (/book/[id])
- Image gallery (main + thumbnails), keyboard arrow navigation
- Title, author, price from selected format with compare-at
- Description, synopsis
- Format selector with format-level pricing (Paperback / Hardcover / eBook where applicable)
- Quantity stepper (min 1, max 10)
- Add to Cart (writes to context, updates nav badge, shows toast)
- Delivery information: "Flat ৳60 delivery. Free on orders over ৳750."
- Related books row
- ছেঁড়া পুষ্প gets the richest detail experience
- If no real cover available: typographic placeholder with exact Bengali title and author name
- Missing ID: getBookById() returns null, page calls notFound() for true 404

### Cart (/cart)
- Line items: cover image, title, format, price (from format)
- Quantity +/- and remove buttons
- Order summary: subtotal, delivery charge (৳60 or free over ৳750), total
- "Proceed to Checkout" CTA
- Empty cart state with browse CTA

### Checkout (/checkout)
- Contact form: name, email, phone (all required)
- Shipping form: address, city, zip, country (all required)
- Dummy payment fields: card number (4242 4242 4242 4242), expiry, CVC - clearly labeled "Demo only - no real payment" / "এটি একটি ডেমো - কোনো পেমেন্ট প্রক্রিয়া হচ্ছে না"
- Order summary sidebar
- "Place Order" validates all required fields, shows inline errors
- On success: calls createDemoOrder(), clears cart, shows confirmation
- Confirmation shows: order number (ORD-XXXXX), items with format and price, shipping address, total
- Card fields must NEVER be stored in localStorage, cart, analytics or order object

**Checkout safety rules:**
- Dummy card fields (4242..., expiry, CVC) must NEVER be stored in localStorage, cart, analytics or the demo order object
- Order confirmation uses only non-sensitive contact, shipping and cart information
- Client validates required fields for the demo
- A real backend must validate and recalculate everything again (never trust client-supplied totals)
- UI must clearly state that no payment is processed ("এটি একটি ডেমো অর্ডার - কোনো পেমেন্ট প্রক্রিয়া হচ্ছে না")

### Login (/login)
- Tabbed Sign In / Create Account forms
- UI only, no real auth
- Premium literary styling
- Form fields: email + password (Sign In), name + email + password + confirm (Create Account)

### Static Stubs (/about, /contact, /privacy)
- About: introduces প্রদীপ কুমার আচার্য্য and ছেঁড়া পুষ্প. No invented biography facts - use "[জীবনী যোগ করুন]" placeholders
- Contact: reader and order support info
- Privacy: minimal privacy policy stub

### Search (/search)
- Server component reading ?q=... query param
- Client-side filtering of books by title, author, description, subcategory
- Results displayed in same grid as /books listing with Bengali labels
- "No results found" state with suggestion to browse all books

## Loading, Error, and Not-Found States

```
app/loading.tsx    - Site-wide loading skeleton with literary styling
app/error.tsx      - "use client" error boundary with retry button and accessible error message
app/not-found.tsx  - 404 page with "Book not found" messaging and browse CTA
```

Additional states:
- Missing book ID: `getBookById(id)` returns null; book detail page calls `notFound()` from next/navigation for a true 404
- Missing image: local SVG placeholder (book-placeholder.svg)
- Empty category: "No books in this category yet" with link to browse all
- Failed checkout validation: inline field errors, no page navigation

## Listings Pipeline

### incoming/ folder
- listings-template.csv - header row + 1 example row
- README.md - column reference, usage instructions
- images/ - empty drop folder

### scripts/import-listings.mjs
- Uses `sharp` as a project dependency (must be in package.json dependencies, installed via `npm install sharp`)
- Quote-aware CSV parser (handles commas in fields, quoted values)
- Validates: title, author, category, price, subcategory, image1 required
- Auto-slugifies IDs from titles, -2 suffix on collision
- Generated IDs that collide with BASE_BOOKS IDs get -3 suffix to prevent duplicate React keys and ambiguous detail-page lookups
- Image optimization: sharp (max 1400px, JPEG quality 80); sips used only as optional macOS shortcut path
- Outputs: public/images/books/<id>-1.jpg, <id>-2.jpg
- Regenerates lib/generated-books.ts wholesale (idempotent, safe to re-run)
- Missing images: local book-placeholder.svg + console warning

### npm script
"import-listings": "node scripts/import-listings.mjs"

### lib/data.ts merge
BOOKS = [...BASE_BOOKS, ...generatedBooks]. One commented line switches to generated-only.

## Cart State (lib/store.tsx)

- React Context: CartProvider wraps root layout
- State: CartItem[] with bookId, title, author, price (from selected format), format (BookFormatName), quantity, image
- Actions: addToCart, removeFromCart, updateQuantity, clearCart
- Persistence: localStorage read after mount (useEffect) to avoid SSR hydration mismatch
- Badge: Navbar reads cart count from context, updates live

## Toast Notifications
- "বইটি কার্টে যোগ হয়েছে" / "কার্ট থেকে সরানো হয়েছে" / "অর্ডার সম্পন্ন হয়েছে!"
- Auto-dismiss after 3s
- Stacked positioning (bottom-right)
- ARIA live region for screen reader announcement

## Image Strategy

### Local Assets
- `public/images/book-placeholder.svg` - paper-toned SVG for missing/failed book covers
- `public/images/author/` - folder for author portrait when provided
- `public/images/books/` - generated book cover images from import pipeline

### Remote Images
- next/image with remotePatterns for images.unsplash.com
- Every image gets onError fallback to local book-placeholder.svg
- Hero images use w=1600 Unsplash variants
- Book covers use w=900 variants

### Author Portrait Strategy
- Default: typographic author card with name and abstract literary imagery
- Labeled explicitly as "placeholder" in the UI
- When real portrait is provided: stored in public/images/author/ and referenced directly

### ছেঁড়া পুষ্প Cover
- Primary: local cover image if provided by user
- Fallback: typographic placeholder containing exact Bengali title and author name (not generic stock)
- Unsplash literary image as secondary/hover only

## Accessibility Requirements

### Semantic Structure
- One clear h1 per page
- Proper heading hierarchy (h1 > h2 > h3)
- landmarks: header, nav, main, footer
- lang="bn-BD" on html element (consistent with STORE_LOCALE)

### Keyboard Navigation
- All interactive elements focusable and operable via keyboard
- Tab order follows visual layout
- Mobile drawer: focus trap when open, Escape to close
- Search overlay: focus trap, Escape to close, returns focus to trigger
- Gallery: arrow keys for thumbnail navigation
- Format selector: arrow keys between options

### Focus States
- Visible focus ring on all interactive elements (2px --terracotta outline, 2px offset)
- Focus-visible only (not on mouse click)

### Screen Reader Support
- Meaningful Bengali alt text for covers, hero, author image
- ARIA labels on icon-only buttons (cart, search, hamburger)
- ARIA live region for toast notifications
- ARIA expanded on collapsible elements
- Form error messages associated via aria-describedby

### Reduced Motion
- All animations (slideshow, crossfade, scroll reveal, announcement rotation) disabled when prefers-reduced-motion: reduce
- Slideshow pauses, crossfade shows static image, scroll reveals appear immediately

### Contrast
- All text colors meet WCAG AA (4.5:1 for normal text, 3:1 for large text)
- Terracotta, rose, stone verified against paper background

### Forms
- Every field has a visible label (not placeholder-only)
- Error messages appear below fields, linked via aria-describedby
- Required fields marked with aria-required

## Metadata and Discoverability

### Page Titles
- Homepage: "প্রদীপ কুমার আচার্য্য - ছেঁড়া পুষ্প | বাংলা সাহিত্য"
- Book detail: "{title} - {author} | বই কিনুন"
- /books: "সকল বই | প্রদীপ কুমার আচার্য্য"
- /novels: "উপন্যাস | প্রদীপ কুমার আচার্য্য"
- /about: "লেখক সম্পর্কে | প্রদীপ কুমার আচার্য্য"

### Open Graph
- og:title and og:description in Bengali
- og:image: novel cover or branded author image (absolute URL)
- og:image:alt: descriptive Bengali alt text for the share image
- og:url: canonical URL for the page (absolute)
- og:site_name: site name in Bengali
- og:locale: "bn_BD"
- og:type: "website" (homepage/listings), "book" (detail pages)
- All share image URLs must be absolute (https://...)

### Structured Data (JSON-LD)
- Book detail: Product schema with name, author, price, image, ISBN (if available)
- Homepage: WebSite schema with searchAction
- About: Person schema for author (only confirmed facts)

### Canonical URLs
- Listing pages: canonical without query params to avoid duplicate content
- Book detail: canonical with book ID
- Verify query parameters do not accidentally produce duplicate canonical tags

## Cart Item Identity

Cart items are keyed by `bookId + format name` (not just bookId). This allows the same book to be added as Paperback and eBook as separate line items if both formats are available.

## Announcement Bar Behavior

- Rotating literary messages, pauses on hover and focus
- Respects prefers-reduced-motion: shows first message statically, no rotation
- Does not shift layout while text changes (fixed height container)

## Test Matrix

| Test | Expected result |
|------|----------------|
| `npm run build` | Completes with no TypeScript or build errors |
| `/`, `/books`, `/novels`, `/search?q=...` | Return 200, render correct catalogue states |
| `/book/<valid-id>` | Shows selected book with format-level pricing |
| `/book/<missing-id>` | Shows 404 page (notFound() called) |
| Cart flow | Add, update, remove, refresh persistence all work |
| Checkout flow | Validation, delivery calc, demo order, confirmation work |
| Reduced motion | Slideshow and reveal animations disabled or static |
| Keyboard flow | Drawer, search, gallery, format selector, checkout operable without mouse |
| Import pipeline | `sharp` processes images, generated data emitted, repo reset after test |
| Bengali text | Renders correctly at 375px, 640px, 820px, desktop widths |
| Accessibility | Lighthouse accessibility score 90+, no critical violations |
