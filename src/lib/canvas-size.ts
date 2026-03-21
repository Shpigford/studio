export type CanvasPreset = 'square' | 'landscape' | 'wide' | 'portrait' | 'tall' | 'custom'

export const CANVAS_PRESETS: Record<Exclude<CanvasPreset, 'custom'>, [number, number]> = {
  square:    [2048, 2048],
  landscape: [2048, 1536],
  wide:      [3840, 2160],
  portrait:  [1536, 2048],
  tall:      [2160, 3840],
}

export const CANVAS_PRESET_OPTIONS: { value: string; label: string }[] = [
  { value: 'square',    label: 'Square (1:1)' },
  { value: 'landscape', label: 'Landscape (4:3)' },
  { value: 'wide',      label: 'Wide (16:9)' },
  { value: 'portrait',  label: 'Portrait (3:4)' },
  { value: 'tall',      label: 'Tall (9:16)' },
  { value: 'custom',    label: 'Custom' },
]

export function resolveCanvasSize(
  preset: CanvasPreset,
  customWidth: number,
  customHeight: number,
): [number, number] {
  if (preset === 'custom') return [customWidth, customHeight]
  return CANVAS_PRESETS[preset]
}
