# Book eCommerce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Bengali author-and-book eCommerce website for "প্রদীপ কুমার আচার্য্য" centered on his novel "ছেঁড়া পুষ্প" with Next.js App Router, TypeScript, and pure CSS.

**Architecture:** Server components by default, client components for interactivity. Mock async service layer as backend-swap seam. React Context + localStorage for cart. CSS custom properties for design system. Phased incremental build.

**Tech Stack:** Next.js (App Router), TypeScript, React, CSS (no Tailwind), Google Fonts (Noto Serif/Sans Bengali), sharp (import pipeline)

---

## File Structure

```
app/
  layout.tsx                    Root layout with CartProvider, Navbar, Footer, fonts
  page.tsx                      Homepage
  globals.css                   Design system + utilities
  loading.tsx                   Site-wide loading skeleton
  error.tsx                     Client error boundary
  not-found.tsx                 404 page
  books/page.tsx                Book listing (all categories)
  novels/page.tsx               Novel listing (category-filtered)
  book/[id]/page.tsx            Book detail
  cart/page.tsx                 Cart page
  checkout/page.tsx             Checkout page
  login/page.tsx                Login/signup UI
  about/page.tsx                About author
  contact/page.tsx              Contact stub
  privacy/page.tsx              Privacy stub
  search/page.tsx               Search results

components/
  Navbar.tsx                    Client: mobile nav, search, cart badge
  AnnouncementBar.tsx           Client: rotating messages
  Hero.tsx                      Client: slideshow
  BookCard.tsx                  Client: hover swap, quick add
  Gallery.tsx                   Client: image gallery
  FormatSelector.tsx            Client: format tabs
  QtyStepper.tsx                Client: quantity +/- 
  CartProvider.tsx              Client: React Context
  ScrollReveal.tsx              Client: IntersectionObserver wrapper
  Toast.tsx                     Client: notifications
  SearchOverlay.tsx             Client: fullscreen search
  Footer.tsx                    Server: footer links
  BookGrid.tsx                  Server: responsive grid wrapper

lib/
  data.ts                       Types, BASE_BOOKS, CATEGORIES, STORE_CONFIG
  api.ts                        Mock service layer
  orders.ts                     Demo order creation
  store.tsx                     Cart context + localStorage
  format.ts                     money() helper

scripts/
  import-listings.mjs           CSV import script

incoming/
  listings-template.csv         Template CSV
  README.md                     Column reference
  images/                       Drop folder

public/images/
  book-placeholder.svg          Fallback SVG
  books/                        Generated book covers
```

---

## Phase 1: Scaffold + Foundation

### Task 1: Create Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: Scaffold with create-next-app**

```bash
cd H:/website
npx create-next-app . --typescript --app --npm --no-eslint --no-tailwind --no-src-dir --import-alias "@/*"
```

- [ ] **Step 2: Install sharp dependency**

```bash
npm install sharp
```

- [ ] **Step 3: Verify scaffold builds**

```bash
npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit scaffold**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js project with TypeScript"
```

### Task 2: Define Core Types and Data Layer

**Files:**
- Create: `lib/data.ts`

- [ ] **Step 1: Create lib/data.ts with Book interface and seed data**

