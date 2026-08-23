"use client"

import Link from "next/link"
import { useCart } from "@/lib/store"
import { money, deliveryCharge } from "@/lib/format"

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, subtotal } = useCart()
  const delivery = deliveryCharge(subtotal)
  const total = subtotal + delivery

  if (items.length === 0) {
    return (
      <div className="container section-padding">
        <div className="cart-empty">
          <h1>কার্ট</h1>
          <p style={{ marginBottom: "var(--sp-6)" }}>আপনার কার্টে কোনো আইটেম নেই।</p>
          <Link href="/books" className="btn btn-primary">সকল বই দেখুন</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container section-padding">
      <div className="page-header">
        <h1>কার্ট</h1>
      </div>

      <div className="cart-page">
        <div>
          {items.map((item) => (
            <div key={`${item.bookId}-${item.format}`} className="cart-item">
              <img src={item.image} alt={item.title} className="cart-item-image" />
              <div className="cart-item-info">
                <h3 className="cart-item-title">{item.title}</h3>
                <p className="cart-item-format">{item.format}</p>
                <p className="cart-item-price">{money(item.price)}</p>
                <div className="cart-item-actions">
                  <div className="qty-stepper">
                    <button
                      className="qty-btn"
                      onClick={() => updateQuantity(item.bookId, item.format, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      −
                    </button>
                    <span className="qty-value">{item.quantity}</span>
                    <button
                      className="qty-btn"
                      onClick={() => updateQuantity(item.bookId, item.format, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <button
                    className="btn btn-ghost"
                    onClick={() => removeFromCart(item.bookId, item.format)}
                    style={{ fontSize: "0.8125rem" }}
                  >
                    সরান
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="cart-summary">
          <h2>অর্ডার সারসংক্ষেপ</h2>
          <div className="cart-summary-row">
            <span>সাবটোটাল</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="cart-summary-row">
            <span>ডেলিভারি</span>
            <span>{delivery === 0 ? "বিনামূল্যে" : money(delivery)}</span>
          </div>
          <div className="cart-summary-total">
            <span>মোট</span>
            <span>{money(total)}</span>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--stone)", marginTop: "var(--sp-3)" }}>
            ৭৫০ টাকার বেশি অর্ডারে বিনামূল্যে ডেলিভারি।
          </p>
          <Link href="/checkout" className="btn btn-primary" style={{ width: "100%", marginTop: "var(--sp-4)" }}>
            চেকআউটে যান
          </Link>
        </div>
      </div>
    </div>
  )
}
