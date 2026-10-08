// lib/auth.tsx
// Client-side auth provider using Server Actions + InsForge SSR.
// Auth mutations run as Server Actions (set cookies on our domain).
// Session is read via /api/profile (SSR server client reads cookies).

"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import type { ReactNode } from "react"
import {
  signIn as serverSignIn,
  signUp as serverSignUp,
  signOut as serverSignOut,
  verifyEmailAction,
  resendVerification as serverResendVerification,
  sendResetPasswordEmail as serverSendResetPasswordEmail,
} from "@/app/actions/auth"
import { parseProfileResponse } from "./profile-response"

export interface AuthUser {
  id: string
  email: string
  name?: string | null
  isAdmin?: boolean
}

export interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, name?: string) => Promise<{ error?: string; message?: string; requireEmailVerification?: boolean }>
  signOut: () => Promise<void>
  verifyEmail: (email: string, otp: string, name?: string) => Promise<{ error?: string; success?: boolean }>
  resendVerification: (email: string) => Promise<{ error?: string; success?: boolean }>
  resetPassword: (email: string) => Promise<{ error?: string; success?: boolean }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function fetchProfile(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/profile", { credentials: "include" })
    if (!res.ok) return null
    const json = await res.json()
    return parseProfileResponse(json)
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Check session on mount via /api/profile
  useEffect(() => {
    async function checkSession() {
      try {
        const profile = await fetchProfile()
        if (profile) {
          setUser(profile)
        }
      } catch {
        // Not logged in
      } finally {
        setLoading(false)
      }
    }
    checkSession()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await serverSignIn(email, password)
    if (result.error) return { error: result.error }
    // After server action sets cookies, fetch profile
    const profile = await fetchProfile()
    if (profile) {
      setUser(profile)
    }
    return {}
  }, [])

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    const result = await serverSignUp(email, password, name)
    if (result.error) return { error: result.error }
    if (result.requireEmailVerification) {
      return {
        requireEmailVerification: true,
        message: result.message,
      }
    }
    // After server action sets cookies, fetch profile
    const profile = await fetchProfile()
    if (profile) {
      setUser(profile)
    }
    return { message: result.message }
  }, [])

  const verifyEmail = useCallback(async (email: string, otp: string, name?: string) => {
    const result = await verifyEmailAction(email, otp, name)
    if (result.error) return { error: result.error }
    // After server action sets cookies, fetch profile
    const profile = await fetchProfile()
    if (profile) {
      setUser(profile)
    }
    return { success: true }
  }, [])

  const resendVerification = useCallback(async (email: string) => {
    return serverResendVerification(email)
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    return serverSendResetPasswordEmail(email)
  }, [])

  const signOut = useCallback(async () => {
    await serverSignOut()
    setUser(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    const profile = await fetchProfile()
    if (profile) {
      setUser(profile)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, verifyEmail, resendVerification, resetPassword, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
