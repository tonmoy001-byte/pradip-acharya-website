"use client"

import PostForm from "@/components/admin/PostForm"

export default function AdminPostNewPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">নতুন পোস্ট লিখুন</h1>
      </div>
      <PostForm mode="create" />
    </div>
  )
}