```typescript
// lib/data.ts
// Core types, store configuration, and seed book data.
// This is the single source of truth for the demo catalogue.

export type BookCategory = "novels" | "books"
export type BookFormatName = "Paperback" | "Hardcover" | "eBook"

export interface BookFormat {
  name: BookFormatName
  price: number
  compareAtPrice?: number
  available: boolean
}

export interface Book {
  id: string
  title: string
  author: string
  category: BookCategory
  subcategory: string
  subcategorySlug: string
  description: string
  synopsis?: string
  formats: BookFormat[]
  publicationDate?: string
  publisher?: string
  isbn?: string
  pages?: number
  language?: string
  images: { primary: string; hover?: string }
  featured: boolean
  isNew: boolean
  trending: boolean
  isDemo?: boolean
}

// Store configuration
export const STORE_LOCALE = "bn-BD"
export const STORE_CURRENCY = "BDT"
export const DELIVERY_CHARGE = 60
export const FREE_DELIVERY_THRESHOLD = 750

// Subcategory slug-to-label mapping
export const SUBCATEGORY_MAP: Record<string, string> = {
  "novels": "উপন্যাস",
  "poetry": "কবিতা",
  "essays": "প্রবন্ধ",
}

// Category display names
export const CATEGORIES: { slug: string; label: string; category: BookCategory }[] = [
  { slug: "novels", label: "উপন্যাস", category: "novels" },
  { slug: "literary-books", label: "সাহিত্য বই", category: "books" },
]

// Seed data
export const BASE_BOOKS: Book[] = [
  {
    id: "chhera-pushpo",
    title: "ছেঁড়া পুষ্প",
    author: "প্রদীপ কুমার আচার্য্য",
    category: "novels",
    subcategory: "উপন্যাস",
    subcategorySlug: "novels",
    description: "একটি উপন্যাস যেখানে স্মৃতি ও বর্তমানের মিলন ঘটে।",
    synopsis: "ছেঁড়া পুষ্প প্রদীপ কুমার আচার্য্যের একটি উল্লেখযোগ্য উপন্যাস। এই গল্পে আমরা দেখতে পাই...",
    formats: [
      { name: "Paperback", price: 450, compareAtPrice: 550, available: true },
      { name: "Hardcover", price: 750, available: true },
      { name: "eBook", price: 199, available: true },
    ],
    publicationDate: "2026-01-01",
    publisher: "সাহিত্য প্রকাশ",
    pages: 320,
    language: "বাংলা",
    images: {
      primary: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=900&q=80",
      hover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80",
    },
    featured: true,
    isNew: true,
    trending: true,
  },
  {
    id: "demo-poetry-1",
    title: "স্বপ্নের ডানায়",
    author: "ডেমো লেখক",
    category: "books",
    subcategory: "কবিতা",
    subcategorySlug: "poetry",
    description: "ডেমো কবিতা সংকলন।",
    formats: [
      { name: "Paperback", price: 250, available: true },
    ],
    images: {
      primary: "https://images.unsplash.com/photo-1524578271613-d550eacf6090?auto=format&fit=crop&w=900&q=80",
    },
    featured: false,
    isNew: true,
    trending: false,
    isDemo: true,
  },
  {
    id: "demo-novel-1",
    title: "নদীর স্বর",
    author: "ডেমো লেখক",
    category: "novels",
    subcategory: "উপন্যাস",
    subcategorySlug: "novels",
    description: "ডেমো উপন্যাস।",
    formats: [
      { name: "Paperback", price: 350, available: true },
    ],
    images: {
      primary: "https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&w=900&q=80",
    },
    featured: false,
    isNew: false,
    trending: true,
    isDemo: true,
  },
]

// Merge base + generated books
import { generatedBooks } from "./generated-books"
export const BOOKS: Book[] = [...BASE_BOOKS, ...generatedBooks]
// To use only generated books: export const BOOKS: Book[] = [...generatedBooks]

// Helper: get subcategories for a category from active catalogue
export function subcategoriesFor(category?: BookCategory): { slug: string; label: string }[] {
  const books = category ? BOOKS.filter(b => b.category === category) : BOOKS
  const seen = new Set<string>()
  return books
    .filter(b => {
      if (seen.has(b.subcategorySlug)) return false
      seen.add(b.subcategorySlug)
      return true
    })
    .map(b => ({ slug: b.subcategorySlug, label: b.subcategory }))
}
```

- [ ] **Step 2: Create lib/generated-books.ts (empty initially)**

```typescript
// lib/generated-books.ts
// Auto-generated by scripts/import-listings.mjs. Never hand-edit.
import type { Book } from "./data"
export const generatedBooks: Book[] = []
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit data layer**

```bash
git add lib/data.ts lib/generated-books.ts
git commit -m "feat: add core types, store config, and seed book data"
```

### Task 3: Create Service Layer

**Files:**
- Create: `lib/api.ts`

- [ ] **Step 1: Create lib/api.ts**

```typescript
// lib/api.ts
// Mock async service layer - the backend-swap seam.
// Replace these with fetch() calls when connecting a real API.
// No page-level changes needed when swapping backends.

import { BOOKS, type Book, type BookCategory } from "./data"

export interface GetBooksParams {
  category?: BookCategory
  subcategorySlug?: string
  sort?: "featured" | "price-asc" | "price-desc" | "newest"
  query?: string
  limit?: number
}

