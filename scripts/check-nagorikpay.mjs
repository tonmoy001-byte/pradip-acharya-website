// scripts/check-nagorikpay.mjs
// Creates ONE pending payment session and probes its URL server-side.
// Usage (PowerShell):
//   $env:NAGORIKPAY_API_KEY="..." ; $env:SITE_URL="https://pradipbooks.insforge.site" ; node scripts/check-nagorikpay.mjs
//
// WARNING: This creates a real (unpaid, pending) payment session in LIVE mode.
// Do not run casually. The API key is never printed.

const key = process.env.NAGORIKPAY_API_KEY
const site = (process.env.SITE_URL || "").replace(/\/$/, "")
const base = process.env.NAGORIKPAY_BASE_URL || "https://secure-pay.nagorikpay.com/api/payment"

if (!key || !site) {
  console.error("Set NAGORIKPAY_API_KEY and SITE_URL")
  process.exit(1)
}

const res = await fetch(`${base}/create`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "API-KEY": key },
  body: JSON.stringify({
    cus_name: "Diagnostic Test",
    cus_email: "diagnostic@example.com",
    amount: "10",
    success_url: `${site}/payment/success`,
    cancel_url: `${site}/payment/cancel`,
    webhook_url: `${site}/api/payment/webhook`,
    metadata: { diagnostic: true },
  }),
})

const text = await res.text()
let data
try {
  data = JSON.parse(text)
} catch {
  data = null
}

console.log("create:", res.status, data ? { status: data.status, message: data.message } : text.slice(0, 200))

if (!data?.payment_url) process.exit(2)

const u = new URL(data.payment_url)
const probe = await fetch(data.payment_url, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0" } })

console.log("payment_url host:", u.host)
console.log("probe status:", probe.status, "server:", probe.headers.get("server"))

console.log(
  probe.status === 403
    ? "=> The gateway page itself returns 403 even from a plain server request. Contact NagorikPay (plan/brand/domain)."
    : "=> The page responds from a plain server request. If your browser still shows 403, check extensions/VPN/network.",
)