"use client"

import { useState } from "react"

interface PasswordInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  minLength?: number
  required?: boolean
  className?: string
  style?: React.CSSProperties
}

export default function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  minLength,
  required,
  className = "form-input",
  style,
}: PasswordInputProps) {
  const [show, setShow] = useState(false)

  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        type={show ? "text" : "password"}
        className={className}
        style={{ width: "100%", paddingRight: "2.5rem", ...style }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
        style={{
          position: "absolute",
          right: "0.5rem",
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "1rem",
          lineHeight: 1,
          padding: 0,
        }}
      >
        {show ? "🙈" : "👁️"}
      </button>
    </div>
  )
}
