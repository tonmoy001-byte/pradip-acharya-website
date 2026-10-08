import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getCachedPostBySlug } from "@/lib/public-cache"
import { pageMetadata } from "@/lib/seo"
import { articleGraph } from "@/lib/structured-data"
import JsonLd from "@/components/JsonLd"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getCachedPostBySlug(slug)
  if (!post) return { title: "পোস্ট পাওয়া যায়নি" }
  // pageMetadata supplies the self-referencing canonical and absolute
  // og:image this page was previously missing entirely.
  return pageMetadata({
    title: post.title,
    description: post.meta_description || post.excerpt || post.title,
    path: `/blog/${slug}`,
    type: "article",
  })
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getCachedPostBySlug(slug)

  if (!post) {
    notFound()
  }

  return (
    <main style={{ minHeight: "100vh", paddingTop: "var(--sp-16)" }}>
      <JsonLd
        data={articleGraph({
          title: post.title,
          slug,
          excerpt: post.excerpt || post.meta_description || undefined,
          publishedAt: post.published_at || undefined,
          authorName: post.author_name || undefined,
        })}
      />
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
