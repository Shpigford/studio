import type { CanvasPreset } from "@/lib/canvas-size"

export type MarbleSettings = {
  canvasPreset: CanvasPreset
  customWidth: number
  customHeight: number
  colorMain: string
  colorLow: string
  colorMid: string
  colorHigh: string
  noiseScale: number
  windSpeed: number
  warpPower: number
  fbmStrength: number
  fbmDamping: number
  animated: boolean
  speed: number
  watercolorDetail: number
  watercolorWarp: number
  blurRadius: number
  grain: number
  veinIntensity: number
  veinScale: number
  veinColor: string
}

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

export function randomizeColors(): {
  colorMain: string
  colorLow: string
  colorMid: string
  colorHigh: string
} {
  const baseHue = Math.random() * 360
  const sat = Math.random() * 40 + 60
  return {
    colorMain: hslToHex(baseHue, sat, Math.random() * 20 + 70),
    colorLow: hslToHex((baseHue + Math.random() * 30 - 15) % 360, sat, Math.random() * 30 + 40),
    colorMid: hslToHex((baseHue + 120 + Math.random() * 30 - 15) % 360, sat, Math.random() * 20 + 50),
    colorHigh: hslToHex((baseHue + 240 + Math.random() * 30 - 15) % 360, Math.random() * 20 + 10, Math.random() * 15 + 85),
  }
}

export const DEFAULTS: MarbleSettings = {
  canvasPreset: "square",
  customWidth: 800,
  customHeight: 800,
  ...randomizeColors(),
  noiseScale: 1.25,
  windSpeed: 0.12,
  warpPower: 0.35,
  fbmStrength: 1.2,
  fbmDamping: 0.55,
  animated: false,
  speed: 1.0,
  watercolorDetail: 18.0,
  watercolorWarp: 0.02,
  blurRadius: 1.0,
  grain: 0,
  veinIntensity: 0,
  veinScale: 3.0,
  veinColor: "#1a1a2e",
}
