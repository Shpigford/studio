import type p5 from 'p5'
import type { RefObject } from 'react'
import type {
  PlotterGeometry,
  PlotterPathPrimitive,
  PlotterPrimitiveShapeType,
  PlotterSettings,
  PlotterShapePrimitive,
} from './types'

interface Point {
  x: number
  y: number
}

type ExportStyle = {
  color: string
  filled: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P5Any = any

export const PALETTES: Record<string, string[]> = {
  purplePink: ['#1a1a3e', '#d4a5c9', '#8b6b8a'],
  darkRed: ['#2d3436', '#d63031', '#e17055'],
  blues: ['#0c2461', '#1e3799', '#4a69bd'],
  coralGold: ['#1e272e', '#ff6b81', '#ffc048'],
  forest: ['#2c3e50', '#27ae60', '#f39c12'],
  navyRed: ['#1a1a2e', '#16213e', '#e94560'],
  grayscale: ['#000000', '#333333', '#666666'],
  sepia: ['#704214', '#a0522d', '#deb887'],
  ocean: ['#1c3d5a', '#3a7ca5', '#81d4fa'],
  teals: ['#004d4d', '#008080', '#20b2aa'],
  neon: ['#ff073a', '#39ff14', '#ff61f6'],
  pastels: ['#b39ddb', '#ce93d8', '#f8bbd9'],
}

export function createPlotterSketch(
  p: p5,
  settingsRef: RefObject<PlotterSettings>,
  geometryRef?: RefObject<PlotterGeometry | null>,
) {
  const ctx = () => p.drawingContext as CanvasRenderingContext2D
  let svgElements: (PlotterShapePrimitive | PlotterPathPrimitive)[] = []
  // Track current transform for converting local-space organic path points to world space
  let activeTransform: { tx: number; ty: number; rot: number } | null = null

  function toWorldSpace(pt: Point): Point {
    if (!activeTransform) return { x: pt.x, y: pt.y }
    const { tx, ty, rot } = activeTransform
    const rad = (rot * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    return {
      x: tx + pt.x * cos - pt.y * sin,
      y: ty + pt.x * sin + pt.y * cos,
    }
  }

  function toWorldRotation(rotationDegrees: number): number {
    return rotationDegrees + (activeTransform?.rot ?? 0)
  }

  function pushPathPrimitive(
    points: Point[],
    closed: boolean,
    color: string,
    strokeWeight: number,
    filled: boolean,
  ) {
    if (points.length < 2) return
    svgElements.push({
      type: 'path',
      points: points.map(pt => toWorldSpace(pt)),
      closed,
      color,
      strokeWeight,
      filled,
    })
  }

  function pushShapePrimitive(
    shapeType: PlotterPrimitiveShapeType,
    x: number,
    y: number,
    size: number,
    color: string,
    rotationDegrees: number,
    filled: boolean,
    strokeWeight: number,
  ) {
    const world = toWorldSpace({ x, y })
    svgElements.push({
      type: 'shape',
      shapeType,
      x: world.x,
      y: world.y,
      size,
      color,
      rotation: toWorldRotation(rotationDegrees),
      filled,
      strokeWeight,
    })
  }

  function getContainerSize(): { w: number; h: number } {
    const el = (p as P5Any).canvas?.parentElement ?? document.body
    const maxW = el.clientWidth - 40
    const maxH = el.clientHeight - 40
    const size = settingsRef.current.canvasSize
    const scale = Math.min(1, maxW / size, maxH / size)
    return { w: Math.floor(size * scale), h: Math.floor(size * scale) }
  }

  p.setup = () => {
    const size = getContainerSize()
    p.createCanvas(size.w, size.h)
    p.pixelDensity(2)
    p.colorMode(p.RGB, 255)
    p.noLoop()
    redrawCanvas()
  }

  p.windowResized = () => {
    const size = getContainerSize()
    p.resizeCanvas(size.w, size.h)
    p.colorMode(p.RGB, 255)
    // force recompute on resize
    redrawCanvas()
  }

  p.draw = () => {
    redrawCanvas()
  }

  function redrawCanvas() {
    const s = settingsRef.current
    svgElements = []

    const target = getContainerSize()
    if (p.width !== target.w || p.height !== target.h) {
      p.resizeCanvas(target.w, target.h)
      p.colorMode(p.RGB, 255)
      // force recompute on resize
    }

    p.randomSeed(s.seed)
    p.noiseSeed(s.seed)
    p.background(s.bgColor)

    switch (s.patternType) {
      case 'dotGrid':
        drawDotGrid(s)
        break
      case 'flowField':
        drawFlowField(s)
        break
      case 'concentric':
        drawConcentric(s)
        break
      case 'waves':
        drawWaves(s)
        break
      case 'hatching':
        drawHatching(s)
        break
      case 'geometric':
        drawGeometric(s)
        break
    }

    if (s.textureAmount > 0) {
      drawTexture(s)
    }

    if (geometryRef) {
      geometryRef.current = {
        elements: svgElements,
        bgColor: s.bgColor,
        width: p.width,
        height: p.height,
        margin: s.margin,
      }
    }
  }

  // ── Pattern: Dot Grid ──

  function drawDotGrid(s: PlotterSettings) {
    const cols = s.columns
    const rows = s.rows
    const margin = s.margin
    const colors = s.colors
    if (colors.length === 0) return

    const cellW = (p.width - margin * 2) / cols
    const cellH = (p.height - margin * 2) / rows

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let x = margin + col * cellW + cellW / 2
        let y = margin + row * cellH + cellH / 2

        if (s.jitter > 0) {
          x += (p.random() - 0.5) * cellW * s.jitter
          y += (p.random() - 0.5) * cellH * s.jitter
        }

        const n = p.noise(x * s.noiseScale, y * s.noiseScale)
        const size = p.map(
          Math.pow(n, 1 / s.noiseIntensity),
          0, 1,
          s.minSize, s.maxSize
        )

        const colorIndex = Math.min(Math.floor(n * colors.length), colors.length - 1)
        drawShape(s, x, y, size, colors[colorIndex])
      }
    }
  }

  // ── Pattern: Flow Field ──

  function drawFlowField(s: PlotterSettings) {
    const margin = s.margin
    const colors = s.colors
    if (colors.length === 0) return

    p.strokeWeight(s.strokeWeight)
    p.noFill()

    for (let i = 0; i < s.flowField.lineCount; i++) {
      let x = p.random(margin, p.width - margin)
      let y = p.random(margin, p.height - margin)

      const startNoise = p.noise(x * s.noiseScale * 0.5, y * s.noiseScale * 0.5)
      const colorIndex = Math.min(Math.floor(startNoise * colors.length), colors.length - 1)
      p.stroke(colors[colorIndex])

      const points: Point[] = []
      for (let j = 0; j < s.flowField.steps; j++) {
        points.push({ x, y })

        const angle = p.noise(x * s.noiseScale, y * s.noiseScale) * p.TWO_PI * 2 * s.noiseIntensity
        x += Math.cos(angle) * s.flowField.stepLength
        y += Math.sin(angle) * s.flowField.stepLength

        if (x < margin || x > p.width - margin || y < margin || y > p.height - margin) break
      }

      if (points.length > 1) {
        renderBrushPath(s, points, false, { color: colors[colorIndex], filled: false })
      }
    }
  }

  // ── Pattern: Concentric ──

  function drawConcentric(s: PlotterSettings) {
    const centerX = p.width / 2
    const centerY = p.height / 2
    const maxRadius = Math.min(p.width, p.height) / 2 - s.margin
    const colors = s.colors
    if (colors.length === 0) return

    p.noFill()
    p.strokeWeight(s.strokeWeight)

    for (let i = 0; i < s.concentric.count; i++) {
      const baseRadius = (i + 1) * s.concentric.spacing
      if (baseRadius > maxRadius) break

      const colorIndex = i % colors.length
      p.stroke(colors[colorIndex])

      const points: Point[] = []
      for (let angle = 0; angle < p.TWO_PI; angle += 0.02) {
        const noiseVal = p.noise(
          Math.cos(angle) * s.noiseScale * 50 + i * 0.1,
          Math.sin(angle) * s.noiseScale * 50 + i * 0.1
        )
        const distortion = (noiseVal - 0.5) * s.noiseIntensity * 50
        const r = baseRadius + distortion
        points.push({
          x: centerX + Math.cos(angle) * r,
          y: centerY + Math.sin(angle) * r,
        })
      }

      renderBrushPath(s, points, true, { color: colors[colorIndex], filled: false })
    }
  }

  // ── Pattern: Waves ──

  function drawWaves(s: PlotterSettings) {
    const margin = s.margin
    const colors = s.colors
    if (colors.length === 0) return

    p.noFill()
    p.strokeWeight(s.strokeWeight)

    const spacing = (p.height - margin * 2) / s.waves.count

    for (let i = 0; i < s.waves.count; i++) {
      const baseY = margin + i * spacing + spacing / 2
      const colorIndex = i % colors.length
      p.stroke(colors[colorIndex])

      const points: Point[] = []
      for (let x = margin; x <= p.width - margin; x += 2) {
        const noiseVal = p.noise(x * s.noiseScale, i * 0.5)
        const wave = Math.sin(x * s.waves.frequency + i * 0.5) * s.waves.amplitude
        const noiseOffset = (noiseVal - 0.5) * s.noiseIntensity * 30
        points.push({ x, y: baseY + wave + noiseOffset })
      }

      renderBrushPath(s, points, false, { color: colors[colorIndex], filled: false })
    }
  }

  // ── Pattern: Hatching ──

  function drawHatching(s: PlotterSettings) {
    const colors = s.colors
    if (colors.length === 0) return

    p.strokeWeight(s.strokeWeight)

    const angleRad = (s.hatching.angle * Math.PI) / 180
    drawHatchLines(s, angleRad, s.hatching.spacing, colors)

    if (s.hatching.crossHatch) {
      drawHatchLines(s, angleRad + p.HALF_PI, s.hatching.spacing, colors)
    }
  }

  function drawHatchLines(s: PlotterSettings, angleRad: number, spacing: number, colors: string[]) {
    const margin = s.margin
    const diagonal = Math.sqrt(p.width * p.width + p.height * p.height)
    const numLines = Math.ceil(diagonal / spacing)

    p.noFill()

    for (let i = -numLines; i < numLines; i++) {
      const lineNoise = p.noise(i * 0.1, s.seed * 0.01)
      if (lineNoise < 0.3 * (1 - s.noiseIntensity)) continue

      const colorIndex = Math.min(Math.floor(lineNoise * colors.length), colors.length - 1)
      p.stroke(colors[colorIndex])

      const offset = i * spacing
      const cx = p.width / 2
      const cy = p.height / 2

      const perpX = Math.cos(angleRad + p.HALF_PI)
      const perpY = Math.sin(angleRad + p.HALF_PI)
      const dirX = Math.cos(angleRad)
      const dirY = Math.sin(angleRad)

      const startX = cx + perpX * offset - dirX * diagonal
      const startY = cy + perpY * offset - dirY * diagonal
      const endX = cx + perpX * offset + dirX * diagonal
      const endY = cy + perpY * offset + dirY * diagonal

      const clipped = clipLineToRect(
        startX, startY, endX, endY,
        margin, margin, p.width - margin, p.height - margin
      )

      if (clipped) {
        renderBrushPath(s, [
          { x: clipped.x1, y: clipped.y1 },
          { x: clipped.x2, y: clipped.y2 },
        ], false, { color: colors[colorIndex], filled: false })
      }
    }
  }

  // ── Pattern: Geometric ──

  function drawGeometric(s: PlotterSettings) {
    const margin = s.margin
    const size = s.geometric.size
    const colors = s.colors
    if (colors.length === 0) return

    p.strokeWeight(s.strokeWeight)

    switch (s.geometric.shape) {
      case 'hexagon':
        drawHexGrid(s, margin, size, colors)
        break
      case 'triangle':
        drawTriGrid(s, margin, size, colors)
        break
      case 'square':
        drawSquareGrid(s, margin, size, colors)
        break
    }
  }

  function drawHexGrid(s: PlotterSettings, margin: number, size: number, colors: string[]) {
    const h = size * Math.sqrt(3)
    const cols = Math.ceil((p.width - margin * 2) / (size * 1.5)) + 1
    const rows = Math.ceil((p.height - margin * 2) / h) + 1
    const shapeSize = size * 0.9
    const half = shapeSize / 2

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = margin + col * size * 1.5
        const y = margin + row * h + (col % 2 === 1 ? h / 2 : 0)

        if (x - half < margin || x + half > p.width - margin) continue
        if (y - half < margin || y + half > p.height - margin) continue

        const n = p.noise(x * s.noiseScale, y * s.noiseScale)
        if (n < 0.2 * (1 - s.noiseIntensity)) continue

        const ci = Math.min(Math.floor(n * colors.length), colors.length - 1)
        drawShape(s, x, y, shapeSize, colors[ci])
      }
    }
  }

  function drawTriGrid(s: PlotterSettings, margin: number, size: number, colors: string[]) {
    const h = size * Math.sqrt(3) / 2
    const cols = Math.ceil((p.width - margin * 2) / size) + 1
    const rows = Math.ceil((p.height - margin * 2) / h) + 1
    const shapeSize = size * 0.9
    const half = shapeSize / 2

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = margin + col * size + (row % 2 === 1 ? size / 2 : 0)
        const y = margin + row * h

        if (x - half < margin || x + half > p.width - margin) continue
        if (y - half < margin || y + half > p.height - margin) continue

        const n = p.noise(x * s.noiseScale, y * s.noiseScale)
        if (n < 0.2 * (1 - s.noiseIntensity)) continue

        const ci = Math.min(Math.floor(n * colors.length), colors.length - 1)
        drawShape(s, x, y, shapeSize, colors[ci])
      }
    }
  }

  function drawSquareGrid(s: PlotterSettings, margin: number, size: number, colors: string[]) {
    const cols = Math.ceil((p.width - margin * 2) / size)
    const rows = Math.ceil((p.height - margin * 2) / size)
    const shapeSize = size * 0.85
    const half = shapeSize / 2

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = margin + col * size + size / 2
        const y = margin + row * size + size / 2

        if (x - half < margin || x + half > p.width - margin) continue
        if (y - half < margin || y + half > p.height - margin) continue

        const n = p.noise(x * s.noiseScale, y * s.noiseScale)
        if (n < 0.2 * (1 - s.noiseIntensity)) continue

        const ci = Math.min(Math.floor(n * colors.length), colors.length - 1)
        drawShape(s, x, y, shapeSize, colors[ci])
      }
    }
  }

  // ── Shape Drawing ──

  function drawShape(s: PlotterSettings, x: number, y: number, size: number, color: string) {
    p.push()
    p.translate(x, y)
    p.rotate((s.rotation * Math.PI) / 180)
    activeTransform = { tx: x, ty: y, rot: s.rotation }

    const hasOrganic = s.wobble > 0 || s.roughness > 0
    const exportFilled = s.filled && s.shapeType !== 'line' && s.shapeType !== 'cross' && s.shapeType !== 'ring'
    const exportStyle: ExportStyle = { color, filled: exportFilled }

    if (s.filled) {
      p.fill(color)
      p.noStroke()
    } else {
      p.noFill()
      p.stroke(color)
      p.strokeWeight(s.strokeWeight)
    }

    // For non-organic shapes, push a shape primitive for SVG export
    if (!hasOrganic) {
      pushShapePrimitive(s.shapeType, 0, 0, size, color, 0, exportFilled, s.strokeWeight)
    }
    // Organic shapes go through renderBrushPath which pushes path primitives

    switch (s.shapeType) {
      case 'circle':
        if (hasOrganic) drawOrganicEllipse(s, 0, 0, size, size, x, y, exportStyle)
        else p.ellipse(0, 0, size, size)
        break
      case 'square':
        if (hasOrganic) drawOrganicRect(s, 0, 0, size, size, x, y, exportStyle)
        else { p.rectMode(p.CENTER); p.rect(0, 0, size, size) }
        break
      case 'line':
        p.stroke(color)
        p.strokeWeight(s.strokeWeight)
        if (hasOrganic) drawOrganicLine(s, -size / 2, 0, size / 2, 0, x, y, { color, filled: false })
        else p.line(-size / 2, 0, size / 2, 0)
        break
      case 'cross':
        p.stroke(color)
        p.strokeWeight(s.strokeWeight)
        if (hasOrganic) {
          drawOrganicLine(s, -size / 2, 0, size / 2, 0, x, y, { color, filled: false })
          drawOrganicLine(s, 0, -size / 2, 0, size / 2, x, y + 1000, { color, filled: false })
        } else {
          p.line(-size / 2, 0, size / 2, 0)
          p.line(0, -size / 2, 0, size / 2)
        }
        break
      case 'ring':
        p.noFill()
        p.stroke(color)
        p.strokeWeight(s.strokeWeight)
        if (hasOrganic) drawOrganicEllipse(s, 0, 0, size, size, x, y, { color, filled: false })
        else p.ellipse(0, 0, size, size)
        break
      case 'diamond':
        if (hasOrganic) {
          drawOrganicPolygon(s, [
            { x: 0, y: -size / 2 },
            { x: size / 2, y: 0 },
            { x: 0, y: size / 2 },
            { x: -size / 2, y: 0 },
          ], x, y, exportStyle)
        } else {
          p.beginShape()
          p.vertex(0, -size / 2)
          p.vertex(size / 2, 0)
          p.vertex(0, size / 2)
          p.vertex(-size / 2, 0)
          p.endShape(p.CLOSE)
        }
        break
    }

    activeTransform = null
    p.pop()
  }

  // ── Organic Helpers ──

  function applyWobble(s: PlotterSettings, px: number, py: number, seedX: number, seedY: number): Point {
    let offsetX = 0
    let offsetY = 0

    if (s.wobble > 0) {
      const ws = 0.1
      offsetX += (p.noise(px * ws + seedX, py * ws) - 0.5) * s.wobble * 10
      offsetY += (p.noise(px * ws, py * ws + seedY) - 0.5) * s.wobble * 10
    }

    if (s.roughness > 0) {
      offsetX += (p.random() - 0.5) * s.roughness * 3
      offsetY += (p.random() - 0.5) * s.roughness * 3
    }

    return { x: px + offsetX, y: py + offsetY }
  }

  function drawOrganicEllipse(
    s: PlotterSettings,
    cx: number,
    cy: number,
    w: number,
    h: number,
    seedX: number,
    seedY: number,
    style: ExportStyle,
  ) {
    const segments = Math.max(12, Math.floor(Math.max(w, h) * 0.8))
    const points: Point[] = []
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * p.TWO_PI
      const px = cx + Math.cos(angle) * w / 2
      const py = cy + Math.sin(angle) * h / 2
      points.push(applyWobble(s, px, py, seedX + i * 0.1, seedY + i * 0.1))
    }
    renderBrushPath(s, points, true, style)
  }

  function drawOrganicRect(
    s: PlotterSettings,
    cx: number,
    cy: number,
    w: number,
    h: number,
    seedX: number,
    seedY: number,
    style: ExportStyle,
  ) {
    const segs = Math.max(4, Math.floor(Math.max(w, h) * 0.2))
    const points: Point[] = []

    for (let i = 0; i <= segs; i++) {
      const t = i / segs
      points.push(applyWobble(s, cx - w / 2 + t * w, cy - h / 2, seedX, seedY))
    }
    for (let i = 1; i <= segs; i++) {
      const t = i / segs
      points.push(applyWobble(s, cx + w / 2, cy - h / 2 + t * h, seedX + 100, seedY))
    }
    for (let i = 1; i <= segs; i++) {
      const t = i / segs
      points.push(applyWobble(s, cx + w / 2 - t * w, cy + h / 2, seedX + 200, seedY))
    }
    for (let i = 1; i < segs; i++) {
      const t = i / segs
      points.push(applyWobble(s, cx - w / 2, cy + h / 2 - t * h, seedX + 300, seedY))
    }

    renderBrushPath(s, points, true, style)
  }

  function drawOrganicLine(
    s: PlotterSettings,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    seedX: number,
    seedY: number,
    style: ExportStyle,
  ) {
    const d = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    const segments = Math.max(4, Math.floor(d * 0.3))
    const points: Point[] = []

    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const px = x1 + (x2 - x1) * t
      const py = y1 + (y2 - y1) * t
      points.push(applyWobble(s, px, py, seedX + i * 0.2, seedY + i * 0.2))
    }

    if (s.brushType === 'normal' && s.strokeTaper > 0) {
      renderTaperedPath(s, points, style)
    } else {
      renderBrushPath(s, points, false, style)
    }
  }

  function drawOrganicPolygon(
    s: PlotterSettings,
    inputPoints: Point[],
    seedX: number,
    seedY: number,
    style: ExportStyle,
  ) {
    const segs = Math.max(3, Math.floor(s.wobble + s.roughness) + 2)
    const points: Point[] = []

    for (let i = 0; i < inputPoints.length; i++) {
      const p1 = inputPoints[i]
      const p2 = inputPoints[(i + 1) % inputPoints.length]

      for (let j = 0; j < segs; j++) {
        const t = j / segs
        const px = p1.x + (p2.x - p1.x) * t
        const py = p1.y + (p2.y - p1.y) * t
        points.push(applyWobble(s, px, py, seedX + i * 50 + j * 0.2, seedY + i * 50))
      }
    }

    renderBrushPath(s, points, true, style)
  }

  // ── Brush System ──

  function renderBrushPath(s: PlotterSettings, points: Point[], closed: boolean, style: ExportStyle) {
    if (points.length < 2) return

    switch (s.brushType) {
      case 'stippled':
        renderStippledPath(s, points, closed, style)
        break
      case 'multiStroke':
        renderMultiStrokePath(s, points, closed, style)
        break
      case 'calligraphic':
        renderCalligraphicPath(s, points, closed, style)
        break
      case 'stamp':
        renderStampPath(s, points, closed, style)
        break
      case 'normal':
      default:
        renderNormalPath(points, closed, style, s.strokeWeight)
        break
    }
  }

  function renderNormalPath(points: Point[], closed: boolean, style: ExportStyle, strokeWeight: number) {
    pushPathPrimitive(points, closed, style.color, strokeWeight, style.filled && closed)

    p.beginShape()
    for (const pt of points) {
      p.vertex(pt.x, pt.y)
    }
    p.endShape(closed ? p.CLOSE : undefined)
  }

  function renderTaperedPath(s: PlotterSettings, points: Point[], style: ExportStyle) {
    const baseWeight = s.strokeWeight
    const taper = s.strokeTaper
    p.noFill()
    p.stroke(style.color)

    for (let i = 0; i < points.length - 1; i++) {
      const t = (i + 0.5) / (points.length - 1)
      const taperAmount = Math.sin(t * Math.PI)
      const weight = baseWeight * (1 - taper + taper * taperAmount)
      pushPathPrimitive([points[i], points[i + 1]], false, style.color, weight, false)
      p.strokeWeight(weight)
      p.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y)
    }

    p.strokeWeight(baseWeight)
  }

  function renderStippledPath(s: PlotterSettings, points: Point[], closed: boolean, style: ExportStyle) {
    const spacing = s.stippled.dotSpacing
    const baseSize = s.stippled.dotSize
    const variation = s.stippled.sizeVariation
    const isDash = s.stippled.dash
    const dashLength = s.stippled.dashLength

    let accumulated = 0
    const totalPoints = closed ? points.length : points.length - 1

    for (let i = 0; i < totalPoints; i++) {
      const p1 = points[i]
      const p2 = points[(i + 1) % points.length]
      const segDist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)

      let pos = accumulated
      while (pos < segDist) {
        const t = pos / segDist
        const x = p1.x + (p2.x - p1.x) * t
        const y = p1.y + (p2.y - p1.y) * t
        const size = baseSize * (1 + (p.random() - 0.5) * variation * 2)

        if (isDash) {
          const dx = Math.cos(angle) * dashLength / 2
          const dy = Math.sin(angle) * dashLength / 2
          pushPathPrimitive([
            { x: x - dx, y: y - dy },
            { x: x + dx, y: y + dy },
          ], false, style.color, s.strokeWeight, false)
          p.push()
          p.stroke(style.color)
          p.strokeWeight(s.strokeWeight)
          p.line(x - dx, y - dy, x + dx, y + dy)
          p.pop()
        } else {
          pushShapePrimitive('circle', x, y, size, style.color, 0, true, 0)
          p.push()
          p.noStroke()
          p.fill(style.color)
          p.ellipse(x, y, size, size)
          p.pop()
        }

        pos += spacing
      }
      accumulated = pos - segDist
    }
  }

  function renderMultiStrokePath(s: PlotterSettings, points: Point[], closed: boolean, style: ExportStyle) {
    const count = s.multiStroke.count
    const spread = s.multiStroke.spread
    const variation = s.multiStroke.variation

    const normals = calculatePathNormals(points, closed)

    for (let si = 0; si < count; si++) {
      const baseOffset = count > 1 ? ((si / (count - 1)) - 0.5) * spread : 0
      const offsetPoints: Point[] = []

      p.beginShape()
      for (let i = 0; i < points.length; i++) {
        const pt = points[i]
        const n = normals[i]
        const varOffset = (p.random() - 0.5) * variation * spread
        const totalOffset = baseOffset + varOffset
        const offsetPoint = { x: pt.x + n.x * totalOffset, y: pt.y + n.y * totalOffset }
        offsetPoints.push(offsetPoint)
        p.vertex(offsetPoint.x, offsetPoint.y)
      }
      p.endShape(closed ? p.CLOSE : undefined)
      pushPathPrimitive(offsetPoints, closed, style.color, s.strokeWeight, style.filled && closed)
    }
  }

  function renderCalligraphicPath(s: PlotterSettings, points: Point[], _closed: boolean, style: ExportStyle) {
    const penAngle = (s.calligraphic.angle * Math.PI) / 180
    const minWidth = s.calligraphic.minWidth
    const maxWidth = s.calligraphic.maxWidth
    const smoothing = s.calligraphic.smoothing
    const baseWeight = s.strokeWeight

    const leftEdge: Point[] = []
    const rightEdge: Point[] = []
    let prevWidth: number | null = null

    for (let i = 0; i < points.length; i++) {
      let direction: number
      if (i === 0) {
        direction = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x)
      } else if (i === points.length - 1) {
        direction = Math.atan2(points[i].y - points[i - 1].y, points[i].x - points[i - 1].x)
      } else {
        direction = Math.atan2(points[i + 1].y - points[i - 1].y, points[i + 1].x - points[i - 1].x)
      }

      const angleDiff = Math.abs(Math.sin(direction - penAngle))
      let targetWidth = p.map(angleDiff, 0, 1, maxWidth, minWidth) * baseWeight

      if (prevWidth !== null) {
        targetWidth = prevWidth + (targetWidth - prevWidth) * (1 - smoothing)
      }
      prevWidth = targetWidth

      const perpAngle = direction + p.HALF_PI
      const ox = Math.cos(perpAngle) * targetWidth / 2
      const oy = Math.sin(perpAngle) * targetWidth / 2

      leftEdge.push({ x: points[i].x - ox, y: points[i].y - oy })
      rightEdge.push({ x: points[i].x + ox, y: points[i].y + oy })
    }

    // Capture calligraphic shape as a filled path for SVG
    const calliPoints: Point[] = [...leftEdge, ...rightEdge.slice().reverse()]
    pushPathPrimitive(calliPoints, true, style.color, 0, true)

    p.push()
    p.noStroke()
    p.fill(style.color)
    p.beginShape()
    for (const pt of leftEdge) p.vertex(pt.x, pt.y)
    for (let i = rightEdge.length - 1; i >= 0; i--) p.vertex(rightEdge[i].x, rightEdge[i].y)
    p.endShape(p.CLOSE)
    p.pop()
  }

  function renderStampPath(s: PlotterSettings, points: Point[], closed: boolean, style: ExportStyle) {
    const spacing = s.stamp.spacing
    const baseSize = s.stamp.size
    const sizeVar = s.stamp.sizeVariation
    const baseRotation = (s.stamp.rotation * Math.PI) / 180
    const rotVar = (s.stamp.rotationVariation * Math.PI) / 180
    const scatter = s.stamp.scatter
    const shape = s.stamp.shape

    let accumulated = 0
    const totalPoints = closed ? points.length : points.length - 1

    for (let i = 0; i < totalPoints; i++) {
      const p1 = points[i]
      const p2 = points[(i + 1) % points.length]
      const segDist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
      const perpAngle = angle + p.HALF_PI

      let pos = accumulated
      while (pos < segDist) {
        const t = pos / segDist
        let x = p1.x + (p2.x - p1.x) * t
        let y = p1.y + (p2.y - p1.y) * t

        if (scatter > 0) {
          const so = (p.random() - 0.5) * scatter * 2
          x += Math.cos(perpAngle) * so
          y += Math.sin(perpAngle) * so
        }

        const size = baseSize * (1 + (p.random() - 0.5) * sizeVar * 2)
        const rot = baseRotation + (p.random() - 0.5) * rotVar * 2

        pushShapePrimitive(shape, x, y, size, style.color, (rot * 180) / Math.PI, true, 0)
        drawStampShape(x, y, size, rot, shape, style.color)

        pos += spacing
      }
      accumulated = pos - segDist
    }
  }

  function drawStampShape(x: number, y: number, size: number, rotation: number, shape: string, color: string) {
    p.push()
    p.translate(x, y)
    p.rotate(rotation)
    p.noStroke()
    p.fill(color)

    switch (shape) {
      case 'circle':
        p.ellipse(0, 0, size, size)
        break
      case 'square':
        p.rectMode(p.CENTER)
        p.rect(0, 0, size, size)
        break
      case 'triangle': {
        const h = size * 0.866
        p.triangle(0, -h / 2, -size / 2, h / 2, size / 2, h / 2)
        break
      }
      case 'star':
        drawStar(0, 0, size / 4, size / 2, 5)
        break
      case 'cross': {
        const t = size / 4
        p.rectMode(p.CENTER)
        p.rect(0, 0, size, t)
        p.rect(0, 0, t, size)
        break
      }
    }
    p.pop()
  }

  function drawStar(x: number, y: number, r1: number, r2: number, npoints: number) {
    const angle = p.TWO_PI / npoints
    const halfAngle = angle / 2
    p.beginShape()
    for (let a = -p.HALF_PI; a < p.TWO_PI - p.HALF_PI; a += angle) {
      p.vertex(x + Math.cos(a) * r2, y + Math.sin(a) * r2)
      p.vertex(x + Math.cos(a + halfAngle) * r1, y + Math.sin(a + halfAngle) * r1)
    }
    p.endShape(p.CLOSE)
  }

  // ── Utilities ──

  function calculatePathNormals(points: Point[], closed: boolean): Point[] {
    const normals: Point[] = []

    for (let i = 0; i < points.length; i++) {
      let dx: number, dy: number

      if (closed) {
        const prev = points[(i - 1 + points.length) % points.length]
        const next = points[(i + 1) % points.length]
        dx = next.x - prev.x
        dy = next.y - prev.y
      } else {
        if (i === 0) {
          dx = points[1].x - points[0].x
          dy = points[1].y - points[0].y
        } else if (i === points.length - 1) {
          dx = points[i].x - points[i - 1].x
          dy = points[i].y - points[i - 1].y
        } else {
          dx = points[i + 1].x - points[i - 1].x
          dy = points[i + 1].y - points[i - 1].y
        }
      }

      const len = Math.sqrt(dx * dx + dy * dy) || 1
      normals.push({ x: -dy / len, y: dx / len })
    }

    return normals
  }

  function clipLineToRect(
    x1: number, y1: number, x2: number, y2: number,
    left: number, top: number, right: number, bottom: number
  ): { x1: number; y1: number; x2: number; y2: number } | null {
    const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8

    function computeCode(x: number, y: number): number {
      let code = INSIDE
      if (x < left) code |= LEFT
      else if (x > right) code |= RIGHT
      if (y < top) code |= TOP
      else if (y > bottom) code |= BOTTOM
      return code
    }

    let code1 = computeCode(x1, y1)
    let code2 = computeCode(x2, y2)

    while (true) {
      if (!(code1 | code2)) {
        return { x1, y1, x2, y2 }
      } else if (code1 & code2) {
        return null
      } else {
        let x = 0, y = 0
        const codeOut = code1 ? code1 : code2

        if (codeOut & TOP) {
          x = x1 + (x2 - x1) * (top - y1) / (y2 - y1)
          y = top
        } else if (codeOut & BOTTOM) {
          x = x1 + (x2 - x1) * (bottom - y1) / (y2 - y1)
          y = bottom
        } else if (codeOut & RIGHT) {
          y = y1 + (y2 - y1) * (right - x1) / (x2 - x1)
          x = right
        } else if (codeOut & LEFT) {
          y = y1 + (y2 - y1) * (left - x1) / (x2 - x1)
          x = left
        }

        if (codeOut === code1) {
          x1 = x; y1 = y
          code1 = computeCode(x1, y1)
        } else {
          x2 = x; y2 = y
          code2 = computeCode(x2, y2)
        }
      }
    }
  }

  // ── Texture ──

  function drawTexture(s: PlotterSettings) {
    const intensity = s.textureAmount / 100
    if (intensity <= 0) return

    p.randomSeed(s.seed + 9999)
    drawPaperFibers(s, intensity)
    drawGrain(intensity)
    p.randomSeed(s.seed)
  }

  function drawPaperFibers(s: PlotterSettings, intensity: number) {
    const c = ctx()

    // Detect light vs dark bg by parsing hex to luminance
    const hex = s.bgColor.replace('#', '')
    const br = parseInt(hex.substring(0, 2), 16)
    const bg = parseInt(hex.substring(2, 4), 16)
    const bb = parseInt(hex.substring(4, 6), 16)
    const isLight = (br * 0.299 + bg * 0.587 + bb * 0.114) > 128
    const base = isLight ? 0 : 255

    const sizeScale = s.textureSize
    const fiberCount = Math.floor((p.width * p.height / 5000) * intensity)
    const scratchCount = Math.floor((p.width * p.height / 15000) * intensity)

    // Fibers — subtle curved lines
    for (let i = 0; i < fiberCount; i++) {
      const x = Math.random() * p.width
      const y = Math.random() * p.height
      const len = (Math.random() * 30 + 10) * sizeScale
      const alpha = (Math.random() * 30 + 20) * intensity / 255

      c.strokeStyle = `rgba(${base},${base},${base},${alpha})`
      c.lineWidth = (Math.random() * 0.7 + 0.5) * sizeScale

      const angle = (Math.random() - 0.5) * 0.4
      const curve = (Math.random() - 0.5) * 8

      const x2 = x + Math.cos(angle) * len
      const y2 = y + Math.sin(angle) * len
      const cx = (x + x2) / 2
      const cy = (y + y2) / 2 + curve

      c.beginPath()
      c.moveTo(x, y)
      c.quadraticCurveTo(cx, cy, x2, y2)
      c.stroke()
    }

    // Scratches — longer random-angle lines
    for (let i = 0; i < scratchCount; i++) {
      const x = Math.random() * p.width
      const y = Math.random() * p.height
      const len = (Math.random() * 60 + 20) * sizeScale
      const alpha = (Math.random() * 20 + 15) * intensity / 255

      c.strokeStyle = `rgba(${base},${base},${base},${alpha})`
      c.lineWidth = (Math.random() * 0.4 + 0.3) * sizeScale

      const angle = Math.random() * Math.PI * 2
      c.beginPath()
      c.moveTo(x, y)
      c.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len)
      c.stroke()
    }
  }

  function drawGrain(intensity: number) {
    const c = ctx()
    const d = p.pixelDensity()
    const w = p.width * d
    const h = p.height * d
    const imageData = c.getImageData(0, 0, w, h)
    const data = imageData.data
    const grainIntensity = intensity * 255

    for (let idx = 0, len = w * h; idx < len; idx++) {
      const i = idx * 4
      const v = (Math.random() - 0.5) * grainIntensity
      data[i] = Math.max(0, Math.min(255, data[i] + v))
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + v))
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + v))
    }

    c.putImageData(imageData, 0, 0)
  }
}
