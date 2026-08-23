"use client"

interface QtyStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export default function QtyStepper({ value, onChange, min = 1, max = 10 }: QtyStepperProps) {
  return (
    <div className="qty-stepper" aria-label="পরিমাণ">
      <button
        className="qty-btn"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="পরিমাণ কমান"
      >
        −
      </button>
      <span className="qty-value" aria-live="polite">{value}</span>
      <button
        className="qty-btn"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="পরিমাণ বাড়ান"
      >
        +
      </button>
    </div>
  )
}
