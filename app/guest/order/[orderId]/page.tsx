// app/guest/order/[orderId]/page.tsx
// Server-rendered guest order page. The browser sends only the httpOnly
// `go_<order>` cookie; the service-only get_guest_order() RPC authorizes the
// token and returns the order + grant ids. No guest RPC is callable from the
// browser.

import Link from "next/link"
import { cookies } from "next/headers"
import GuestRecoverForm from "@/components/GuestRecoverForm"
import { createServiceClient } from "@/lib/insforge-service"
import { sha256hex } from "@/lib/guest-token"
import { money } from "@/lib/format"
import SeoNoindex from "@/components/SeoNoindex"

export const dynamic = "force-dynamic"

export const metadata = {
  robots: { index: false, follow: false },
}

interface GuestOrder {
  order_id: string
  payment_status: string
  total: number
  currency: string
  items: Array<{ title: string; grant_id: string | null }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

const DL_ERROR_MESSAGES: Record<string, string> = {
  not_found: "ডাউনলোড লিংকটি অবৈধ অথবা এই অর্ডারের সাথে মিলছে না।",
  no_file: "এই অর্ডারের জন্য কোনো ফাইল পাওয়া যায়নি। সহায়তার জন্য যোগাযোগ করুন।",
  storage: "ফাইলটি এখন পাওয়া যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      style={{
        padding: "var(--sp-3) var(--sp-4)",
        marginBottom: "var(--sp-4)",
        background: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: "var(--radius)",
        color: "#991b1b",
        fontSize: "0.875rem",
      }}
    >
      {children}
    </div>
  )
}

export default async function GuestOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { orderId } = await params
  const sp = await searchParams
  const invalid = sp.invalid === "1"
  const dlError = typeof sp.dl_error === "string" ? sp.dl_error : ""

  const token = (await cookies()).get(`go_${orderId}`)?.value

  let order: GuestOrder | null = null
  if (token && UUID_RE.test(orderId) && TOKEN_RE.test(token)) {
    const service = createServiceClient()
    const { data, error } = await service.database.rpc("get_guest_order", {
      p_order_id: orderId,
      p_token_hash: sha256hex(token),
    })
    if (!error && data) order = data as GuestOrder
  }

  if (!order) {
    return (
      <div className="container section-padding">
        <SeoNoindex />
        <div className="page-header">
          <h1>আপনার ইবুক</h1>
        </div>
        <Notice>
          {invalid
            ? "লিংকটি অবৈধ অথবা মেয়াদোত্তীর্ণ। ইমেইলের সর্বশেষ লিংকটি আবার খুলুন।"
            : "এই অর্ডারটি দেখতে ইমেইলের ডাউনলোড লিংকটি ব্যবহার করুন।"}
        </Notice>
        <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
          সমস্যা থাকলে অর্ডার আইডি ও পেমেন্টের তথ্য নিয়ে যোগাযোগ করুন।
        </p>
        <div style={{ marginTop: "var(--sp-4)", maxWidth: "420px" }}>
          <GuestRecoverForm />
        </div>
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          <Link href="/contact" className="btn btn-primary">
            সহায়তা
          </Link>
          <Link href="/books" className="btn btn-secondary">
            সব বই দেখুন
          </Link>
        </div>
      </div>
    )
  }

  const paid = order.payment_status === "paid"

  return (
    <div className="container section-padding">
      <SeoNoindex />
      <div className="page-header">
        <h1>আপনার ইবুক</h1>
      </div>

      {dlError && DL_ERROR_MESSAGES[dlError] && <Notice>{DL_ERROR_MESSAGES[dlError]}</Notice>}

      <p style={{ color: "var(--stone)", marginBottom: "var(--sp-2)" }}>
        অর্ডার আইডি:{" "}
        <span style={{ fontFamily: "monospace", fontSize: "0.8125rem" }}>{order.order_id}</span>
      </p>
      <p style={{ color: "var(--stone)", marginBottom: "var(--sp-6)" }}>
        মোট: {money(Number(order.total) || 0)}
      </p>

      {!paid ? (
        <div
          style={{
            padding: "var(--sp-6)",
            background: "#fefce8",
            border: "1px solid #fde047",
            borderRadius: "var(--radius-lg)",
            marginBottom: "var(--sp-6)",
          }}
        >
          <h2 style={{ marginBottom: "var(--sp-2)" }}>পেমেন্ট এখনও নিশ্চিত হয়নি</h2>
          <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
            ব্যাংক/QR পেমেন্ট নিশ্চিত হতে কিছু সময় লাগতে পারে। নিশ্চিত হলে এই পাতাটি রিফ্রেশ করুন।
          </p>
          <Link href={`/guest/order/${order.order_id}`} className="btn btn-primary">
            রিফ্রেশ করুন
          </Link>
        </div>
      ) : order.items.length === 0 ? (
        <Notice>এই অর্ডারে কোনো ডিজিটাল বই নেই। সহায়তার জন্য যোগাযোগ করুন।</Notice>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {order.items.map((item, index) => (
            <div
              key={`${item.title}-${index}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--sp-4)",
                flexWrap: "wrap",
                padding: "var(--sp-4)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface, #fff)",
              }}
            >
              <span style={{ fontWeight: 600 }}>{item.title}</span>
              {item.grant_id ? (
                <a
                  className="btn btn-primary"
                  href={`/api/guest-downloads/${item.grant_id}?order_id=${encodeURIComponent(order.order_id)}`}
                >
                  PDF ডাউনলোড
                </a>
              ) : (
                <span style={{ color: "var(--stone)", fontSize: "0.875rem" }}>
                  ফাইল প্রস্তুত হচ্ছে…
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <p style={{ color: "var(--stone)", fontSize: "0.875rem", marginTop: "var(--sp-6)" }}>
        ডাউনলোডের কোনো মেয়াদ বা সীমা নেই। লিংকটি অন্য কারও সাথে শেয়ার করবেন না।
      </p>
    </div>
  )
}