function delay(ms: number = 50): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function getBooks(params: GetBooksParams = {}): Promise<Book[]> {
  await delay()
  let books = [...BOOKS]

  if (params.category) {
    books = books.filter(b => b.category === params.category)
  }
  if (params.subcategorySlug) {
    books = books.filter(b => b.subcategorySlug === params.subcategorySlug)
  }
  if (params.query) {
    const q = params.query.toLowerCase()
    books = books.filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      b.description.toLowerCase().includes(q) ||
      b.subcategory.toLowerCase().includes(q)
    )
  }

  switch (params.sort) {
    case "price-asc":
      books.sort((a, b) => a.formats[0].price - b.formats[0].price)
      break
    case "price-desc":
      books.sort((a, b) => b.formats[0].price - a.formats[0].price)
      break
    case "newest":
      books.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0))
      break
    case "featured":
    default:
      books.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
  }

  if (params.limit) {
    books = books.slice(0, params.limit)
  }

  return books
}

export async function getBookById(id: string): Promise<Book | null> {
  await delay()
  return BOOKS.find(b => b.id === id) ?? null
}

export async function getFeatured(): Promise<Book[]> {
  return getBooks({ sort: "featured", limit: 6 })
}

export async function getNewReleases(): Promise<Book[]> {
  return getBooks({ sort: "newest", limit: 6 })
}

export async function getTrending(): Promise<Book[]> {
  await delay()
  return BOOKS.filter(b => b.trending).slice(0, 6)
}

export async function getRelated(id: string): Promise<Book[]> {
  const book = await getBookById(id)
  if (!book) return []
  return getBooks({ category: book.category, limit: 4 })
}

