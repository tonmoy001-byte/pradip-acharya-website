// app/actions/auth.ts
// Server actions for authentication.
// SSR createAuthActions handles cookie-based auth: signIn, signUp, signOut, verifyEmail.
// Basic createClient handles methods not in SSR AuthActions: resend, reset, update.

"use server"

import { cookies } from "next/headers"
import { createAuthActions } from "@insforge/sdk/ssr"
import { createClient } from "@insforge/sdk"
import { createServerClient } from "@/lib/insforge-server"

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!

function getBasicClient() {
  return createClient({
    baseUrl: INSFORGE_URL,
    anonKey: INSFORGE_ANON_KEY,
  } as any)
}

export async function signIn(email: string, password: string) {
  try {
    const auth = createAuthActions({ cookies: await cookies(), baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY })
    const result = await auth.signInWithPassword({ email, password })
    if (result.error) return { error: result.error.message || "Sign in failed" }
    return { user: result.data?.user ?? null }
  } catch (e: unknown) {
    console.error("[auth] signIn exception:", e instanceof Error ? e.message : e)
    return { error: "Server error during sign in" }
  }
}

import { validatePassword } from "@/lib/password-policy"

export async function signUp(email: string, password: string, name?: string) {
  try {
    const passwordError = validatePassword(password)
    if (passwordError) return { error: passwordError }
    const auth = createAuthActions({ cookies: await cookies(), baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY })
    const result = await auth.signUp({ email, password, name })
    if (result.error) return { error: result.error.message || "Sign up failed" }
    if (result.data?.requireEmailVerification) {
      return {
        requireEmailVerification: true,
        message: "অ্যাকাউন্ট তৈরি হয়েছে। আপনার ইমেইলে একটি যাচাইকরণ কোড পাঠানো হয়েছে। কোডটি প্রবেশ করুন।",
      }
    }

    // No email verification required — save name to profiles now
    if (name) {
      try {
        const client = await createServerClient()
        // Get user ID from the server client (result.data?.user?.id may be null)
        const { data: userData } = await client.auth.getCurrentUser()
        const userId = userData?.user?.id
        if (userId) {
          const { data: existing } = await client.database
            .from("profiles")
            .select("user_id")
            .eq("user_id", userId)
            .maybeSingle()
          if (existing) {
            await client.database.from("profiles").update({ display_name: name }).eq("user_id", userId)
          } else {
            await client.database.from("profiles").insert([{ user_id: userId, display_name: name }])
          }
        }
      } catch (e) {
        console.error("[signUp] Failed to save name:", e)
      }
    }

    return { user: result.data?.user ?? null, message: "অ্যাকাউন্ট তৈরি হয়েছে।" }
  } catch (e: unknown) {
    console.error("[auth] signUp exception:", e instanceof Error ? e.message : e)
    return { error: "Server error during sign up" }
  }
}

export async function signOut() {
  try {
    const auth = createAuthActions({ cookies: await cookies(), baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY })
    const result = await auth.signOut()
    if (result.error) return { error: result.error.message || "Sign out failed" }
    return {}
  } catch (e: unknown) {
    console.error("[auth] signOut exception:", e instanceof Error ? e.message : e)
    return { error: "Server error during sign out" }
  }
}

export async function verifyEmailAction(email: string, otp: string, name?: string) {
  try {
    const auth = createAuthActions({ cookies: await cookies(), baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY })
    const result = await auth.verifyEmail({ email, otp })
    if (result.error) return { error: result.error.message || "Verification failed" }

    // After verification, save the name to the profiles table
    if (name) {
      try {
        const client = await createServerClient()
        // Get user ID from the server client (result.data?.user?.id may be null)
        const { data: userData } = await client.auth.getCurrentUser()
        const userId = userData?.user?.id
        if (userId) {
          const { data: existing } = await client.database
            .from("profiles")
            .select("user_id")
            .eq("user_id", userId)
            .maybeSingle()
          if (existing) {
            await client.database.from("profiles").update({ display_name: name }).eq("user_id", userId)
          } else {
            await client.database.from("profiles").insert([{ user_id: userId, display_name: name }])
          }
        }
      } catch (e) {
        console.error("[verifyEmailAction] Failed to save name:", e)
      }
    }

    return { user: result.data?.user ?? null, success: true }
  } catch (e: unknown) {
    console.error("[auth] verifyEmail exception:", e instanceof Error ? e.message : e)
    return { error: "Server error during verification" }
  }
}

export async function resendVerification(email: string) {
  try {
    const client = getBasicClient()
    const { error } = await (client.auth as any).resendVerificationEmail({ email })
    if (error) {
      console.error("[auth] resend failed:", error.message)
      return { error: "Failed to resend verification email" }
    }
    return { success: true }
  } catch (e: any) {
    console.error("[auth] resend exception:", e?.message || e)
    return { error: "Server error" }
  }
}

export async function sendResetPasswordEmail(email: string) {
  try {
    const client = getBasicClient()
    const { error } = await (client.auth as any).sendResetPasswordEmail({ email })
    if (error) {
      console.error("[auth] reset-send failed:", error.message)
      return { error: "Failed to send reset email" }
    }
    return { success: true }
  } catch (e: any) {
    console.error("[auth] reset-send exception:", e?.message || e)
    return { error: "Server error" }
  }
}

export async function resetPassword(newPassword: string, otp: string) {
  try {
    const passwordError = validatePassword(newPassword)
    if (passwordError) return { error: passwordError }
    const client = getBasicClient()
    const { error } = await (client.auth as any).resetPassword({ newPassword, otp })
    if (error) {
      console.error("[auth] reset failed:", error.message)
      return { error: "Failed to reset password" }
    }
    return { success: true }
  } catch (e: any) {
    console.error("[auth] reset exception:", e?.message || e)
    return { error: "Server error" }
  }
}
