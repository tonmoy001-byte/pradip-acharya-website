// lib/orders.ts
// Demo order creation seam. Future backend swap point.
// SAFETY: Card fields must NEVER be stored here or anywhere.

import type { BookFormatName } from "./data"

export interface CartItem {
  bookId: string
  title: string
  author: string
  price: number
  format: BookFormatName
  quantity: number
  image: string
}

export interface OrderConfirmation {
  orderId: string
  items: CartItem[]
  total: number
  shippingAddress: string
  placedAt: string
}

function generateOrderId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = "ORD-"
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export async function createDemoOrder(payload: {
  contact: { name: string; email: string; phone: string }
  shipping: { address: string; city: string; zip: string; country: string }
  items: CartItem[]
  total: number
}): Promise<OrderConfirmation> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  return {
    orderId: generateOrderId(),
    items: payload.items,
    total: payload.total,
    shippingAddress: `${payload.shipping.address}, ${payload.shipping.city} ${payload.shipping.zip}, ${payload.shipping.country}`,
    placedAt: new Date().toISOString(),
  }
}
