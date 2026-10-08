import Link from "next/link"

interface BuyNowButtonProps {
  bookId: string
  title: string
  /** False disables the link with a "sold out" affordance. */
  available?: boolean
  label?: string
  unavailableLabel?: string
  className?: string
  style?: React.CSSProperties
}

/**
 * Buy-now link for a single-title catalog.
 *
 * There is no cart and no quantity picker: a customer buys the one ebook, so
 * the link always points at a single copy. The book is identified in the
 * checkout URL and the order is created from that reference, so nothing is
 * written to the cart or to localStorage on the way to payment.
 */
export default function BuyNowButton({
  bookId,
  title,
  available = true,
  label = "এখনই কিনুন",
  unavailableLabel = "স্টকে নেই",
  className = "btn btn-primary",
  style,
}: BuyNowButtonProps) {
  if (!available) {
    return (
      <span
        className={className}
        style={{ ...style, cursor: "not-allowed", opacity: 0.6 }}
        aria-disabled="true"
        title={`${title} — স্টকে নেই`}
      >
        {unavailableLabel}
      </span>
    )
  }

  return (
    <Link
      href={`/checkout?book=${encodeURIComponent(bookId)}`}
      className={className}
      style={style}
      aria-label={`${title} — চেকআউটে যান`}
    >
      {label}
    </Link>
  )
}
