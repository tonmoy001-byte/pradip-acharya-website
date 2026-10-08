// lib/format.ts
// Money formatting helper using Bengali numerals.

const BENGALI_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"]

function toBengaliDigits(n: number): string {
  return n.toString().replace(/\d/g, (d) => BENGALI_DIGITS[parseInt(d)])
}

export function money(amount: number): string {
  return `৳ ${toBengaliDigits(amount)}`
}

/**
 * Append the Bengali genitive marker to a word: আচার্য্য → আচার্য্যের.
 *
 * This exists because the author's name comes from the database and is
 * concatenated into headings, body copy and <title> tags. Writing `{author}এর`
 * produced আচার্য্যএর, which is wrong: আচার্য্য ends in ya-phala, a consonant
 * sound, so the marker attaches as ের — not as the separate postposition এর.
 *
 * Three endings, three forms:
 *   consonant sound   বাংলাদেশ → বাংলাদেশের   (কার attaches)
 *   vowel kar         কবি → কবির, নদী → নদীর   (no kar; just র)
 *   diphthong         বই → বইয়ের              (separate য়ের postposition)
 */
const VOWEL_KARS = new Set(["া", "ি", "ী", "ু", "ূ", "ে", "ো", "ৌ", "ৗ"])

export function possessive(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return trimmed

  const last = trimmed[trimmed.length - 1]

  // ই and ঈ close a diphthong, the one ending that reads wrongly with a bare
  // র and takes the separate postposition instead.
  if (last === "ই" || last === "ঈ") return `${trimmed}য়ের`

  // Already ends in a vowel kar, so attaching the kar would double it.
  if (VOWEL_KARS.has(last)) return `${trimmed}র`

  // Consonant sound, including ya-phala: বাংলাদেশের, আচার্য্যের.
  return `${trimmed}ের`
}
