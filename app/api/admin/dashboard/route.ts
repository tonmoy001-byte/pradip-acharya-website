import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"

export async function GET() {
  try {
    await requireAdmin()
    const client = await createServerClient()

    const [ordersRes, booksRes, postsRes, customersRes] = await Promise.all([
      client.database.from("orders").select("id, payment_status, fulfillment_status, total"),
      client.database.from("books").select("id"),
      client.database.from("posts").select("id, title, slug, post_type, status, created_at"),
      client.database.from("profiles").select("user_id"),
    ])

    const orders = ordersRes.data || []
    const totalOrders = orders.length
    const paidOrders = orders.filter((o: any) => o.payment_status === "paid").length
    const totalRevenue = orders
      .filter((o: any) => o.payment_status === "paid")
      .reduce((sum: number, o: any) => sum + Number(o.total), 0)
    const pendingDeliveries = orders.filter(
      (o: any) => o.payment_status === "paid" && o.fulfillment_status !== "delivered"
    ).length

    const totalBooks = (booksRes.data || []).length
    const posts = postsRes.data || []
    const totalPosts = posts.length
    const totalCustomers = (customersRes.data || []).length

    const recentOrders = orders
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)

    const recentPosts = posts
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)

    return NextResponse.json({
      totalOrders,
      paidOrders,
      totalRevenue,
      pendingDeliveries,
      totalBooks,
      totalPosts,
      totalCustomers,
      recentOrders,
      recentPosts,
    })
  } catch (err: any) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
