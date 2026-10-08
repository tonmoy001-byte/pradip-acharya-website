// lib/format.test.ts
// Guards the Bengali genitive helper.
//
// The bug this prevents is specific: author names come from the database and
// were concatenated as `{author}এর`, which renders আচার্য্যএর. আচার্য্য ends in
// ya-phala — a consonant sound — so the marker attaches directly as র.

import { describe, it, expect } from "vitest"
import { money, possessive } from "./format"

describe("money", () => {
  it("renders the taka sign with Bengali numerals", () => {
    expect(money(50)).toBe("৳ ৫০")
    expect(money(0)).toBe("৳ ০")
    expect(money(125)).toBe("৳ ১২৫")
  })
})

describe("possessive", () => {
  it("attaches র after a ya-phala ending", () => {
    // The case that was wrong on the live site.
    expect(possessive("প্রদীপ কুমার আচার্য্য")).toBe("প্রদীপ কুমার আচার্য্যের")
  })

  it("never produces the incorrect আচার্য্যএর form", () => {
    expect(possessive("প্রদীপ কুমার আচার্য্য")).not.toContain("আচার্য্যএর")
    expect(possessive("প্রদীপ কুমার আচার্য্য")).not.toContain("এর")
  })

  it("attaches ের after a consonant sound", () => {
    for (const [from, to] of [
      ["বাংলাদেশ", "বাংলাদেশের"],
      ["প্রবাহ", "প্রবাহের"],
    ] as const) {
      expect(possessive(from), from).toBe(to)
    }
  })

  it("attaches র after a vowel kar without doubling the kar", () => {
    for (const [from, to] of [
      ["কবি", "কবির"],
      ["নদী", "নদীর"],
      ["বাবা", "বাবার"],
      ["মা", "মার"],
      ["শিক্ষা", "শিক্ষার"],
    ] as const) {
      expect(possessive(from), from).toBe(to)
    }
  })

  it("uses য়ের for a diphthong ending", () => {
    expect(possessive("বই")).toBe("বইয়ের")
  })

  it("trims before inflecting", () => {
    expect(possessive("  প্রদীপ কুমার আচার্য্য  ")).toBe("প্রদীপ কুমার আচার্য্যের")
  })

  it("returns an empty string unchanged", () => {
    expect(possessive("")).toBe("")
    expect(possessive("   ")).toBe("")
  })
})