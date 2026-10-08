export function toWhatsAppUrl(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "")
  if (digits.length < 7) return null
  let normalized: string
  if (digits.startsWith("880")) {
    normalized = digits
  } else if (digits.startsWith("0")) {
    normalized = `880${digits.slice(1)}`
  } else {
    normalized = digits
  }
  return `https://wa.me/${normalized}`
}
