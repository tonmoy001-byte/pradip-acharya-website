// lib/sanitize.ts
// Input sanitization helpers for PostgREST queries and file operations.

/**
 * Sanitize user input for use in PostgREST .or() filters.
 * Escapes characters that could alter the filter expression.
 */
export function sanitizePostgREST(input: string): string {
  return input
    .replace(/%/g, "%25")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/,/g, "%2C")
}
