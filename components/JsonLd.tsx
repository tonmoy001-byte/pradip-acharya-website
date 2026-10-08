// components/JsonLd.tsx
// Renders a JSON-LD block safely.
//
// JSON-LD is injected into a <script> element whose body must be raw JSON.
// React escapes `<`, `>` and `&` in children, which would corrupt the JSON, so
// the standard approach is dangerouslySetInnerHTML with a pre-serialised
// string. That is only safe because the content is produced by
// JSON.stringify — it cannot contain a closing script tag from user input
// unless a string value itself does, so the payload is additionally hardened
// against `</script>` injection below.

export default function JsonLd({ data }: { data: unknown }) {
  if (data === null || data === undefined) return null

  // `</script>` inside a JSON string terminates the script element early in the
  // HTML parser even though it is escaped JSON, so the sequence is broken up.
  // No current field can contain it, but this keeps that true by construction.
  const json = JSON.stringify(data).replace(/</g, "\\u003c")

  return (
    <script
      type="application/ld+json"
      // Serialised by JSON.stringify above; no user input reaches this string.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}