// lib/guest-delivery.ts
// Email delivery for guest orders, guarded by a short lease so the verify and
// webhook settlement paths never send the same email twice and a failed send
// can be retried.
//
// Server-only. The caller passes the service client (project_admin) that has
// already settled the order; every RPC here is service-only.

interface DeliveryOrder {
  id: string
  contact?: { email?: string | null } | null
}

function siteBaseUrl(): string {
  const raw = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim()
  if (!raw) throw new Error("site url not configured")
  return raw.replace(/\/+$/, "")
}

export function guestExchangeUrl(orderId: string, token: string): string {
  return `${siteBaseUrl()}/api/guest/exchange?order_id=${encodeURIComponent(orderId)}&t=${encodeURIComponent(token)}`
}

/**
 * Claim the delivery lease, send the link, then mark it sent. On any failure
 * the lease is released so a later settlement retry can deliver.
 *
 * Returns true only when this call sent the email.
 */
export async function deliverGuestOrderEmail(
  client: any,
  order: DeliveryOrder,
): Promise<boolean> {
  const email =
    typeof order.contact?.email === "string" ? order.contact.email.trim() : ""
  if (!email) return false

  const { newToken, sha256hex } = await import("./guest-token")
  const token = newToken()
  const hash = sha256hex(token)

  const { data: claimed, error: claimError } = await client.database.rpc(
    "claim_guest_delivery_email",
    { p_order_id: order.id, p_email_token_hash: hash },
  )
  if (claimError) {
    console.error("[guest] delivery claim failed", { order_id: order.id })
    return false
  }
  if (claimed !== true) return false

  let link: string
  try {
    link = guestExchangeUrl(order.id, token)
  } catch (err) {
    console.error("[guest] site url missing for delivery", {
      order_id: order.id,
      message: err instanceof Error ? err.message : "unknown",
    })
    await client.database.rpc("release_guest_delivery_email", {
      p_order_id: order.id,
      p_email_token_hash: hash,
    })
    return false
  }

  try {
    const { sendDownloadEmail } = await import("./email")
    await sendDownloadEmail(email, link)
  } catch (err) {
    console.error("[guest] download email failed", {
      order_id: order.id,
      message: err instanceof Error ? err.message : "unknown",
    })
    await client.database.rpc("release_guest_delivery_email", {
      p_order_id: order.id,
      p_email_token_hash: hash,
    })
    return false
  }

  const { error: markError } = await client.database.rpc(
    "mark_guest_delivery_sent",
    { p_order_id: order.id, p_email_token_hash: hash },
  )
  if (markError) {
    console.error("[guest] delivery mark failed", { order_id: order.id })
  }
  return true
}
