interface PaymentBadgesProps {
  /** Render the muted "পেমেন্ট পদ্ধতি" label. */
  showLabel?: boolean
  /** Dark surfaces (footer, newsletter) get the light pill variant. */
  onDark?: boolean
}

const METHODS = [
  { id: "bkash", name: "bKash", color: "#e2136e" },
  { id: "nagad", name: "Nagad", color: "#ec1c24" },
  { id: "rocket", name: "Rocket", color: "#7b3fa0" },
] as const

/**
 * Payment method badges shown next to the primary buy button and in the footer.
 *
 * Only online mobile financial services are listed: the store is digital-only
 * and settles through the online gateway, so there is no cash-on-delivery
 * option to advertise.
 */
export default function PaymentBadges({
  showLabel = true,
  onDark = false,
}: PaymentBadgesProps) {
  return (
    <div className={`payment-badges${onDark ? " payment-badges-on-dark" : ""}`}>
      {showLabel && <span className="payment-badges-label">পেমেন্ট পদ্ধতি</span>}
      {METHODS.map((method) => (
        <span key={method.id} className="payment-badge">
          <span
            className="payment-badge-dot"
            style={{ background: method.color }}
            aria-hidden="true"
          />
          {method.name}
        </span>
      ))}
    </div>
  )
}
