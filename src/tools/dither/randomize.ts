import type { PaletteColor } from "@/types/tools"
import type { DitherSettings } from "./types"

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

export function createRandomPalette(): PaletteColor[] {
  const numColors = Math.floor(Math.random() * 4) + 2
  const baseHue = Math.random() * 360
  const r = Math.random()

  let hues: number[]
  if (r < 0.3) {
    hues = Array.from(
      { length: numColors },
      () => (baseHue + (Math.random() - 0.5) * 60) % 360,
    )
  } else if (r < 0.55) {
    hues = Array.from(
      { length: numColors },
      (_, i) =>
        (baseHue + (i % 2 === 0 ? 0 : 180) + (Math.random() - 0.5) * 30) % 360,
    )
  } else if (r < 0.75) {
    hues = Array.from(
      { length: numColors },
      (_, i) => (baseHue + (i % 3) * 120 + (Math.random() - 0.5) * 20) % 360,
    )
  } else if (r < 0.9) {
    const offsets = [0, 150, 210]
    hues = Array.from(
      { length: numColors },
      (_, i) => (baseHue + offsets[i % 3] + (Math.random() - 0.5) * 20) % 360,
    )
  } else {
    hues = Array.from({ length: numColors }, () => Math.random() * 360)
  }

  const lightStep = 55 / Math.max(numColors - 1, 1)
  return hues.map((hue, i) => {
    const sat = Math.floor(Math.random() * 40 + 50)
    const light = Math.floor(15 + i * lightStep + (Math.random() - 0.5) * 10)
    return {
      color: hslToHex((hue + 360) % 360, sat, Math.max(10, Math.min(70, light))),
      weight: 1,
    }
  })
}

export function createRandomSettingsPatch(): Partial<DitherSettings> {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

  const gradientTypes: DitherSettings["gradientType"][] = [
    "linear",
    "radial",
    "conic",
    "noise",
  ]
  const patterns: DitherSettings["pattern"][] = [
    "bayer2",
    "bayer4",
    "bayer8",
    "halftone",
    "lines",
    "crosses",
    "dots",
    "grid",
    "scales",
  ]
  const ditherModes: DitherSettings["ditherMode"][] = [
    "image",
    "linear",
    "radial",
  ]
  const ditherStyles: DitherSettings["ditherStyle"][] = [
    "threshold",
    "scaled",
  ]
  const shapeTypes: DitherSettings["shapeType"][] = [
    "circle",
    "square",
    "diamond",
  ]

  return {
    gradientType: pick(gradientTypes),
    gradientAngle: Math.floor(Math.random() * 360),
    pattern: pick(patterns),
    ditherMode: pick(ditherModes),
    ditherStyle: pick(ditherStyles),
    shapeType: pick(shapeTypes),
    cellSize: Math.floor(Math.random() * 24) + 2,
    angle: Math.floor(Math.random() * 360),
    scale: Math.floor(Math.random() * 150) + 20,
    offsetX: Math.floor(Math.random() * 200) - 100,
    offsetY: Math.floor(Math.random() * 200) - 100,
    colors: createRandomPalette(),
  }
}
