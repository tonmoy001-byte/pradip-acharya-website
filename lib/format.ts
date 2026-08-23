// lib/format.ts
// Money formatting helper using Bengali numerals.

import { DELIVERY_CHARGE, FREE_DELIVERY_THRESHOLD } from "./data"

const BENGALI_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"]

function toBengaliDigits(n: number): string {
  return n.toString().replace(/\d/g, (d) => BENGALI_DIGITS[parseInt(d)])
}

export function money(amount: number): string {
  return `৳ ${toBengaliDigits(amount)}`
}

export function deliveryCharge(subtotal: number): number {
  return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE
}
