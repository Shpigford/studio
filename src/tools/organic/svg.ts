import type { OrganicSettings, OrganicGeometry } from './types'
import { hexToRgb } from '@/lib/color'

interface ParsedStop {
  r: number
  g: number
  b: number
  position: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function parseAndSortStops(settings: OrganicSettings): ParsedStop[] {
  const stops = settings.colorStops
  if (stops.length === 0) return [{ r: 255, g: 255, b: 255, position: 0 }]
  return [...stops]
    .sort((a, b) => a.position - b.position)
    .map(stop => {
      const rgb = hexToRgb(stop.color) ?? { r: 255, g: 255, b: 255 }
      return { r: rgb.r, g: rgb.g, b: rgb.b, position: stop.position }
    })
}

function lerpParsedStops(t: number, sorted: ParsedStop[]): [number, number, number] {
  if (sorted.length === 1) return [sorted[0].r, sorted[0].g, sorted[0].b]

  const pos = t * 100
  const first = sorted[0], last = sorted[sorted.length - 1]
  if (pos <= first.position) return [first.r, first.g, first.b]
  if (pos >= last.position) return [last.r, last.g, last.b]

  let lower = first, upper = last
  for (let i = 0; i < sorted.length - 1; i++) {
    if (pos >= sorted[i].position && pos <= sorted[i + 1].position) {
      lower = sorted[i]; upper = sorted[i + 1]; break
    }
  }

  const range = upper.position - lower.position
  if (range === 0) return [lower.r, lower.g, lower.b]

  const factor = (pos - lower.position) / range
  const s = factor * factor * (3 - 2 * factor) // Hermite smoothing
  return [
    (lower.r + (upper.r - lower.r) * s) | 0,
    (lower.g + (upper.g - lower.g) * s) | 0,
    (lower.b + (upper.b - lower.b) * s) | 0,
  ]
}

export function generateOrganicSvg(
  geometry: OrganicGeometry,
  settings: OrganicSettings,
): string {
  const { paths, width, height } = geometry
  const parsedStops = parseAndSortStops(settings)

  const halfW = width / 2
  const halfH = height / 2
  const radialMaxDist = Math.sqrt(halfW * halfW + halfH * halfH)
  const PI = Math.PI

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`
  svg += `  <rect width="100%" height="100%" fill="${settings.bgColor}"/>\n`

  const pad = settings.padding
  const hasClip = pad > 0

  if (hasClip) {
    svg += `  <defs>\n`
    svg += `    <clipPath id="padding">\n`
    svg += `      <rect x="${pad}" y="${pad}" width="${width - pad * 2}" height="${height - pad * 2}"/>\n`
    svg += `    </clipPath>\n`
    svg += `  </defs>\n`
  }

  const groupAttrs = hasClip ? ` clip-path="url(#padding)"` : ''
  svg += `  <g stroke-linecap="round" stroke-linejoin="round"${groupAttrs}>\n`

  const subdivisions = 4
  const invSub = 1 / subdivisions
  const hasTaper = settings.taper > 0
  const taperAmount = settings.taper / 100
  const baseWeight = settings.lineWeight
  const gradType = settings.gradientType

  for (const path of paths) {
    if (path.length < 2) continue

    const len = path.length
    const invLen = 1 / (len - 1)

    for (let i = 0; i < len - 1; i++) {
      const t1 = i * invLen
      const t2 = (i + 1) * invLen
      const x1 = path[i].x
      const y1 = path[i].y
      const x2 = path[i + 1].x
      const y2 = path[i + 1].y
      const dx = x2 - x1
      const dy = y2 - y1

      for (let sub = 0; sub < subdivisions; sub++) {
        const st1 = sub * invSub
        const st2 = (sub + 1) * invSub

        const sx1 = x1 + dx * st1
        const sy1 = y1 + dy * st1
        const sx2 = x1 + dx * st2
        const sy2 = y1 + dy * st2

        const midT = t1 + (t2 - t1) * ((st1 + st2) * 0.5)

        let gradientT: number
        if (gradType === 'pathAlong') {
          gradientT = midT
        } else {
          const mx = (sx1 + sx2) * 0.5
          const my = (sy1 + sy2) * 0.5
          switch (gradType) {
            case 'horizontal':
              gradientT = mx / width
              break
            case 'vertical':
              gradientT = my / height
              break
            case 'radial': {
              const rdx = mx - halfW
              const rdy = my - halfH
              gradientT = Math.sqrt(rdx * rdx + rdy * rdy) / radialMaxDist
              break
            }
            case 'angular':
              gradientT = (Math.atan2(my - halfH, mx - halfW) + PI) / (PI * 2)
              break
            default:
              gradientT = midT
          }
        }

        const [r, g, b] = lerpParsedStops(gradientT, parsedStops)

        let strokeWidth: number
        if (hasTaper) {
          const taperCurve = Math.sin(midT * PI)
          strokeWidth = Math.max(0.5, baseWeight * (1 - taperAmount + taperAmount * taperCurve))
        } else {
          strokeWidth = baseWeight
        }

        svg += `    <line x1="${round2(sx1)}" y1="${round2(sy1)}" x2="${round2(sx2)}" y2="${round2(sy2)}" stroke="rgb(${r},${g},${b})" stroke-width="${round2(strokeWidth)}" stroke-linecap="round"/>\n`
      }
    }
  }

  svg += `  </g>\n`
  svg += `</svg>`
  return svg
}
