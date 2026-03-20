import { useState, useRef, useEffect } from "react"
import { normalizeSteppedValue } from "@/lib/math"
import { Slider } from "@/components/ui/slider"

interface SliderControlProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  unit?: string
  decimals?: number
}

export function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit,
  decimals = 0,
}: SliderControlProps) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function commitValue() {
    setEditing(false)
    const parsed = parseFloat(inputValue)
    if (isNaN(parsed)) return
    onChange(normalizeSteppedValue(parsed, min, max, step, decimals))
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">{label}</span>
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitValue()
              if (e.key === "Escape") setEditing(false)
            }}
            onBlur={commitValue}
            size={Math.max(inputValue.length, 1)}
            className="bg-transparent text-right font-mono text-xs tabular-nums text-text-tertiary border-b border-text-tertiary/40 outline-none selection:bg-white/20 selection:text-text-tertiary"
            style={{ width: `${Math.max(inputValue.length, 1) + 1}ch` }}
          />
        ) : (
          <span
            className="font-mono text-xs tabular-nums text-text-tertiary cursor-text"
            onClick={() => {
              setInputValue(value.toFixed(decimals))
              setEditing(true)
            }}
          >
            {value.toFixed(decimals)}
            {unit}
          </span>
        )}
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  )
}
