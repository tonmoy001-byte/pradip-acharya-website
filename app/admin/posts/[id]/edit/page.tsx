"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import PostForm from "@/components/admin/PostForm"

interface PostData {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string
  cover_image: string | null
  post_type: string
  status: string
  tags: string[]
  meta_title: string
  meta_description: string
}

export default function AdminPostEditPage() {
  const { id } = useParams()
  const router = useRouter()
  const [post, setPost] = useState<PostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/admin/posts/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found")
        return r.json()
      })
      .then((d) => setPost(d.post))
      .catch(() => setError("পোস্ট খুঁজে পাওয়া যায়নি"))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">লোড হচ্ছে...</h1>
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">ত্রুটি</h1>
        </div>
        <p style={{ color: "var(--error)" }}>{error || "পোস্ট পাওয়া যায়নি"}</p>
        <button className="btn btn-secondary" style={{ marginTop: "var(--sp-4)" }} onClick={() => router.back()}>
          ফিরে যান
        </button>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">পোস্ট এডিট করুন</h1>
        <p className="admin-page-subtitle">{post.title}</p>
      </div>
      <PostForm
        mode="edit"
        initial={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          content: post.content,
          excerpt: post.excerpt,
          cover_image: post.cover_image,
          post_type: post.post_type,
          status: post.status,
          tags: post.tags || [],
          meta_title: post.meta_title || "",
          meta_description: post.meta_description || "",
        }}
      />
    </div>
  )
}
