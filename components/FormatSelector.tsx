"use client"

import type { BookFormat, BookFormatName } from "@/lib/data"
import { money } from "@/lib/format"

interface FormatSelectorProps {
  formats: BookFormat[]
  selected: BookFormatName
  onSelect: (format: BookFormatName) => void
}

export default function FormatSelector({ formats, selected, onSelect }: FormatSelectorProps) {
  return (
    <div className="format-selector" role="radiogroup" aria-label="বইয়ের ফরম্যাট">
      {formats.map((f) => (
        <button
          key={f.name}
          role="radio"
          aria-checked={selected === f.name}
          disabled={!f.available}
          className={`format-option ${selected === f.name ? "active" : ""} ${!f.available ? "disabled" : ""}`}
          onClick={() => onSelect(f.name)}
        >
          {f.name} — {money(f.price)}
        </button>
      ))}
    </div>
  )
}
