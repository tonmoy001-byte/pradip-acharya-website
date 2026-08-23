"use client"

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { useCart } from "@/lib/store"

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { itemCount } = useCart()
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // Focus trap for drawer
  useEffect(() => {
    if (!drawerOpen) return
    closeRef.current?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDrawerOpen(false)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [drawerOpen])

  return (
    <nav className="navbar" role="navigation" aria-label="মূল নেভিগেশন">
      <div className="container navbar-inner">
        <Link href="/" className="navbar-logo">
          <span className="navbar-logo-author">প্রদীপ কুমার আচার্য্য</span>
          <span className="navbar-logo-title">ছেঁড়া পুষ্প</span>
        </Link>

        <div className="navbar-links hide-mobile">
          <Link href="/" className="navbar-link">হোম</Link>
          <Link href="/books" className="navbar-link">সকল বই</Link>
          <Link href="/novels" className="navbar-link">উপন্যাস</Link>
          <Link href="/about" className="navbar-link">লেখক পরিচিতি</Link>
        </div>

        <div className="navbar-actions">
          <Link href="/search" className="navbar-icon-btn" aria-label="অনুসন্ধান">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </Link>

          <Link href="/cart" className="navbar-icon-btn" aria-label={`কার্ট (${itemCount} আইটেম)`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1"/>
              <circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            {itemCount > 0 && <span className="navbar-badge">{itemCount}</span>}
          </Link>

          <button
            className="navbar-hamburger show-mobile-only"
            onClick={() => setDrawerOpen(true)}
            aria-label="মেনু খুলুন"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {drawerOpen && (
        <div className="navbar-drawer" role="dialog" aria-label="নেভিগেশন মেনু" ref={drawerRef}>
          <div className="navbar-drawer-overlay" onClick={() => setDrawerOpen(false)} />
          <div className="navbar-drawer-content">
            <div className="navbar-drawer-header">
              <span className="navbar-logo-author">মেনু</span>
              <button ref={closeRef} onClick={() => setDrawerOpen(false)} aria-label="মেনু বন্ধ করুন" className="navbar-drawer-close">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <Link href="/" className="navbar-drawer-link" onClick={() => setDrawerOpen(false)}>হোম</Link>
            <Link href="/books" className="navbar-drawer-link" onClick={() => setDrawerOpen(false)}>সকল বই</Link>
            <Link href="/novels" className="navbar-drawer-link" onClick={() => setDrawerOpen(false)}>উপন্যাস</Link>
            <Link href="/about" className="navbar-drawer-link" onClick={() => setDrawerOpen(false)}>লেখক পরিচিতি</Link>
            <Link href="/search" className="navbar-drawer-link" onClick={() => setDrawerOpen(false)}>অনুসন্ধান</Link>
          </div>
        </div>
      )}
    </nav>
  )
}
