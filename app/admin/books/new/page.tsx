"use client"

import BookForm from "@/components/admin/BookForm"

export default function AdminBookNewPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">নতুন বই যোগ করুন</h1>
      </div>
      <BookForm mode="create" />
    </div>
  )
}
