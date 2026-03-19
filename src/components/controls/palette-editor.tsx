import type { PaletteColor } from "@/types/tools"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import { HexColorPicker } from "react-colorful"
import { Shuffle } from "lucide-react"

interface PaletteEditorProps {
  colors: PaletteColor[]
  onChange: (colors: PaletteColor[]) => void
  presets?: { name: string; colors: PaletteColor[] }[]
  onRandomize?: () => void
}

export function PaletteEditor({
  colors,
  onChange,
  presets,
  onRandomize,
}: PaletteEditorProps) {
  const totalWeight = colors.reduce((sum, c) => sum + c.weight, 0)

  const updateColor = (index: number, patch: Partial<PaletteColor>) => {
    const next = colors.map((c, i) => (i === index ? { ...c, ...patch } : c))
    onChange(next)
  }

  const removeColor = (index: number) => {
    if (colors.length <= 1) return
    onChange(colors.filter((_, i) => i !== index))
  }

  const addColor = () => {
    onChange([...colors, { color: "#ffffff", weight: 1 }])
  }

  return (
    <div className="flex flex-col gap-2">
      {(onRandomize || (presets && presets.length > 0)) && (
        <div className="flex flex-wrap gap-1">
          {onRandomize && (
            <Button variant="secondary" size="sm" onClick={onRandomize}>
              <Shuffle className="mr-1 h-3 w-3" />
              Random
            </Button>
          )}
          {presets?.map((preset) => (
            <Button
              key={preset.name}
              variant="secondary"
              size="sm"
              onClick={() => onChange(preset.colors)}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      )}
      {colors.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-border-control"
                style={{ backgroundColor: entry.color }}
              />
            </PopoverTrigger>
            <PopoverContent className="flex w-auto flex-col gap-2">
              <HexColorPicker color={entry.color} onChange={(color) => updateColor(i, { color })} />
              <input
                type="text"
                value={entry.color}
                onChange={(e) => {
                  const v = e.target.value
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) updateColor(i, { color: v })
                }}
                className="h-7 w-full rounded-md border border-border-control bg-control-bg px-2 font-mono text-xs text-text-primary focus:outline-none"
              />
            </PopoverContent>
          </Popover>
          <div className="flex-1">
            <Slider
              value={[entry.weight]}
              min={0}
              max={10}
              step={0.1}
              onValueChange={([w]) => updateColor(i, { weight: w })}
            />
          </div>
          <span className="w-7 shrink-0 text-right font-mono text-2xs tabular-nums text-text-tertiary">
            {totalWeight > 0
              ? Math.round((entry.weight / totalWeight) * 100)
              : 0}
            %
          </span>
          {colors.length > 1 && (
            <button
              onClick={() => removeColor(i)}
              className="shrink-0 cursor-pointer text-2xs text-text-tertiary hover:text-text-secondary"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={addColor}>
        Add color
      </Button>
    </div>
  )
}