export async function getAllSubcategories(): Promise<{ slug: string; label: string }[]> {
  await delay()
  const seen = new Map<string, string>()
  for (const book of BOOKS) {
    if (!seen.has(book.subcategorySlug)) {
      seen.set(book.subcategorySlug, book.subcategory)
    }
  }
  return Array.from(seen.entries()).map(([slug, label]) => ({ slug, label }))
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit service layer**

```bash
git add lib/api.ts
git commit -m "feat: add mock async service layer (backend-swap seam)"
```

### Task 4: Create Money Helper and Order Seam

**Files:**
- Create: `lib/format.ts`
- Create: `lib/orders.ts`

- [ ] **Step 1: Create lib/format.ts**

```typescript
// lib/format.ts
// Money formatting helper using Bengali numerals.

const BENGALI_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"]

function toBengaliDigits(n: number): string {
  return n.toString().replace(/\d/g, d => BENGALI_DIGITS[parseInt(d)])
}

export function money(amount: number): string {
  return `৳ ${toBengaliDigits(amount)}`
}

export function deliveryCharge(subtotal: number): number {
  // Import at usage site to avoid circular deps
  const FREE_DELIVERY_THRESHOLD = 750
  const DELIVERY_CHARGE = 60
  return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE
}
```

- [ ] **Step 2: Create lib/orders.ts**

```typescript
// lib/orders.ts
// Demo order creation seam. Future backend swap point.
// SAFETY: Card fields must NEVER be stored here or anywhere.

import type { BookFormatName } from "./data"

export interface CartItem {
  bookId: string
  title: string
  author: string
  price: number
  format: BookFormatName
  quantity: number
  image: string
}

export interface OrderConfirmation {
  orderId: string
  items: CartItem[]
  total: number
  shippingAddress: string
  placedAt: string
}

function generateOrderId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = "ORD-"
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export async function createDemoOrder(payload: {
  contact: { name: string; email: string; phone: string }
  shipping: { address: string; city: string; zip: string; country: string }
  items: CartItem[]
  total: number
}): Promise<OrderConfirmation> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300))

  return {
    orderId: generateOrderId(),
    items: payload.items,
    total: payload.total,
    shippingAddress: `${payload.shipping.address}, ${payload.shipping.city} ${payload.shipping.zip}, ${payload.shipping.country}`,
    placedAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit helpers**

```bash
git add lib/format.ts lib/orders.ts
git commit -m "feat: add money helper and demo order seam"
```

### Task 5: Create Cart Context

**Files:**
- Create: `lib/store.tsx`

- [ ] **Step 1: Create lib/store.tsx**

```typescript
"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import type { BookFormatName } from "./data"

export interface CartItem {
  bookId: string
  title: string
  author: string
  price: number
  format: BookFormatName
  quantity: number
  image: string
}

interface CartContextType {
  items: CartItem[]
  addToCart: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void
  removeFromCart: (bookId: string, format: BookFormatName) => void
  updateQuantity: (bookId: string, format: BookFormatName, quantity: number) => void
  clearCart: () => void
  itemCount: number
  subtotal: number
}

const CartContext = createContext<CartContextType | null>(null)

const CART_KEY = "bookstore-cart"

function getCartFromStorage(): CartItem[] {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(CART_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveCartToStorage(items: CartItem[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(CART_KEY, JSON.stringify(items))
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [mounted, setMounted] = useState(false)

  // Read localStorage after mount to avoid SSR hydration mismatch
  useEffect(() => {
    setItems(getCartFromStorage())
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      saveCartToStorage(items)
    }
  }, [items, mounted])

  const addToCart = useCallback((item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
    setItems(prev => {
      const existing = prev.find(i => i.bookId === item.bookId && i.format === item.format)
      if (existing) {
        return prev.map(i =>
          i.bookId === item.bookId && i.format === item.format
            ? { ...i, quantity: i.quantity + (item.quantity || 1) }
            : i
        )
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }]
    })
  }, [])

  const removeFromCart = useCallback((bookId: string, format: BookFormatName) => {
    setItems(prev => prev.filter(i => !(i.bookId === bookId && i.format === format)))
  }, [])

  const updateQuantity = useCallback((bookId: string, format: BookFormatName, quantity: number) => {
    if (quantity < 1) return
    setItems(prev =>
      prev.map(i =>
        i.bookId === bookId && i.format === format ? { ...i, quantity } : i
      )
    )
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, itemCount, subtotal }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within CartProvider")
  return ctx
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit cart context**

```bash
git add lib/store.tsx
git commit -m "feat: add cart context with localStorage persistence"
```

### Task 6: Create Design System (globals.css)

**Files:**
- Create: `app/globals.css`

- [ ] **Step 1: Create app/globals.css**

The CSS file defines: palette variables, typography (imported via Google Fonts link in layout), spacing scale, breakpoints, animations (@keyframes fade-up, slide-in, crossfade), utilities (.container, .sr-only, .hairline, .section-padding, .focus-visible), and scroll-reveal classes. Must include prefers-reduced-motion media queries wrapping all animations. Must include skip-to-content link styles. Must include responsive grid classes for 4-2-1 column layout.

Key CSS custom properties:

```css
:root {
  --bg: #faf8f5;
  --ink: #16130f;
  --terracotta: #c4704b;
  --rose: #b8827a;
  --green: #4a6741;
  --stone: #8b8178;
  --border: #e5e0da;
  --font-display: "Noto Serif Bengali", "Cormorant Garamond", serif;
  --font-body: "Noto Sans Bengali", "Inter", sans-serif;
}
```

Include: reset styles, body background/text, heading styles using --font-display, body text using --font-body, .container max-width with padding, responsive grid .book-grid (grid-template-columns repeat(4,1fr) collapsing to 2 then 1), .scroll-reveal and .scroll-reveal.visible fade-up animation, .sr-only, .hairline border-top, .section-padding vertical padding, button base styles, link styles, form input/label styles with visible labels, .focus-visible focus ring, @media (prefers-reduced-motion: reduce) disabling all animations.

- [ ] **Step 2: Verify CSS has no syntax errors**

Open in browser or run build to check for CSS parsing issues.

- [ ] **Step 3: Commit design system**

```bash
git add app/globals.css
git commit -m "feat: add CSS design system with Bengali typography and accessibility"
```

### Task 7: Create Root Layout with Fonts

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update app/layout.tsx**

Root layout must:
- Set lang="bn-BD" on html element
- Import Google Fonts via next/font or link tags for Noto Serif Bengali, Noto Sans Bengali, Cormorant Garamond, Inter
- Wrap children in CartProvider
- Render AnnouncementBar, Navbar, main, Footer
- Include skip-to-content link
- Set metadata: title, description, openGraph

```tsx
import type { Metadata } from "next"
import { Noto_Serif_Bengali, Noto_Sans_Bengali, Cormorant_Garamond, Inter } from "next/font/google"
import "./globals.css"
import { CartProvider } from "@/lib/store"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import AnnouncementBar from "@/components/AnnouncementBar"

const notoSerifBengali = Noto_Serif_Bengali({ subsets: ["bengali"], variable: "--font-display", weight: ["400", "700"] })
const notoSansBengali = Noto_Sans_Bengali({ subsets: ["bengali"], variable: "--font-body", weight: ["400", "500", "700"] })
const cormorant = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-display-latin", weight: ["400", "600", "700"] })
const inter = Inter({ subsets: ["latin"], variable: "--font-body-latin", weight: ["400", "500", "600"] })

export const metadata: Metadata = {
  title: "প্রদীপ কুমার আচার্য্য - ছেঁড়া পুষ্প | বাংলা সাহিত্য",
  description: "প্রদীপ কুমার আচার্য্যের ছেঁড়া পুষ্প - বাংলা সাহিত্যের একটি উল্লেখযোগ্য উপন্যাস।",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn-BD" className={`${notoSerifBengali.variable} ${notoSansBengali.variable} ${cormorant.variable} ${inter.variable}`}>
      <body>
        <a href="#main-content" className="skip-to-content">মূল বিষয়বস্তুতে যান</a>
        <AnnouncementBar />
        <CartProvider>
          <Navbar />
          <main id="main-content">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create placeholder components (Navbar, Footer, AnnouncementBar)**

Create minimal placeholder versions of Navbar, Footer, AnnouncementBar so the layout compiles. Full implementations come in later tasks.

- [ ] **Step 3: Verify build succeeds**

```bash
npm run build
```

- [ ] **Step 4: Commit layout**

```bash
git add app/layout.tsx app/globals.css components/Navbar.tsx components/Footer.tsx components/AnnouncementBar.tsx
git commit -m "feat: add root layout with Bengali fonts and CartProvider"
```

### Task 8: Create Placeholder Assets

**Files:**
- Create: `public/images/book-placeholder.svg`
- Create: `public/images/author/.gitkeep`

- [ ] **Step 1: Create book-placeholder.svg**

Paper-toned SVG placeholder with subtle book icon and text "বইয়ের ছবি". Must match the --bg and --stone palette.

- [ ] **Step 2: Create author folder**

```bash
mkdir -p public/images/author
touch public/images/author/.gitkeep
```

- [ ] **Step 3: Commit placeholder assets**

```bash
git add public/images/
git commit -m "feat: add book placeholder SVG and author image folder"
```

---

## Phase 2: Core Components and Pages

### Task 9: Build Navbar Component

**Files:**
- Modify: `components/Navbar.tsx`

- [ ] **Step 1: Build full Navbar with mobile drawer, search, cart badge**

Client component ("use client"). Features:
- Logo/wordmark with author name and novel title
- Desktop nav links: Home, Books, Novels, About the Author
- Cart icon with live badge from useCart()
- Account icon linking to /login
- Mobile hamburger (hidden above 820px) toggling slide-in drawer
- Search icon expanding into SearchOverlay (full-screen)
- Drawer: focus trap, Escape to close, ARIA labels
- Keyboard navigable throughout

- [ ] **Step 2: Test navbar renders and cart badge updates**

Add a test item to cart, verify badge count shows.

- [ ] **Step 3: Commit Navbar**

```bash
git add components/Navbar.tsx
git commit -m "feat: build Navbar with mobile drawer, search, and cart badge"
```

### Task 10: Build AnnouncementBar Component

**Files:**
- Modify: `components/AnnouncementBar.tsx`

- [ ] **Step 1: Build AnnouncementBar with rotating messages**

Client component. Features:
- 2-3 literary messages in Bengali rotating every 5s
- Pauses on hover and focus
- Respects prefers-reduced-motion: shows first message statically
- Fixed height container (no layout shift)
- Thin strip styling above navbar

- [ ] **Step 2: Verify reduced motion behavior**

- [ ] **Step 3: Commit AnnouncementBar**

```bash
git add components/AnnouncementBar.tsx
git commit -m "feat: build AnnouncementBar with rotation and reduced motion"
```

### Task 11: Build Footer Component

**Files:**
- Modify: `components/Footer.tsx`

- [ ] **Step 1: Build Footer (server component)**

Features:
- Author/book blurb section
- Link columns: Books, Author, Support & Legal
- Inline SVG social icons
- Copyright with current year
- Hairline dividers between sections

- [ ] **Step 2: Commit Footer**

```bash
git add components/Footer.tsx
git commit -m "feat: build Footer with links and social icons"
```

### Task 12: Build ScrollReveal Wrapper

**Files:**
- Create: `components/ScrollReveal.tsx`

- [ ] **Step 1: Build ScrollReveal with IntersectionObserver**

Client component. Features:
- Wraps children, adds fade-up animation when in viewport
- Respects prefers-reduced-motion: appears immediately
- Uses .scroll-reveal and .scroll-reveal.visible CSS classes

- [ ] **Step 2: Commit ScrollReveal**

```bash
git add components/ScrollReveal.tsx
git commit -m "feat: add ScrollReveal IntersectionObserver wrapper"
```

### Task 13: Build Toast System

**Files:**
- Create: `components/Toast.tsx`

- [ ] **Step 1: Build Toast with ARIA live region**

Client component. Features:
- Global toast state via context or module-level state
- showToast(message) function
- Auto-dismiss after 3s
- Stacked positioning (bottom-right)
- ARIA live region for screen readers

- [ ] **Step 2: Commit Toast**

```bash
git add components/Toast.tsx
git commit -m "feat: add Toast notification system with ARIA"
```

### Task 14: Build Hero Component

**Files:**
- Create: `components/Hero.tsx`

- [ ] **Step 1: Build Hero slideshow**

Client component. Features:
- Auto-rotating crossfade of 3 Unsplash images (6s interval)
- Respects prefers-reduced-motion: shows static image
- Gradient overlay for text readability
- Staggered Bengali text entrance animation
- Author name, novel title, CTAs
- Scroll-down indicator

- [ ] **Step 2: Commit Hero**

```bash
git add components/Hero.tsx
git commit -m "feat: build Hero slideshow with Bengali text animation"
```

### Task 15: Build BookCard Component

**Files:**
- Create: `components/BookCard.tsx`

- [ ] **Step 1: Build BookCard with hover swap and Quick Add**

Client component. Features:
- Book cover image with hover swap to secondary image
- Title, author, price (formatted with money())
- "Demo" badge when isDemo: true
- Bengali subcategory label
- Quick Add button:
  - Single format: adds immediately, shows toast
  - Multiple formats: opens format popover
- Link to /book/[id]

- [ ] **Step 2: Commit BookCard**

```bash
git add components/BookCard.tsx
git commit -m "feat: build BookCard with hover swap and Quick Add"
```

### Task 16: Build BookGrid Wrapper

**Files:**
- Create: `components/BookGrid.tsx`

- [ ] **Step 1: Build BookGrid (server component)**

Features:
- Responsive 4-to-2-to-1 column grid
- Takes array of books, renders BookCard for each
- Empty state when no books

- [ ] **Step 2: Commit BookGrid**

```bash
git add components/BookGrid.tsx
git commit -m "feat: add BookGrid responsive wrapper"
```

### Task 17: Build Homepage

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Build Homepage**

Server component. Fetches data from service layer. Sections:
- Hero (client component)
- Author intro card (typographic, placeholder labeled)
- Featured book highlight for ছেঁড়া পুষ্প
- Category cards with hover zoom
- Featured books grid (conditional)
- New releases section (conditional)
- Trending section (conditional)
- Promotional banner strip
- Newsletter signup strip (interactive UI only)

Each section wrapped in ScrollReveal.

- [ ] **Step 2: Verify homepage renders with all sections**

```bash
npm run build && npm start
curl http://localhost:3000
```

- [ ] **Step 3: Commit Homepage**

```bash
git add app/page.tsx components/Hero.tsx
git commit -m "feat: build Homepage with all sections"
```

### Task 18: Build Book Listing Page

**Files:**
- Create: `app/books/page.tsx`
- Create: `app/novels/page.tsx`

- [ ] **Step 1: Build /books listing**

Server component. Features:
- Reads URL params: subcategory, sort
- Calls getBooks() with category=all, subcategorySlug, sort
- Filter pills from getAllSubcategories()
- Sort dropdown
- BookGrid with results
- "Demo" badges visible

- [ ] **Step 2: Build /novels listing**

Same as /books but with category="novels" pre-filtered.

- [ ] **Step 3: Verify listings render and filters work**

```bash
npm run build && npm start
curl http://localhost:3000/books
curl http://localhost:3000/novels
curl "http://localhost:3000/books?subcategory=poetry&sort=price-asc"
```

- [ ] **Step 4: Commit listings**

```bash
git add app/books/ app/novels/
git commit -m "feat: build book and novels listing pages with filters"
```

### Task 19: Build Book Detail Page

**Files:**
- Create: `app/book/[id]/page.tsx`
- Create: `components/Gallery.tsx`
- Create: `components/FormatSelector.tsx`
- Create: `components/QtyStepper.tsx`

- [ ] **Step 1: Build Gallery component**

Client component. Features:
- Main image display with thumbnails
- Click thumbnail to swap main image
- Keyboard arrow navigation between thumbnails
- Alt text in Bengali

- [ ] **Step 2: Build FormatSelector component**

Client component. Features:
- Format tabs (Paperback / Hardcover / eBook)
- Shows price for each format
- Shows compare-at price with strikethrough
- Disabled state for unavailable formats
- Arrow key navigation between options

- [ ] **Step 3: Build QtyStepper component**

Client component. Features:
- Minus/Plus buttons
- Min 1, max 10
- Current quantity display
- ARIA labels for buttons

- [ ] **Step 4: Build Book Detail page**

Server component shell with client interactivity. Features:
- Fetches book by ID via getBookById()
- Calls notFound() if null
- Gallery, title, author, price from selected format
- Description, synopsis
- FormatSelector (client)
- QtyStepper (client)
- Add to Cart button (writes to context, shows toast)
- Delivery information
- Related books row
- Rich detail for ছেঁড়া পুষ্প

- [ ] **Step 5: Verify book detail works end-to-end**

```bash
npm run build && npm start
curl http://localhost:3000/book/chhera-pushpo
curl http://localhost:3000/book/missing-id  # Should 404
```

- [ ] **Step 6: Commit book detail**

```bash
git add app/book/ components/Gallery.tsx components/FormatSelector.tsx components/QtyStepper.tsx
git commit -m "feat: build book detail page with gallery, format selector, and cart"
```

---

## Phase 3: Commerce Flow

### Task 20: Build Cart Page

**Files:**
- Create: `app/cart/page.tsx`

- [ ] **Step 1: Build Cart page**

Server component shell with client cart items. Features:
- Line items: cover image, title, format, price
- Quantity +/- and remove buttons
- Order summary: subtotal, delivery charge (via deliveryCharge()), total
- "Proceed to Checkout" CTA
- Empty cart state with browse CTA
- Delivery info: "Flat ৳60 delivery. Free on orders over ৳750."

- [ ] **Step 2: Test cart flow: add item, verify cart page shows it**

- [ ] **Step 3: Commit Cart**

```bash
git add app/cart/
git commit -m "feat: build cart page with order summary"
```

### Task 21: Build Checkout Page

**Files:**
- Create: `app/checkout/page.tsx`

- [ ] **Step 1: Build Checkout page**

Client component. Features:
- Contact form: name, email, phone (all required, visible labels, aria-describedby errors)
- Shipping form: address, city, zip, country (all required)
- Dummy payment fields: card number, expiry, CVC - labeled "Demo only - no real payment" / "এটি একটি ডেমো"
- Order summary sidebar
- "Place Order" button validates all fields, shows inline errors
- On success: calls createDemoOrder(), clears cart, shows confirmation
- Confirmation: order number, items, shipping, total
- Card fields NEVER stored anywhere
- Bengali demo payment message

- [ ] **Step 2: Test checkout flow end-to-end**

Add items to cart, fill forms, place order, verify confirmation.

- [ ] **Step 3: Commit Checkout**

```bash
git add app/checkout/
git commit -m "feat: build checkout page with validation and demo order"
```

### Task 22: Build Search Page

**Files:**
- Create: `app/search/page.tsx`
- Create: `components/SearchOverlay.tsx`

- [ ] **Step 1: Build SearchOverlay**

Client component. Features:
- Full-screen overlay
- Search input with live filtering
- Results displayed in real-time
- Escape to close, focus trap
- Returns focus to trigger element
- "No results" state

- [ ] **Step 2: Build /search page**

Server component reading ?q= param. Client-side filtering of books.

- [ ] **Step 3: Commit Search**

```bash
git add app/search/ components/SearchOverlay.tsx
git commit -m "feat: build search page and overlay"
```

---

## Phase 4: Supporting Pages

### Task 23: Build Login Page

**Files:**
- Create: `app/login/page.tsx`

- [ ] **Step 1: Build Login page**

Client component. Features:
- Tabbed Sign In / Create Account
- Sign In: email + password
- Create Account: name + email + password + confirm password
- UI only, no real auth
- Premium literary styling
- Form validation (required fields, email format, password match)

- [ ] **Step 2: Commit Login**

```bash
git add app/login/
git commit -m "feat: build login/signup UI"
```

### Task 24: Build Static Stubs

**Files:**
- Create: `app/about/page.tsx`
- Create: `app/contact/page.tsx`
- Create: `app/privacy/page.tsx`

- [ ] **Step 1: Build About page**

Introduces প্রদীপ কুমার আচার্য্য and ছেঁড়া পুষ্প. No invented facts - use "[জীবনী যোগ করুন]" placeholders.

- [ ] **Step 2: Build Contact page**

Reader and order support information.

- [ ] **Step 3: Build Privacy page**

Minimal privacy policy stub.

- [ ] **Step 4: Commit stubs**

```bash
git add app/about/ app/contact/ app/privacy/
git commit -m "feat: build about, contact, and privacy stubs"
```

### Task 25: Build Loading, Error, Not-Found States

**Files:**
- Create: `app/loading.tsx`
- Create: `app/error.tsx`
- Create: `app/not-found.tsx`

- [ ] **Step 1: Build loading.tsx**

Site-wide loading skeleton with literary styling.

- [ ] **Step 2: Build error.tsx**

"use client" error boundary with retry button and accessible error message.

- [ ] **Step 3: Build not-found.tsx**

404 page with "Book not found" messaging and browse CTA.

- [ ] **Step 4: Commit states**

```bash
git add app/loading.tsx app/error.tsx app/not-found.tsx
git commit -m "feat: add loading, error, and not-found states"
```

---

## Phase 5: Listings Pipeline

### Task 26: Build Import Script

**Files:**
- Create: `scripts/import-listings.mjs`
- Create: `incoming/listings-template.csv`
- Create: `incoming/README.md`
- Create: `incoming/images/.gitkeep`

- [ ] **Step 1: Create incoming folder structure**

```bash
mkdir -p incoming/images
```

- [ ] **Step 2: Create listings-template.csv**

Header row + 1 example row with the ছেঁড়া পুষ্প data.

- [ ] **Step 3: Create incoming/README.md**

Column reference, usage instructions.

- [ ] **Step 4: Create scripts/import-listings.mjs**

Dependency-free Node script (uses sharp for image optimization). Features:
- Quote-aware CSV parser
- Validates required fields: title, author, category, price, subcategory, image1
- Auto-slugifies IDs from titles, -2 suffix on collision, -3 if collides with BASE_BOOKS
- Image optimization: sharp (max 1400px, JPEG quality 80)
- Outputs: public/images/books/<id>-1.jpg, <id>-2.jpg
- Regenerates lib/generated-books.ts wholesale (idempotent)
- Missing images: book-placeholder.svg + console warning

- [ ] **Step 5: Add npm script to package.json**

```json
"scripts": {
  "import-listings": "node scripts/import-listings.mjs"
}
```

- [ ] **Step 6: Test import pipeline**

```bash
npm run import-listings
```
Verify lib/generated-books.ts is emitted. Verify books appear on listing page.

- [ ] **Step 7: Reset test state**

Remove test CSV, test images, generated entries.

- [ ] **Step 8: Commit pipeline**

```bash
git add scripts/ incoming/
git commit -m "feat: add listings import pipeline with sharp"
```

---

## Phase 6: Polish and Verification

### Task 27: Add Metadata and Open Graph

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Modify: `app/books/page.tsx`
- Modify: `app/novels/page.tsx`
- Modify: `app/about/page.tsx`
- Modify: `app/book/[id]/page.tsx`

- [ ] **Step 1: Add page-specific metadata exports**

Each page exports metadata with title, description, openGraph (og:title, og:description, og:image, og:url, og:site_name, og:locale="bn_BD", og:type).

- [ ] **Step 2: Add JSON-LD structured data**

Homepage: WebSite schema. Book detail: Product schema. About: Person schema.

- [ ] **Step 3: Add canonical URLs**

Listing pages canonicalize without query params. Book detail canonicalizes with book ID.

- [ ] **Step 4: Commit metadata**

```bash
git add app/
git commit -m "feat: add page metadata, Open Graph, and JSON-LD"
```

### Task 28: Verify Build and Routes

- [ ] **Step 1: Run full build**

```bash
npm run build
```
Expected: No TypeScript or build errors.

- [ ] **Step 2: Start production server and curl all routes**

```bash
npm start
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/books
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/novels
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/search?q=novel"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/book/chhera-pushpo
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/cart
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/checkout
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/about
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/contact
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/privacy
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/book/missing-id
```
Expected: All return 200 except missing-id which returns 404.

- [ ] **Step 3: Kill server**

- [ ] **Step 4: Run import pipeline smoke test**

```bash
npm run import-listings
```
Verify generated-books.ts emitted, books appear on listing. Then reset.

- [ ] **Step 5: Commit any fixes**

```bash
git add .
git commit -m "fix: address build and route verification issues"
```

### Task 29: Final Smoke Test

- [ ] **Step 1: Verify Bengali text renders at all breakpoints**

Check 375px, 640px, 820px, desktop widths.

- [ ] **Step 2: Verify keyboard navigation**

Tab through drawer, search, gallery, format selector, checkout fields.

- [ ] **Step 3: Verify reduced motion**

Enable prefers-reduced-motion, verify animations disabled.

- [ ] **Step 4: Verify cart persistence**

Add items, refresh page, verify items persist.

- [ ] **Step 5: Verify checkout end-to-end**

Add items, fill forms, place order, verify confirmation with order number.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: final smoke test and polish"
```
