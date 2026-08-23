"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="error-page">
      <h1>কিছু ভুল হয়েছে</h1>
      <p>দুঃখিত, একটি সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।</p>
      <button className="btn btn-primary" onClick={reset}>
        আবার চেষ্টা করুন
      </button>
    </div>
  )
}
