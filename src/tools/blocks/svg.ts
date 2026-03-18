import type { BlocksSettings, BlocksGeometry, RectBlock } from './types'
import { pickColor } from './sketch'
import { seededRandom } from '@/lib/math'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function pointsToPolygon(points: { x: number; y: number }[]): string {
  return points.map((p) => `${round2(p.x)},${round2(p.y)}`).join(' ')
}

/** Generate wobbled vertices for a rect block — mirrors drawPaintedBlock in sketch.ts exactly. */
function rectFillVertices(rect: RectBlock, wobble: number, rng: () => number): { x: number; y: number }[] {
  if (wobble <= 0) {
    return [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
      { x: rect.x, y: rect.y + rect.h },
    ]
  }

  const maxWobble = wobble * 4
  const segments = 15
  const pts: { x: number; y: number }[] = []

  // Top edge
  for (let i = 0; i <= segments; i++) {
    pts.push({
      x: rect.x + (rect.w * i) / segments,
      y: rect.y + (rng() - 0.5) * maxWobble * 2,
    })
  }
  // Right edge
  for (let i = 1; i <= segments; i++) {
    pts.push({
      x: rect.x + rect.w + (rng() - 0.5) * maxWobble * 2,
      y: rect.y + (rect.h * i) / segments,
    })
  }
  // Bottom edge
  for (let i = 1; i <= segments; i++) {
    pts.push({
      x: rect.x + rect.w - (rect.w * i) / segments,
      y: rect.y + rect.h + (rng() - 0.5) * maxWobble * 2,
    })
  }
  // Left edge
  for (let i = 1; i < segments; i++) {
    pts.push({
      x: rect.x + (rng() - 0.5) * maxWobble * 2,
      y: rect.y + rect.h - (rect.h * i) / segments,
    })
  }

  return pts
}

/** Generate wobbled vertices for a polygon — mirrors drawPaintedPolygon in sketch.ts exactly. */
function polyFillVertices(
  originalPoints: { x: number; y: number }[],
  wobble: number,
  rng: () => number,
): { x: number; y: number }[] {
  if (wobble <= 0) {
    return [...originalPoints]
  }

  const maxWobble = wobble * 4
  const segments = 10
  const pts: { x: number; y: number }[] = []

  for (let i = 0; i < originalPoints.length; i++) {
    const p1 = originalPoints[i]
    const p2 = originalPoints[(i + 1) % originalPoints.length]
    for (let j = 0; j < segments; j++) {
      const t = j / segments
      pts.push({
        x: p1.x + (p2.x - p1.x) * t + (rng() - 0.5) * maxWobble * 2,
        y: p1.y + (p2.y - p1.y) * t + (rng() - 0.5) * maxWobble * 2,
      })
    }
  }

  return pts
}

/** Generate wobbled outline vertices for a rect — mirrors drawWobblyRectOutline in sketch.ts exactly. */
function rectOutlineVertices(rect: RectBlock, wobble: number, rng: () => number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = []

  for (let i = 0; i <= 10; i++) {
    pts.push({
      x: rect.x + (rect.w * i) / 10 + (rng() - 0.5) * wobble * 4,
      y: rect.y + (rng() - 0.5) * wobble * 4,
    })
  }
  for (let i = 0; i <= 10; i++) {
    pts.push({
      x: rect.x + rect.w + (rng() - 0.5) * wobble * 4,
      y: rect.y + (rect.h * i) / 10 + (rng() - 0.5) * wobble * 4,
    })
  }
  for (let i = 0; i <= 10; i++) {
    pts.push({
      x: rect.x + rect.w - (rect.w * i) / 10 + (rng() - 0.5) * wobble * 4,
      y: rect.y + rect.h + (rng() - 0.5) * wobble * 4,
    })
  }
  for (let i = 0; i <= 10; i++) {
    pts.push({
      x: rect.x + (rng() - 0.5) * wobble * 4,
      y: rect.y + rect.h - (rect.h * i) / 10 + (rng() - 0.5) * wobble * 4,
    })
  }

  return pts
}

/** Generate wobbled outline vertices for a polygon — mirrors the outline loop in sketch.ts exactly. */
function polyOutlineVertices(
  originalPoints: { x: number; y: number }[],
  wobble: number,
  rng: () => number,
): { x: number; y: number }[] {
  return originalPoints.map((pt) => ({
    x: pt.x + (rng() - 0.5) * wobble * 4,
    y: pt.y + (rng() - 0.5) * wobble * 4,
  }))
}

export function generateBlocksSvg(
  geometry: BlocksGeometry,
  settings: BlocksSettings,
): string {
  const { width, height } = geometry
  const wobble = settings.edgeWobble / 100
  const colorDensity = settings.colorDensity / 100

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`
  svg += `  <rect width="100%" height="100%" fill="${settings.bgColor}"/>\n`

  // Rotation wrapper
  const hasRotation = settings.rotation !== 0
  const cx = width / 2
  const cy = height / 2

  if (hasRotation) {
    svg += `  <g transform="translate(${cx},${cy}) rotate(${settings.rotation}) translate(${-cx},${-cy})">\n`
  }

  const indent = hasRotation ? '    ' : '  '

  if (settings.patternType === 'diagonal') {
    // Diagonal: use polys
    const colorRng = seededRandom(settings.seed + 7)
    const drawRng = seededRandom(settings.seed + 13)

    for (const poly of geometry.polys) {
      const color = pickColor(colorRng, colorDensity, settings.colors)
      const pts = polyFillVertices(poly.points, wobble, drawRng)
      svg += `${indent}<polygon points="${pointsToPolygon(pts)}" fill="${color}" stroke="none"/>\n`
    }

    if (settings.lineWeight > 0) {
      const outlineRng = seededRandom(settings.seed + 19)
      for (const poly of geometry.polys) {
        const pts = polyOutlineVertices(poly.points, wobble, outlineRng)
        svg += `${indent}<polygon points="${pointsToPolygon(pts)}" fill="none" stroke="${settings.lineColor}" stroke-width="${settings.lineWeight}" stroke-linecap="round" stroke-linejoin="round"/>\n`
      }
    }
  } else {
    // Non-diagonal: use rects
    const colorRng = seededRandom(settings.seed + 7)
    const drawRng = seededRandom(settings.seed + 13)

    for (const rect of geometry.rects) {
      const color = pickColor(colorRng, colorDensity, settings.colors)
      const pts = rectFillVertices(rect, wobble, drawRng)
      svg += `${indent}<polygon points="${pointsToPolygon(pts)}" fill="${color}" stroke="none"/>\n`
    }

    if (settings.lineWeight > 0) {
      const outlineRng = seededRandom(settings.seed + 19)
      for (const rect of geometry.rects) {
        const pts = rectOutlineVertices(rect, wobble, outlineRng)
        svg += `${indent}<polygon points="${pointsToPolygon(pts)}" fill="none" stroke="${settings.lineColor}" stroke-width="${settings.lineWeight}" stroke-linecap="round" stroke-linejoin="round"/>\n`
      }
    }
  }

  if (hasRotation) {
    svg += `  </g>\n`
  }

  svg += `</svg>`
  return svg
}
