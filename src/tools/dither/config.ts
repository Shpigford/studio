import type { PaletteColor } from "@/types/tools"
import type { DitherSettings } from "./types"

export const GAMEBOY_PRESET: PaletteColor[] = [
  { color: "#0f380f", weight: 1 },
  { color: "#306230", weight: 1 },
  { color: "#8bac0f", weight: 1 },
  { color: "#9bbc0f", weight: 1 },
]

export const PALETTE_PRESETS: { name: string; colors: PaletteColor[] }[] = [
  {
    name: "B&W",
    colors: [
      { color: "#000000", weight: 1 },
      { color: "#ffffff", weight: 1 },
    ],
  },
  { name: "Game Boy", colors: GAMEBOY_PRESET },
  {
    name: "CGA",
    colors: [
      { color: "#000000", weight: 1 },
      { color: "#55ffff", weight: 1 },
      { color: "#ff55ff", weight: 1 },
      { color: "#ffffff", weight: 1 },
    ],
  },
  {
    name: "Sepia",
    colors: [
      { color: "#2b1d0e", weight: 1 },
      { color: "#6b4226", weight: 1 },
      { color: "#c4956a", weight: 1 },
      { color: "#f5e6c8", weight: 1 },
    ],
  },
  {
    name: "Ocean",
    colors: [
      { color: "#0a1628", weight: 1 },
      { color: "#1a4a6e", weight: 1 },
      { color: "#3a8fb7", weight: 1 },
      { color: "#a8d8ea", weight: 1 },
    ],
  },
  {
    name: "Sunset",
    colors: [
      { color: "#1a0a2e", weight: 1 },
      { color: "#8b2252", weight: 1 },
      { color: "#e85d04", weight: 1 },
      { color: "#ffd166", weight: 1 },
    ],
  },
  {
    name: "Neon",
    colors: [
      { color: "#0d0221", weight: 1 },
      { color: "#ff2a6d", weight: 1 },
      { color: "#05d9e8", weight: 1 },
      { color: "#d1f7ff", weight: 1 },
    ],
  },
  {
    name: "Earth",
    colors: [
      { color: "#2d1b00", weight: 1 },
      { color: "#6b4226", weight: 1 },
      { color: "#8b7355", weight: 1 },
      { color: "#c4a882", weight: 1 },
    ],
  },
  {
    name: "Pastel",
    colors: [
      { color: "#f8b4b4", weight: 1 },
      { color: "#b4d4f8", weight: 1 },
      { color: "#b4f8d4", weight: 1 },
      { color: "#f8e4b4", weight: 1 },
    ],
  },
]

export const DEFAULTS: DitherSettings = {
  sourceType: "gradient",
  gradientType: "linear",
  gradientAngle: 45,
  canvasPreset: "square",
  customWidth: 2048,
  customHeight: 2048,
  pattern: "bayer4",
  ditherMode: "image",
  ditherStyle: "threshold",
  shapeType: "square",
  cellSize: 8,
  angle: 45,
  scale: 100,
  offsetX: 0,
  offsetY: 0,
  colors: GAMEBOY_PRESET,
}

export const PATTERN_OPTIONS = [
  { value: "bayer2", label: "Bayer 2x2" },
  { value: "bayer4", label: "Bayer 4x4" },
  { value: "bayer8", label: "Bayer 8x8" },
  { value: "halftone", label: "Halftone" },
  { value: "lines", label: "Lines" },
  { value: "crosses", label: "Crosses" },
  { value: "dots", label: "Dots" },
  { value: "grid", label: "Grid" },
  { value: "scales", label: "Scales" },
]

