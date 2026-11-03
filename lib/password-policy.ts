// lib/password-policy.ts
// Shared password rules enforced server-side in every auth action.
//
// The browser forms also validate, but they can be bypassed by a direct API
// call or a tampered client. These checks run before any InsForge request.

const MIN_LENGTH = 8

/** Returns a Bengali error message when the password is too weak, or null. */
export function validatePassword(password: string): string | null {
  if (typeof password !== "string") return "পাসওয়ার্ড আবশ্যক"
  if (password.length < MIN_LENGTH) {
    return `পাসওয়ার্ড অন্তত ${MIN_LENGTH} অক্ষর হতে হবে`
  }
  return null
}