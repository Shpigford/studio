import { HexColorPicker } from "react-colorful"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"

interface ColorControlProps {
  label: string
  value: string
  onChange: (value: string) => void
}

export function ColorControl({ label, value, onChange }: ColorControlProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-secondary">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Pick ${label} color`}
            className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-border-control"
            style={{ backgroundColor: value }}
          />
        </PopoverTrigger>
        <PopoverContent className="flex w-auto flex-col gap-2">
          <HexColorPicker color={value} onChange={onChange} />
          <input
            type="text"
            aria-label={`${label} hex color`}
            value={value}
            onChange={(e) => {
              const v = e.target.value
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v)
            }}
            className="h-7 w-full rounded-md border border-border-control bg-control-bg px-2 font-mono text-xs text-text-primary focus:outline-none"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
