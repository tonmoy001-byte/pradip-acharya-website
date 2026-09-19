import Link from "next/link"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "ব্লগ — প্রদীপ কুমার আচার্য্য",
  description: "প্রদীপ কুমার আচার্য্যের ব্লগ ও লেখালেখি।",
}

async function getPosts() {
  try {
    const base = process.env.NEXT_PUBLIC_INSFORGE_URL!
    const key = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!
    const res = await fetch(`${base}/rest/v1/posts?status=eq.published&order=published_at.desc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 60 },
    })
    return res.ok ? await res.json() : []
  } catch {
    return []
  }
}

export default async function BlogPage() {
  const posts = await getPosts()

  return (
    <main style={{ minHeight: "100vh", paddingTop: "var(--sp-16)" }}>
      <div className="container" style={{ maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ marginBottom: "var(--sp-2)" }}>ব্লগ</h1>
        <p style={{ color: "var(--ink-muted)", marginBottom: "var(--sp-8)", fontSize: "1.0625rem" }}>
          সাহিত্য, চিন্তা ও জীবনের ছোঁয়াচে লেখালেখি।
        </p>

        {posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "var(--sp-16) 0" }}>
            <p style={{ color: "var(--ink-muted)", fontSize: "1.0625rem" }}>
              এখনো কোনো পোস্ট প্রকাশিত হয়নি।
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
            {posts.map((post: any) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                style={{
                  display: "block",
                  padding: "var(--sp-6)",
                  background: "var(--white)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "box-shadow 0.2s",
                }}
              >
                <h2 style={{ fontSize: "1.25rem", marginBottom: "var(--sp-2)" }}>{post.title}</h2>
                {post.excerpt && (
                  <p style={{ color: "var(--ink-muted)", marginBottom: "var(--sp-3)", lineHeight: 1.6 }}>
                    {post.excerpt}
                  </p>
                )}
                <div style={{ display: "flex", gap: "var(--sp-4)", fontSize: "0.8125rem", color: "var(--ink-muted)" }}>
                  {post.published_at && (
                    <span>
                      {new Date(post.published_at).toLocaleDateString("bn-BD", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  )}
                  <span>{post.author_name}</span>
                </div>
                {post.tags && post.tags.length > 0 && (
                  <div style={{ display: "flex", gap: "var(--sp-2)", marginTop: "var(--sp-3)", flexWrap: "wrap" }}>
                    {post.tags.map((tag: string) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: "0.75rem",
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "var(--bg-alt)",
                          color: "var(--stone)",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
