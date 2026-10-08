"use client"

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth"

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { user, signOut } = useAuth()
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
          {user ? (
              <Link
                href={user.isAdmin ? "/admin" : "/account"}
                className="navbar-icon-btn navbar-user-icon"
                aria-label={user.isAdmin ? "এডমিন প্যানেল" : "আমার অ্যাকাউন্ট"}
                title={user.isAdmin ? "এডমিন প্যানেল" : "আমার অ্যাকাউন্ট"}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <span className="navbar-user-dot" />
              </Link>
          ) : (
            <Link href="/login" className="navbar-icon-btn" aria-label="লগ ইন">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </Link>
          )}

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
            {user ? (
              <>
                <Link
                  href={user.isAdmin ? "/admin" : "/account"}
                  className="navbar-drawer-link"
                  onClick={() => setDrawerOpen(false)}
                >
                  {user.isAdmin ? "এডমিন প্যানেল" : "আমার অ্যাকাউন্ট"}
                </Link>
                <button
                  onClick={() => { signOut(); setDrawerOpen(false) }}
                  className="navbar-drawer-link"
                  style={{ background: "none", border: "none", cursor: "pointer", textAlign: "start", width: "100%", color: "inherit", font: "inherit" }}
                >
                  লগ আউট
                </button>
              </>
            ) : (
              <Link href="/login" className="navbar-drawer-link" onClick={() => setDrawerOpen(false)}>লগ ইন</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
