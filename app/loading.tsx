export default function Loading() {
  return (
    <div className="container section-padding">
      <div style={{ textAlign: "center", padding: "var(--sp-16) 0" }}>
        <div className="skeleton" style={{ width: 200, height: 32, margin: "0 auto var(--sp-4)" }} />
        <div className="skeleton" style={{ width: 300, height: 20, margin: "0 auto var(--sp-3)" }} />
        <div className="skeleton" style={{ width: 250, height: 20, margin: "0 auto" }} />
      </div>
    </div>
  )
}
