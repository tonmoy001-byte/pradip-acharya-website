// app/actions/auth.ts
// Server actions for authentication.
// SSR createAuthActions handles cookie-based auth: signIn, signUp, signOut, verifyEmail.
// Basic createClient handles methods not in SSR AuthActions: resend, reset, update.

"use server"

import { cookies } from "next/headers"
import { createAuthActions } from "@insforge/sdk/ssr"
import { createClient } from "@insforge/sdk"

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL || "https://cpd9mnqf.ap-southeast.insforge.app"
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || "anon_34290d5cd8a56b6f0a9885ad57385af0fe4d38bd8fe02104e94f3f36d8b705e2"

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
  } catch (e: any) {
    return { error: e?.message || "Server error during sign in" }
  }
}

export async function signUp(email: string, password: string, name?: string) {
  try {
    const auth = createAuthActions({ cookies: await cookies(), baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY })
    const result = await auth.signUp({ email, password, name })
    if (result.error) return { error: result.error.message || "Sign up failed" }
    if (result.data?.requireEmailVerification) {
      return {
        requireEmailVerification: true,
        message: "অ্যাকাউন্ট তৈরি হয়েছে। আপনার ইমেইলে একটি যাচাইকরণ কোড পাঠানো হয়েছে। কোডটি প্রবেশ করুন।",
      }
    }
    return { user: result.data?.user ?? null, message: "অ্যাকাউন্ট তৈরি হয়েছে।" }
  } catch (e: any) {
    return { error: e?.message || "Server error during sign up" }
  }
}

export async function signOut() {
  try {
    const auth = createAuthActions({ cookies: await cookies(), baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY })
    const result = await auth.signOut()
    if (result.error) return { error: result.error.message || "Sign out failed" }
    return {}
  } catch (e: any) {
    return { error: e?.message || "Server error during sign out" }
  }
}

export async function verifyEmailAction(email: string, otp: string) {
  try {
    const auth = createAuthActions({ cookies: await cookies(), baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY })
    const result = await auth.verifyEmail({ email, otp })
    if (result.error) return { error: result.error.message || "Verification failed" }
    return { user: result.data?.user ?? null, success: true }
  } catch (e: any) {
    return { error: e?.message || "Server error during verification" }
  }
}

export async function resendVerification(email: string) {
  try {
    const client = getBasicClient()
    const { error } = await (client.auth as any).resendVerificationEmail({ email })
    if (error) return { error: error.message || "Failed to resend verification email" }
    return { success: true }
  } catch (e: any) {
    return { error: e?.message || "Server error" }
  }
}

export async function sendResetPasswordEmail(email: string) {
  try {
    const client = getBasicClient()
    const { error } = await (client.auth as any).sendResetPasswordEmail({ email })
    if (error) return { error: error.message || "Failed to send reset email" }
    return { success: true }
  } catch (e: any) {
    return { error: e?.message || "Server error" }
  }
}

export async function resetPassword(newPassword: string, otp: string) {
  try {
    const client = getBasicClient()
    const { error } = await (client.auth as any).resetPassword({ newPassword, otp })
    if (error) return { error: error.message || "Failed to reset password" }
    return { success: true }
  } catch (e: any) {
    return { error: e?.message || "Server error" }
  }
}

export async function updatePassword(_newPassword: string) {
  return {
    error: "পাসওয়ার্ড পরিবর্তনের জন্য 'পাসওয়ার্ড ভুলে গেছেন' ফ্লো ব্যবহার করুন।",
  }
}
