import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { createServerClient } from "@/lib/insforge-server"
import { EBOOK_DELIVERY_TYPE } from "@/lib/data"

export async function GET() {
  try {
    await requireAdmin()
    const client = await createServerClient()

    const [ordersRes, booksRes, postsRes, customersRes] = await Promise.all([
      client.database.from("orders").select("id, payment_status, fulfillment_status, total, created_at"),
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

    // Digital-only: "pending" work means paid ebook lines without a download grant.
    const paidOrderIds = orders
      .filter((o: any) => o.payment_status === "paid")
      .map((o: any) => o.id)

    let pendingDownloads = 0
    if (paidOrderIds.length > 0) {
      const { data: digitalItems } = await client.database
        .from("order_items")
        .select("id")
        .eq("delivery_type_snapshot", EBOOK_DELIVERY_TYPE)
        .in("order_id", paidOrderIds)

      const digitalItemIds = (digitalItems || []).map((i: any) => i.id)
      if (digitalItemIds.length > 0) {
        const { data: grants } = await client.database
          .from("download_grants")
          .select("order_item_id")
          .in("order_item_id", digitalItemIds)
        const granted = new Set((grants || []).map((g: any) => g.order_item_id))
        pendingDownloads = digitalItemIds.filter((id) => !granted.has(id)).length
      }
    }

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
      pendingDownloads,
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
