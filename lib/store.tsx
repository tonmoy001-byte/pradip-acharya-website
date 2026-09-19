"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react"
import type { BookFormatName } from "./data"
import { useAuth } from "./auth"

export interface CartItem {
  bookId: string
  title: string
  author: string
  price: number
  format: BookFormatName
  quantity: number
  image: string
}

interface CartContextType {
  items: CartItem[]
  addToCart: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void
  removeFromCart: (bookId: string, format: BookFormatName) => void
  updateQuantity: (bookId: string, format: BookFormatName, quantity: number) => void
  clearCart: () => void
  itemCount: number
  subtotal: number
}

const CartContext = createContext<CartContextType | null>(null)

function cartKey(userId?: string | null): string {
  return userId ? `bookstore-cart-${userId}` : "bookstore-cart-guest"
}

function getCartFromStorage(key: string): CartItem[] {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveCartToStorage(key: string, items: CartItem[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(items))
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [items, setItems] = useState<CartItem[]>([])
  const [mounted, setMounted] = useState(false)
  const prevUserId = useRef<string | null | undefined>(undefined)

  // Read localStorage after mount to avoid SSR hydration mismatch
  useEffect(() => {
    setItems(getCartFromStorage(cartKey(user?.id)))
    setMounted(true)
  }, [])

  // When user changes (login/logout), reload cart from the correct key
  useEffect(() => {
    if (!mounted) return
    if (prevUserId.current === user?.id) return
    prevUserId.current = user?.id
    setItems(getCartFromStorage(cartKey(user?.id)))
  }, [user?.id, mounted])

  useEffect(() => {
    if (mounted) {
      saveCartToStorage(cartKey(user?.id), items)
    }
  }, [items, mounted, user?.id])

  const addToCart = useCallback(
    (item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
      setItems((prev) => {
        const existing = prev.find(
          (i) => i.bookId === item.bookId && i.format === item.format,
        )
        if (existing) {
          return prev.map((i) =>
            i.bookId === item.bookId && i.format === item.format
              ? { ...i, quantity: i.quantity + (item.quantity || 1) }
              : i,
          )
        }
        return [...prev, { ...item, quantity: item.quantity || 1 }]
      })
    },
    [],
  )

  const removeFromCart = useCallback((bookId: string, format: BookFormatName) => {
    setItems((prev) => prev.filter((i) => !(i.bookId === bookId && i.format === format)))
  }, [])

  const updateQuantity = useCallback(
    (bookId: string, format: BookFormatName, quantity: number) => {
      if (quantity < 1) return
      setItems((prev) =>
        prev.map((i) =>
          i.bookId === bookId && i.format === format ? { ...i, quantity } : i,
        ),
      )
    },
    [],
  )

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        itemCount,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within CartProvider")
  return ctx
}
