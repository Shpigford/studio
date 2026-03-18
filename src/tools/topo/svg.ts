import type { TopoSettings, TopoGeometry, Point } from './types'
import { lerpColor } from '@/lib/color'
import { PALETTES } from './sketch'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function getContourColorHex(level: number, s: TopoSettings): string {
  switch (s.colorMode) {
    case 'elevation': {
      const col = lerpColor(s.lineColor || '#222222', s.bgColor, level * 0.7)
      return col
    }
    case 'palette': {
      const pal = PALETTES[s.palette] || PALETTES.mono
      const palIndex = Math.floor(level * (pal.length - 1))
      const palT = (level * (pal.length - 1)) % 1
      const c1 = pal[Math.min(palIndex, pal.length - 1)]
      const c2 = pal[Math.min(palIndex + 1, pal.length - 1)]
      return lerpColor(c1, c2, palT)
    }
    default:
      return s.lineColor || '#222222'
  }
}

/** Convert Catmull-Rom spline points to SVG cubic bezier path data. */
function catmullRomToSvgPath(points: Point[]): string {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M${round2(points[0].x)},${round2(points[0].y)} L${round2(points[1].x)},${round2(points[1].y)}`
  }

  // p5's splineVertex duplicates first and last points as control points
  const pts = [points[0], ...points, points[points.length - 1]]

  let d = `M${round2(pts[1].x)},${round2(pts[1].y)}`

  for (let i = 0; i < pts.length - 3; i++) {
    const p0 = pts[i]
    const p1 = pts[i + 1]
    const p2 = pts[i + 2]
    const p3 = pts[i + 3]

    // Catmull-Rom to cubic Bezier conversion
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C${round2(cp1x)},${round2(cp1y)} ${round2(cp2x)},${round2(cp2y)} ${round2(p2.x)},${round2(p2.y)}`
  }

  return d
}

function pointsToSvgPath(points: Point[]): string {
  if (points.length < 2) return ''
  let d = `M${round2(points[0].x)},${round2(points[0].y)}`
  for (let i = 1; i < points.length; i++) {
    d += ` L${round2(points[i].x)},${round2(points[i].y)}`
  }
  return d
}

export function generateTopoSvg(
  geometry: TopoGeometry,
  settings: TopoSettings,
): string {
  const { contours, width, height } = geometry
  const useSmoothing = settings.smoothing > 0

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`
  svg += `  <rect width="100%" height="100%" fill="${settings.bgColor}"/>\n`

  const pad = settings.margin
  const hasClip = pad > 0

  if (hasClip) {
    svg += `  <defs>\n`
    svg += `    <clipPath id="margin">\n`
    svg += `      <rect x="${pad}" y="${pad}" width="${width - pad * 2}" height="${height - pad * 2}"/>\n`
    svg += `    </clipPath>\n`
    svg += `  </defs>\n`
  }

  const groupAttrs = hasClip ? ` clip-path="url(#margin)"` : ''
  svg += `  <g fill="none" stroke-linecap="round" stroke-linejoin="round"${groupAttrs}>\n`

  for (const contour of contours) {
    if (contour.points.length < 2) continue

    const color = getContourColorHex(contour.level, settings)
    const opacity = settings.opacity / 100
    const d = useSmoothing && contour.points.length > 2
      ? catmullRomToSvgPath(contour.points)
      : pointsToSvgPath(contour.points)

    svg += `    <path d="${d}" stroke="${color}" stroke-width="${settings.strokeWeight}" stroke-opacity="${round2(opacity)}"/>\n`
  }

  svg += `  </g>\n`
  svg += `</svg>`
  return svg
}
