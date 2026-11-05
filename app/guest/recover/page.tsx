import SeoNoindex from "@/components/SeoNoindex"
import GuestRecoverForm from "@/components/GuestRecoverForm"

export const dynamic = "force-dynamic"

export const metadata = {
  robots: { index: false, follow: false },
}

export default function GuestRecoverPage() {
  return (
    <div className="container section-padding">
      <SeoNoindex />
      <div className="page-header">
        <h1>ডাউনলোড লিংক পুনরুদ্ধার</h1>
      </div>
      <p style={{ color: "var(--stone)", marginBottom: "var(--sp-4)" }}>
        অর্ডারের সময় ব্যবহৃত ইমেইল দিন। যদি সেই ইমেইলে কোনো পরিশোধিত অর্ডার থাকে, আমরা ডাউনলোড লিংক পাঠাবো।
      </p>
      <GuestRecoverForm />
    </div>
  )
}