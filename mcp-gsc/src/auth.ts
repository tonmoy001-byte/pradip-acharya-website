// mcp-gsc/src/auth.ts
// Service account authentication helper for Google Search Console API.

import { GoogleAuth } from "google-auth-library"

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]

let cachedAuth: GoogleAuth | null = null

/**
 * Get a GoogleAuth instance configured with service account credentials.
 * Uses GOOGLE_APPLICATION_CREDENTIALS env var for the key file path.
 * Caches the instance for reuse across requests.
 */
export function getAuth(): GoogleAuth {
  if (!cachedAuth) {
    const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS
    if (!keyFile) {
      throw new Error(
        "GOOGLE_APPLICATION_CREDENTIALS env var is not set. " +
        "Set it to the path of your Google service account JSON key file."
      )
    }
    cachedAuth = new GoogleAuth({
      keyFile,
      scopes: SCOPES,
    })
  }
  return cachedAuth
}

/**
 * Get the default site URL from GSC_SITE_URL env var.
 * Throws if not set.
 */
export function getDefaultSiteUrl(): string {
  const siteUrl = process.env.GSC_SITE_URL
  if (!siteUrl) {
    throw new Error(
      "GSC_SITE_URL env var is not set. " +
      "Set it to your Google Search Console property URL (e.g., https://example.com/)."
    )
  }
  return siteUrl
}
