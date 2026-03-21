import type p5 from 'p5'
import type { RefObject } from 'react'
import type { TopoSettings, Point, ContourPath, TopoGeometry } from './types'
import { hexToRgb } from '@/lib/color'
import { resolveCanvasSize } from '@/lib/canvas-size'

const GRID_SIZE = 200

export const PALETTES: Record<string, string[]> = {
  mono: ['#000000', '#333333', '#666666', '#999999', '#cccccc'],
  topo: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
  ocean: ['#03045e', '#0077b6', '#00b4d8', '#90e0ef', '#caf0f8'],
  earth: ['#606c38', '#283618', '#fefae0', '#dda15e', '#bc6c25'],
  sunset: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'],
  forest: ['#1b4332', '#2d6a4f', '#40916c', '#52b788', '#74c69d'],
  heat: ['#03071e', '#370617', '#6a040f', '#d00000', '#dc2f02', '#e85d04', '#f48c06', '#faa307', '#ffba08'],
}

interface Segment {
  p1: Point
  p2: Point
  level: number
}

export function createTopoSketch(
  p: p5,
  settingsRef: RefObject<TopoSettings>,
  geometryRef?: RefObject<TopoGeometry | null>,
) {
  let elevationField: number[][] = []
  let contours: ContourPath[] = []
  const ctx = () => p.drawingContext as CanvasRenderingContext2D

  // Cache key for terrain params — skip expensive recomputation when only visual settings change
  let cachedTerrainKey = ''

  function terrainKey(s: TopoSettings): string {
    return `${s.seed}|${s.contourLevels}|${s.noiseScale}|${s.octaves}|${s.falloff}|${s.canvasPreset}|${s.customWidth}|${s.customHeight}`
  }

  p.setup = () => {
    const s = settingsRef.current
    const [w, h] = resolveCanvasSize(s.canvasPreset, s.customWidth, s.customHeight)
    p.createCanvas(w, h)
    p.pixelDensity(1)
    p.colorMode(p.RGB, 255)
    p.noLoop()
    redrawCanvas()
  }

  p.draw = () => {
    redrawCanvas()
  }

  function redrawCanvas() {
    const s = settingsRef.current
    const [tw, th] = resolveCanvasSize(s.canvasPreset, s.customWidth, s.customHeight)
    if (p.width !== tw || p.height !== th) {
      p.resizeCanvas(tw, th)
      cachedTerrainKey = ''
    }
    p.colorMode(p.RGB, 255)
    p.background(s.bgColor)

    const tk = terrainKey(s)
    if (tk !== cachedTerrainKey) {
      p.randomSeed(s.seed)
      p.noiseSeed(s.seed)
      generateElevationField()
      extractContours()
      cachedTerrainKey = tk
    }

    const pad = s.margin
    if (pad > 0) {
      ctx().save()
      ctx().beginPath()
      ctx().rect(pad, pad, p.width - pad * 2, p.height - pad * 2)
      ctx().clip()
    }

    // Reset seeds for deterministic texture effects
    p.randomSeed(s.seed)
    p.noiseSeed(s.seed)
    renderContours()

    if (pad > 0) {
      ctx().restore()
    }

    if (s.grain > 0) {
      applyGrain()
    }
  }

  function generateElevationField() {
    const s = settingsRef.current
    elevationField = []
    const scale = s.noiseScale
    p.noiseDetail(s.octaves, s.falloff)

    for (let y = 0; y <= GRID_SIZE; y++) {
      elevationField[y] = []
      for (let x = 0; x <= GRID_SIZE; x++) {
        const nx = x / GRID_SIZE
        const ny = y / GRID_SIZE
        elevationField[y][x] = p.noise(nx / scale * 0.1, ny / scale * 0.1)
      }
    }
  }

  function extractContours() {
    const s = settingsRef.current
    contours = []
    const levels = s.contourLevels

    for (let level = 0; level < levels; level++) {
      const threshold = (level + 1) / (levels + 1)
      const levelContours = marchingSquares(threshold, level / levels)
      contours.push(...levelContours)
    }
  }

  function marchingSquares(threshold: number, normalizedLevel: number): ContourPath[] {
    const segments: Segment[] = []
    const cellWidth = p.width / GRID_SIZE
    const cellHeight = p.height / GRID_SIZE

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const tl = elevationField[y][x]
        const tr = elevationField[y][x + 1]
        const br = elevationField[y + 1][x + 1]
        const bl = elevationField[y + 1][x]

        let caseIndex = 0
        if (tl >= threshold) caseIndex |= 8
        if (tr >= threshold) caseIndex |= 4
        if (br >= threshold) caseIndex |= 2
        if (bl >= threshold) caseIndex |= 1

        if (caseIndex === 0 || caseIndex === 15) continue

        const cellX = x * cellWidth
        const cellY = y * cellHeight

        const top = p.lerp(cellX, cellX + cellWidth, (threshold - tl) / (tr - tl))
        const right = p.lerp(cellY, cellY + cellHeight, (threshold - tr) / (br - tr))
        const bottom = p.lerp(cellX, cellX + cellWidth, (threshold - bl) / (br - bl))
        const left = p.lerp(cellY, cellY + cellHeight, (threshold - tl) / (bl - tl))

        const pts = getMarchingSquaresPoints(caseIndex, cellX, cellY, cellWidth, cellHeight, top, right, bottom, left)

        for (const seg of pts) {
          segments.push({ p1: seg.p1, p2: seg.p2, level: normalizedLevel })
        }
      }
    }

    return connectSegments(segments)
  }

  function getMarchingSquaresPoints(
    caseIndex: number, cx: number, cy: number, cw: number, ch: number,
    top: number, right: number, bottom: number, left: number,
  ): { p1: Point; p2: Point }[] {
    const segments: { p1: Point; p2: Point }[] = []
    const topPt: Point = { x: top, y: cy }
    const rightPt: Point = { x: cx + cw, y: right }
    const bottomPt: Point = { x: bottom, y: cy + ch }
    const leftPt: Point = { x: cx, y: left }

    switch (caseIndex) {
      case 1: segments.push({ p1: leftPt, p2: bottomPt }); break
      case 2: segments.push({ p1: bottomPt, p2: rightPt }); break
      case 3: segments.push({ p1: leftPt, p2: rightPt }); break
      case 4: segments.push({ p1: topPt, p2: rightPt }); break
      case 5:
        segments.push({ p1: leftPt, p2: topPt })
        segments.push({ p1: bottomPt, p2: rightPt })
        break
      case 6: segments.push({ p1: topPt, p2: bottomPt }); break
      case 7: segments.push({ p1: leftPt, p2: topPt }); break
      case 8: segments.push({ p1: topPt, p2: leftPt }); break
      case 9: segments.push({ p1: topPt, p2: bottomPt }); break
      case 10:
        segments.push({ p1: topPt, p2: rightPt })
        segments.push({ p1: leftPt, p2: bottomPt })
        break
      case 11: segments.push({ p1: topPt, p2: rightPt }); break
      case 12: segments.push({ p1: leftPt, p2: rightPt }); break
      case 13: segments.push({ p1: bottomPt, p2: rightPt }); break
      case 14: segments.push({ p1: leftPt, p2: bottomPt }); break
    }

    return segments
  }

  function connectSegments(segments: Segment[]): ContourPath[] {
    if (segments.length === 0) return []

    // Spatial hash for O(1) endpoint lookups instead of O(n) scanning
    function pointKey(pt: Point): string {
      return `${Math.round(pt.x * 2)},${Math.round(pt.y * 2)}`
    }

    // Build adjacency: map from point key → list of {segIndex, whichEnd}
    const adj = new Map<string, { idx: number; end: 1 | 2 }[]>()
    function addToAdj(key: string, idx: number, end: 1 | 2) {
      let list = adj.get(key)
      if (!list) { list = []; adj.set(key, list) }
      list.push({ idx, end })
    }
    for (let i = 0; i < segments.length; i++) {
      addToAdj(pointKey(segments[i].p1), i, 1)
      addToAdj(pointKey(segments[i].p2), i, 2)
    }

    const used = new Set<number>()
    const paths: ContourPath[] = []

    for (let i = 0; i < segments.length; i++) {
      if (used.has(i)) continue
      used.add(i)

      const points: Point[] = [segments[i].p1, segments[i].p2]
      const level = segments[i].level

      // Extend forward from the end
      let searching = true
      while (searching) {
        searching = false
        const endKey = pointKey(points[points.length - 1])
        const candidates = adj.get(endKey)
        if (candidates) {
          for (const c of candidates) {
            if (used.has(c.idx)) continue
            used.add(c.idx)
            const seg = segments[c.idx]
            points.push(c.end === 1 ? seg.p2 : seg.p1)
            searching = true
            break
          }
        }
      }

      // Extend backward from the start
      searching = true
      while (searching) {
        searching = false
        const startKey = pointKey(points[0])
        const candidates = adj.get(startKey)
        if (candidates) {
          for (const c of candidates) {
            if (used.has(c.idx)) continue
            used.add(c.idx)
            const seg = segments[c.idx]
            points.unshift(c.end === 2 ? seg.p1 : seg.p2)
            searching = true
            break
          }
        }
      }

      if (points.length >= 2) {
        paths.push({ points, level })
      }
    }

    return paths
  }

  function renderContours() {
    const s = settingsRef.current
    p.noFill()
    p.strokeCap(p.ROUND)
    p.strokeJoin(p.ROUND)

    const renderedContours: ContourPath[] = []

    for (const contour of contours) {
      const rendered = renderContour(contour, s)
      if (rendered) renderedContours.push(rendered)
    }

    if (geometryRef) {
      geometryRef.current = { contours: renderedContours, width: p.width, height: p.height }
    }
  }

  function renderContour(contour: ContourPath, s: TopoSettings): ContourPath | null {
    if (contour.points.length < 2) return null

    if (s.colorMode === 'single') {
      const rgb = hexToRgb(s.lineColor || '#222222')
      const alpha = s.opacity / 100
      const r = rgb?.r ?? 34
      const g = rgb?.g ?? 34
      const b = rgb?.b ?? 34
      ctx().strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
    } else {
      const col = getContourColor(contour.level, s)
      p.stroke(col)
    }
    p.strokeWeight(s.strokeWeight)

    let points = contour.points

    if (s.wobble > 0 || s.roughness > 0) {
      points = applyTextureEffects(points, contour.level, s)
    }

    if (s.smoothing > 0 && points.length > 2) {
      drawSmoothPath(points)
    } else {
      drawPath(points)
    }

    return { points, level: contour.level }
  }

  function getContourColor(level: number, s: TopoSettings): p5.Color {
    const alpha = s.opacity / 100 * 255

    switch (s.colorMode) {
      case 'elevation': {
        const lowRgb = hexToRgb(s.lineColor) ?? { r: 34, g: 34, b: 34 }
        const highRgb = hexToRgb(s.bgColor) ?? { r: 255, g: 255, b: 255 }
        const lowColor = p.color(lowRgb.r, lowRgb.g, lowRgb.b)
        const highColor = p.color(highRgb.r, highRgb.g, highRgb.b)
        const elevColor = p.lerpColor(lowColor, highColor, level * 0.7)
        elevColor.setAlpha(alpha)
        return elevColor
      }
      case 'palette': {
        const pal = PALETTES[s.palette] || PALETTES.mono
        const palIndex = Math.floor(level * (pal.length - 1))
        const palT = (level * (pal.length - 1)) % 1
        const rgb1 = hexToRgb(pal[Math.min(palIndex, pal.length - 1)]) ?? { r: 0, g: 0, b: 0 }
        const rgb2 = hexToRgb(pal[Math.min(palIndex + 1, pal.length - 1)]) ?? { r: 0, g: 0, b: 0 }
        const c1 = p.color(rgb1.r, rgb1.g, rgb1.b)
        const c2 = p.color(rgb2.r, rgb2.g, rgb2.b)
        const palColor = p.lerpColor(c1, c2, palT)
        palColor.setAlpha(alpha)
        return palColor
      }
      default: {
        const rgb = hexToRgb(s.lineColor) ?? { r: 34, g: 34, b: 34 }
        return p.color(rgb.r, rgb.g, rgb.b, alpha)
      }
    }
  }

  function applyTextureEffects(points: Point[], seed: number, s: TopoSettings): Point[] {
    const result: Point[] = []
    const wobbleAmt = s.wobble * 0.5
    const roughAmt = s.roughness * 0.3

    for (let i = 0; i < points.length; i++) {
      let { x, y } = points[i]

      if (wobbleAmt > 0) {
        const wobbleScale = 0.03
        const wx = p.noise(i * wobbleScale + seed * 100, 0) * wobbleAmt - wobbleAmt / 2
        const wy = p.noise(i * wobbleScale + seed * 100, 100) * wobbleAmt - wobbleAmt / 2
        x += wx
        y += wy
      }

      if (roughAmt > 0) {
        x += p.random(-roughAmt, roughAmt)
        y += p.random(-roughAmt, roughAmt)
      }

      result.push({ x, y })
    }

    return result
  }

  function drawPath(points: Point[]) {
    p.beginShape()
    for (const pt of points) {
      p.vertex(pt.x, pt.y)
    }
    p.endShape()
  }

  function drawSmoothPath(points: Point[]) {
    const s = settingsRef.current
    const smoothFactor = s.smoothing / 100

    if (smoothFactor < 0.1 || points.length < 3) {
      drawPath(points)
      return
    }

    p.beginShape()
    p.splineVertex(points[0].x, points[0].y)
    for (const pt of points) {
      p.splineVertex(pt.x, pt.y)
    }
    p.splineVertex(points[points.length - 1].x, points[points.length - 1].y)
    p.endShape()
  }

  function applyGrain() {
    const s = settingsRef.current
    const c = ctx()
    const d = p.pixelDensity()
    const w = p.width * d
    const h = p.height * d
    const imageData = c.getImageData(0, 0, w, h)
    const data = imageData.data
    const strength = s.grain

    for (let i = 0; i < data.length; i += 4) {
      const v = ((Math.random() - 0.5) * strength) | 0
      data[i]     = data[i]     + v < 0 ? 0 : data[i]     + v > 255 ? 255 : data[i]     + v
      data[i + 1] = data[i + 1] + v < 0 ? 0 : data[i + 1] + v > 255 ? 255 : data[i + 1] + v
      data[i + 2] = data[i + 2] + v < 0 ? 0 : data[i + 2] + v > 255 ? 255 : data[i + 2] + v
    }
    c.putImageData(imageData, 0, 0)
  }
}
