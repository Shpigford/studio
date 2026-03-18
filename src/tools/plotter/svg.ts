import type {
  PlotterGeometry,
  PlotterPathPrimitive,
  PlotterPoint,
  PlotterShapePrimitive,
} from './types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function pointsToPolyString(points: PlotterPoint[]): string {
  return points.map(pt => `${round2(pt.x)},${round2(pt.y)}`).join(' ')
}

function regularStarPoints(x: number, y: number, innerRadius: number, outerRadius: number): PlotterPoint[] {
  const points: PlotterPoint[] = []
  const angle = Math.PI / 5
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    const theta = -Math.PI / 2 + i * angle
    points.push({
      x: x + Math.cos(theta) * radius,
      y: y + Math.sin(theta) * radius,
    })
  }
  return points
}

function renderShapePrimitive(el: PlotterShapePrimitive): string {
  const { shapeType, x, y, size, color, rotation, filled, strokeWeight } = el
  const half = size / 2
  const fillAttr = filled ? `fill="${color}"` : `fill="none"`
  const strokeAttr = filled ? '' : ` stroke="${color}" stroke-width="${round2(strokeWeight)}"`
  const rotAttr = rotation !== 0 ? ` transform="rotate(${round2(rotation)},${round2(x)},${round2(y)})"` : ''

  switch (shapeType) {
    case 'circle':
      return `    <circle cx="${round2(x)}" cy="${round2(y)}" r="${round2(half)}" ${fillAttr}${strokeAttr}${rotAttr}/>\n`

    case 'square':
      return `    <rect x="${round2(x - half)}" y="${round2(y - half)}" width="${round2(size)}" height="${round2(size)}" ${fillAttr}${strokeAttr}${rotAttr}/>\n`

    case 'triangle': {
      const height = size * 0.866
      const pts = [
        { x, y: y - height / 2 },
        { x: x - half, y: y + height / 2 },
        { x: x + half, y: y + height / 2 },
      ]
      return `    <polygon points="${pointsToPolyString(pts)}" ${fillAttr}${strokeAttr}${rotAttr}/>\n`
    }

    case 'diamond': {
      const pts = [
        { x, y: y - half },
        { x: x + half, y },
        { x, y: y + half },
        { x: x - half, y },
      ]
      return `    <polygon points="${pointsToPolyString(pts)}" ${fillAttr}${strokeAttr}${rotAttr}/>\n`
    }

    case 'cross': {
      if (filled) {
        const arm = size / 4
        const armHalf = arm / 2
        const pts = [
          { x: x - half, y: y - armHalf },
          { x: x - armHalf, y: y - armHalf },
          { x: x - armHalf, y: y - half },
          { x: x + armHalf, y: y - half },
          { x: x + armHalf, y: y - armHalf },
          { x: x + half, y: y - armHalf },
          { x: x + half, y: y + armHalf },
          { x: x + armHalf, y: y + armHalf },
          { x: x + armHalf, y: y + half },
          { x: x - armHalf, y: y + half },
          { x: x - armHalf, y: y + armHalf },
          { x: x - half, y: y + armHalf },
        ]
        return `    <polygon points="${pointsToPolyString(pts)}" fill="${color}" stroke="none"${rotAttr}/>\n`
      }

      const cos = Math.cos((rotation * Math.PI) / 180)
      const sin = Math.sin((rotation * Math.PI) / 180)
      // Horizontal arm
      const hx1 = x + (-half) * cos
      const hy1 = y + (-half) * sin
      const hx2 = x + half * cos
      const hy2 = y + half * sin
      // Vertical arm
      const vx1 = x + (-half) * -sin
      const vy1 = y + (-half) * cos
      const vx2 = x + half * -sin
      const vy2 = y + half * cos
      return `    <line x1="${round2(hx1)}" y1="${round2(hy1)}" x2="${round2(hx2)}" y2="${round2(hy2)}" stroke="${color}" stroke-width="${round2(strokeWeight)}"/>\n` +
             `    <line x1="${round2(vx1)}" y1="${round2(vy1)}" x2="${round2(vx2)}" y2="${round2(vy2)}" stroke="${color}" stroke-width="${round2(strokeWeight)}"/>\n`
    }

    case 'ring':
      return `    <circle cx="${round2(x)}" cy="${round2(y)}" r="${round2(half)}" fill="none" stroke="${color}" stroke-width="${round2(strokeWeight)}"${rotAttr}/>\n`

    case 'star': {
      const pts = regularStarPoints(x, y, size / 4, half)
      return `    <polygon points="${pointsToPolyString(pts)}" ${fillAttr}${strokeAttr}${rotAttr}/>\n`
    }

    case 'line': {
      const cos = Math.cos((rotation * Math.PI) / 180)
      const sin = Math.sin((rotation * Math.PI) / 180)
      const lx1 = x + (-half) * cos
      const ly1 = y + (-half) * sin
      const lx2 = x + half * cos
      const ly2 = y + half * sin
      return `    <line x1="${round2(lx1)}" y1="${round2(ly1)}" x2="${round2(lx2)}" y2="${round2(ly2)}" stroke="${color}" stroke-width="${round2(strokeWeight)}"/>\n`
    }

    default:
      return ''
  }
}

function renderPathPrimitive(el: PlotterPathPrimitive): string {
  if (el.points.length < 2) return ''

  const { points, closed, color, strokeWeight, filled } = el

  if (filled && closed) {
    return `    <polygon points="${pointsToPolyString(points)}" fill="${color}" stroke="none"/>\n`
  }

  if (closed) {
    return `    <polygon points="${pointsToPolyString(points)}" fill="none" stroke="${color}" stroke-width="${round2(strokeWeight)}" stroke-linecap="round" stroke-linejoin="round"/>\n`
  }

  return `    <polyline points="${pointsToPolyString(points)}" fill="none" stroke="${color}" stroke-width="${round2(strokeWeight)}" stroke-linecap="round" stroke-linejoin="round"/>\n`
}

export function generatePlotterSvg(geometry: PlotterGeometry): string {
  const { elements, bgColor, width, height, margin } = geometry

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`
  svg += `  <rect width="100%" height="100%" fill="${bgColor}"/>\n`

  const hasClip = margin > 0
  if (hasClip) {
    svg += `  <defs>\n`
    svg += `    <clipPath id="margin">\n`
    svg += `      <rect x="${margin}" y="${margin}" width="${width - margin * 2}" height="${height - margin * 2}"/>\n`
    svg += `    </clipPath>\n`
    svg += `  </defs>\n`
  }

  const groupAttrs = hasClip ? ` clip-path="url(#margin)"` : ''
  svg += `  <g${groupAttrs}>\n`

  for (const el of elements) {
    if (el.type === 'shape') {
      svg += renderShapePrimitive(el)
    } else {
      svg += renderPathPrimitive(el)
    }
  }

  svg += `  </g>\n`
  svg += `</svg>`
  return svg
}
