import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

async function getPost(slug: string) {
  try {
    const base = process.env.NEXT_PUBLIC_INSFORGE_URL!
    const key = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!
    const res = await fetch(
      `${base}/rest/v1/posts?slug=eq.${slug}&status=eq.published&select=*`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    )
    if (!res.ok) return null
    const posts = await res.json()
    return posts[0] || null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: "পোস্ট পাওয়া যায়নি" }
  return {
    title: `${post.title} — প্রদীপ কুমার আচার্য্য`,
    description: post.meta_description || post.excerpt || post.title,
    openGraph: {
      title: post.title,
      description: post.excerpt || post.title,
      type: "article",
    },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)

  if (!post) {
    notFound()
  }

  return (
    <main style={{ minHeight: "100vh", paddingTop: "var(--sp-16)" }}>
      <article className="container" style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link
          href="/blog"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--sp-2)",
            color: "var(--terracotta)",
            textDecoration: "none",
            fontSize: "0.875rem",
            marginBottom: "var(--sp-6)",
          }}
        >
          ← ব্লগে ফিরে যান
        </Link>

        <header style={{ marginBottom: "var(--sp-8)" }}>
          <h1 style={{ marginBottom: "var(--sp-3)" }}>{post.title}</h1>
          <div style={{ display: "flex", gap: "var(--sp-4)", color: "var(--ink-muted)", fontSize: "0.875rem" }}>
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
        </header>

        <div
          style={{
            fontSize: "1.0625rem",
            lineHeight: 1.85,
            color: "var(--ink)",
          }}
          dangerouslySetInnerHTML={{ __html: post.content || "" }}
        />

        <footer style={{ marginTop: "var(--sp-12)", paddingTop: "var(--sp-6)", borderTop: "1px solid var(--border)" }}>
          <Link
            href="/blog"
            style={{
              color: "var(--terracotta)",
              textDecoration: "none",
              fontSize: "0.875rem",
            }}
          >
            ← সকল পোস্ট দেখুন
          </Link>
        </footer>
      </article>
    </main>
  )
}
