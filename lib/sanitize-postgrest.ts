/**
 * Sanitize input for use in a PostgREST .or() filter.
 * Escapes characters that could alter the filter expression.
 */
export function sanitizePostgREST(input: string): string {
  return input
    .replace(/%/g, "%25")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/,/g, "%2C")
}

/**
 * Quote a value for use inside a PostgREST .or()/.filter() expression.
 * A double-quoted value is treated as a literal, so commas, dots and
 * parentheses inside it cannot break out of the filter. Prefer this
 * over sanitizePostgREST() for user-typed search terms.
 */
export function quotePostgrestValue(input: string, maxLength = 100): string {
  const trimmed = input.slice(0, maxLength).replace(/[\\"]/g, "\\$&")
  return `"${trimmed}"`
}