import type p5 from 'p5'
import type { RefObject } from 'react'
import type { BlocksSettings, RectBlock, PolyBlock, BlocksGeometry } from './types'
import { seededRandom } from '@/lib/math'
import { resolveCanvasSize } from '@/lib/canvas-size'

export const PALETTES: Record<string, string[]> = {
  mondrian: ['#c92a2a', '#1862a8', '#f4d03f', '#ffffff', '#ffffff'],
  'neo-mondrian': ['#e63946', '#457b9d', '#f1c453', '#f1faee', '#a8dadc'],
  warm: ['#d64045', '#e8985e', '#f4d35e', '#fffffc', '#fffffc'],
  cool: ['#264653', '#2a9d8f', '#e9c46a', '#f4f1de', '#f4f1de'],
  monochrome: ['#212529', '#495057', '#adb5bd', '#f8f9fa', '#ffffff'],
}

export function pickColor(rng: () => number, colorDensity: number, colors: string[]): string {
  if (rng() < colorDensity) {
    return colors[Math.floor(rng() * 3) % colors.length]
  }
  return colors[Math.floor(rng() * 2 + 3) % colors.length]
}

export function createBlocksSketch(p: p5, settingsRef: RefObject<BlocksSettings>, geometryRef?: RefObject<BlocksGeometry | null>) {
  const ctx = () => p.drawingContext as CanvasRenderingContext2D

  // Cached geometry
  let cachedRects: RectBlock[] = []
  let cachedPolys: PolyBlock[] = []
  let cachedLayoutKey = ''

  // Pre-effects canvas cache — avoids redrawing geometry when only effects change,
  // and avoids re-running effects when only geometry changes with same effect params.
  let preEffectsCanvas: OffscreenCanvas | null = null
  let cachedDrawKey = ''
  let cachedNoiseMap: Float32Array | null = null
  let cachedNoiseMapW = 0
  let cachedNoiseMapDims = ''

  function layoutKey(s: BlocksSettings): string {
    return `${s.seed}|${s.patternType}|${s.blockCount}|${s.complexity}|${s.asymmetry}|${s.gridDivisions}|${s.canvasPreset}|${s.customWidth}|${s.customHeight}`
  }

  // Everything that affects the drawn geometry (before effects)
  function drawKey(s: BlocksSettings): string {
    return `${layoutKey(s)}|${s.bgColor}|${s.colors.join(',')}|${s.colorDensity}|${s.lineWeight}|${s.lineColor}|${s.edgeWobble}|${s.rotation}`
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

    // Resize canvas if needed
    const [tw, th] = resolveCanvasSize(s.canvasPreset, s.customWidth, s.customHeight)
    if (p.width !== tw || p.height !== th) {
      p.resizeCanvas(tw, th)
      p.colorMode(p.RGB, 255)
      cachedLayoutKey = '' // force recompute
      cachedDrawKey = '' // force geometry redraw
    }

    const dk = drawKey(s)
    const needsGeometryRedraw = dk !== cachedDrawKey

    if (needsGeometryRedraw) {
      const c = ctx()

      // Use p.background() to clear — it resets p5's internal transform state
      p.background(s.bgColor)

      // Recompute layout if cache key changed
      const lk = layoutKey(s)
      if (lk !== cachedLayoutKey) {
        computeLayout(s)
        cachedLayoutKey = lk
      }

      // Expose geometry for SVG export
      if (geometryRef) {
        geometryRef.current = { rects: cachedRects, polys: cachedPolys, width: p.width, height: p.height }
      }

      // Assign colors deterministically
      const colorRng = seededRandom(s.seed + 7)
      const colorDensity = s.colorDensity / 100
      const wobble = s.edgeWobble / 100

      // Apply rotation via Canvas 2D
      c.save()
      c.translate(p.width / 2, p.height / 2)
      c.rotate(s.rotation * Math.PI / 180)
      c.translate(-p.width / 2, -p.height / 2)

      if (s.patternType === 'diagonal') {
        const drawRng = seededRandom(s.seed + 13)
        for (const poly of cachedPolys) {
          const blockColor = pickColor(colorRng, colorDensity, s.colors)
          drawPaintedPolygon(c, poly.points, blockColor, wobble, drawRng)
        }
        if (s.lineWeight > 0) {
          const outlineRng = seededRandom(s.seed + 19)
          c.strokeStyle = s.lineColor
          c.lineWidth = s.lineWeight
          for (const poly of cachedPolys) {
            c.beginPath()
            for (let k = 0; k < poly.points.length; k++) {
              const pt = poly.points[k]
              const px = pt.x + (outlineRng() - 0.5) * wobble * 4
              const py = pt.y + (outlineRng() - 0.5) * wobble * 4
              if (k === 0) c.moveTo(px, py)
              else c.lineTo(px, py)
            }
            c.closePath()
            c.stroke()
          }
        }
      } else {
        const drawRng = seededRandom(s.seed + 13)
        for (const rect of cachedRects) {
          const blockColor = pickColor(colorRng, colorDensity, s.colors)
          drawPaintedBlock(c, rect, blockColor, wobble, drawRng)
        }
        if (s.lineWeight > 0) {
          const outlineRng = seededRandom(s.seed + 19)
          c.strokeStyle = s.lineColor
          c.lineWidth = s.lineWeight
          for (const rect of cachedRects) {
            drawWobblyRectOutline(c, rect, wobble, outlineRng)
          }
        }
      }

      c.restore()

      // Snapshot pre-effects state to offscreen canvas
      const d = p.pixelDensity()
      const pw = p.width * d
      const ph = p.height * d
      if (!preEffectsCanvas || preEffectsCanvas.width !== pw || preEffectsCanvas.height !== ph) {
        preEffectsCanvas = new OffscreenCanvas(pw, ph)
      }
      preEffectsCanvas.getContext('2d')!.drawImage(c.canvas, 0, 0)
      cachedDrawKey = dk
    } else {
      // Geometry hasn't changed — restore from cache
      const c = ctx()
      c.drawImage(preEffectsCanvas!, 0, 0)
    }

    // Post-processing effects
    if (s.texture > 0 || s.grain > 0 || s.halftone > 0) {
      applyEffects(s)
    }
  }

  function computeLayout(s: BlocksSettings) {
    cachedRects = []
    cachedPolys = []
    const rng = seededRandom(s.seed)

    switch (s.patternType) {
      case 'mondrian':
        cachedRects = generateMondrian(rng, s)
        break
      case 'grid':
        cachedRects = generateGrid(rng, s)
        break
      case 'horizontal':
        cachedRects = generateHorizontal(rng, s)
        break
      case 'diagonal':
        cachedPolys = generateDiagonal(rng, s)
        break
    }
  }

  // --- Pattern generators (geometry only, no colors) ---

  function generateMondrian(rng: () => number, s: BlocksSettings): RectBlock[] {
    const blocks: RectBlock[] = []
    const asymmetry = s.asymmetry / 100

    function subdivide(x: number, y: number, w: number, h: number, depth: number) {
      if (depth <= 0 || w < 50 || h < 50) {
        blocks.push({ x, y, w, h })
        return
      }

      const splitVertical = w > h
        ? rng() < 0.5 + asymmetry * 0.3
        : rng() < 0.5 - asymmetry * 0.3

      if (splitVertical && w > 80) {
        const minSplit = 0.2 + (1 - asymmetry) * 0.15
        const maxSplit = 0.8 - (1 - asymmetry) * 0.15
        const split = rng() * (maxSplit - minSplit) + minSplit
        const w1 = w * split
        subdivide(x, y, w1, h, depth - 1)
        subdivide(x + w1, y, w - w1, h, depth - 1)
      } else if (h > 80) {
        const minSplit = 0.2 + (1 - asymmetry) * 0.15
        const maxSplit = 0.8 - (1 - asymmetry) * 0.15
        const split = rng() * (maxSplit - minSplit) + minSplit
        const h1 = h * split
        subdivide(x, y, w, h1, depth - 1)
        subdivide(x, y + h1, w, h - h1, depth - 1)
      } else {
        blocks.push({ x, y, w, h })
      }
    }

    subdivide(0, 0, p.width, p.height, s.complexity + 2)
    return blocks
  }

  function generateGrid(rng: () => number, s: BlocksSettings): RectBlock[] {
    const divisions = s.gridDivisions
    const cellW = p.width / divisions
    const cellH = p.height / divisions
    const occupied: boolean[][] = Array.from({ length: divisions }, () =>
      Array(divisions).fill(false) as boolean[],
    )
    const blocks: RectBlock[] = []

    // Place larger blocks
    const numLarge = s.blockCount
    for (let i = 0; i < numLarge; i++) {
      const col = Math.floor(rng() * divisions)
      const row = Math.floor(rng() * divisions)
      if (occupied[row][col]) continue

      let spanW = 1
      let spanH = 1
      if (rng() > 0.4) spanW = Math.min(Math.floor(rng() * 2 + 2), divisions - col)
      if (rng() > 0.4) spanH = Math.min(Math.floor(rng() * 2 + 2), divisions - row)

      let canPlace = true
      for (let r = row; r < row + spanH && canPlace; r++) {
        for (let c = col; c < col + spanW && canPlace; c++) {
          if (occupied[r]?.[c]) canPlace = false
        }
      }

      if (canPlace) {
        for (let r = row; r < row + spanH; r++) {
          for (let c = col; c < col + spanW; c++) {
            occupied[r][c] = true
          }
        }
        blocks.push({ x: col * cellW, y: row * cellH, w: spanW * cellW, h: spanH * cellH })
      }
    }

    // Fill remaining cells
    for (let row = 0; row < divisions; row++) {
      for (let col = 0; col < divisions; col++) {
        if (!occupied[row][col]) {
          blocks.push({ x: col * cellW, y: row * cellH, w: cellW, h: cellH })
        }
      }
    }

    return blocks
  }

  function generateHorizontal(rng: () => number, s: BlocksSettings): RectBlock[] {
    const numBands = s.blockCount + 2
    const asymmetry = s.asymmetry / 100
    const blocks: RectBlock[] = []
    let y = 0

    for (let i = 0; i < numBands; i++) {
      const minH = p.height / numBands * 0.3
      const maxH = p.height / numBands * (1 + asymmetry)
      const h = Math.min(rng() * (maxH - minH) + minH, p.height - y)
      if (h <= 0) break

      let x = 0
      const numCols = Math.floor(rng() * s.complexity) + 1
      for (let j = 0; j < numCols; j++) {
        const w = j === numCols - 1
          ? p.width - x
          : rng() * (p.width / numCols) + (p.width / numCols * 0.5)
        blocks.push({ x, y, w: Math.min(w, p.width - x), h })
        x += w
        if (x >= p.width) break
      }

      y += h
      if (y >= p.height) break
    }

    return blocks
  }

  function generateDiagonal(rng: () => number, s: BlocksSettings): PolyBlock[] {
    const blocks: PolyBlock[] = []
    const numStrips = s.complexity + 3
    const stripWidth = (p.width + p.height) / numStrips

    for (let i = 0; i < numStrips; i++) {
      const numSections = Math.floor(rng() * s.complexity) + 1
      const sectionHeight = p.height / numSections

      for (let j = 0; j < numSections; j++) {
        const x1 = i * stripWidth - p.height + j * sectionHeight
        const y1 = j * sectionHeight
        const x2 = x1 + stripWidth
        const y2 = y1 + sectionHeight

        blocks.push({
          points: [
            { x: x1, y: y1 },
            { x: x2, y: y1 },
            { x: x2 + sectionHeight, y: y2 },
            { x: x1 + sectionHeight, y: y2 },
          ],
        })
      }
    }

    return blocks
  }

  // --- Drawing helpers (Canvas 2D API for performance) ---

  function drawPaintedBlock(
    c: CanvasRenderingContext2D,
    rect: RectBlock,
    blockColor: string,
    wobble: number,
    rng: () => number,
  ) {
    c.fillStyle = blockColor

    if (wobble <= 0) {
      c.fillRect(rect.x, rect.y, rect.w, rect.h)
      return
    }

    const maxWobble = wobble * 4
    const mw2 = maxWobble * 2
    const segments = 15
    c.beginPath()
    // Top edge
    c.moveTo(rect.x, rect.y + (rng() - 0.5) * mw2)
    for (let i = 1; i <= segments; i++) {
      c.lineTo(
        rect.x + (rect.w * i) / segments,
        rect.y + (rng() - 0.5) * mw2,
      )
    }
    // Right edge
    for (let i = 1; i <= segments; i++) {
      c.lineTo(
        rect.x + rect.w + (rng() - 0.5) * mw2,
        rect.y + (rect.h * i) / segments,
      )
    }
    // Bottom edge
    for (let i = 1; i <= segments; i++) {
      c.lineTo(
        rect.x + rect.w - (rect.w * i) / segments,
        rect.y + rect.h + (rng() - 0.5) * mw2,
      )
    }
    // Left edge
    for (let i = 1; i < segments; i++) {
      c.lineTo(
        rect.x + (rng() - 0.5) * mw2,
        rect.y + rect.h - (rect.h * i) / segments,
      )
    }
    c.closePath()
    c.fill()
  }

  function drawPaintedPolygon(
    c: CanvasRenderingContext2D,
    originalPoints: { x: number; y: number }[],
    blockColor: string,
    wobble: number,
    rng: () => number,
  ) {
    c.fillStyle = blockColor

    if (wobble <= 0) {
      c.beginPath()
      c.moveTo(originalPoints[0].x, originalPoints[0].y)
      for (let k = 1; k < originalPoints.length; k++) {
        c.lineTo(originalPoints[k].x, originalPoints[k].y)
      }
      c.closePath()
      c.fill()
      return
    }

    const maxWobble = wobble * 4
    const mw2 = maxWobble * 2
    const segments = 10
    c.beginPath()
    let first = true
    for (let i = 0; i < originalPoints.length; i++) {
      const p1 = originalPoints[i]
      const p2 = originalPoints[(i + 1) % originalPoints.length]
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      for (let j = 0; j < segments; j++) {
        const t = j / segments
        const vx = p1.x + dx * t + (rng() - 0.5) * mw2
        const vy = p1.y + dy * t + (rng() - 0.5) * mw2
        if (first) { c.moveTo(vx, vy); first = false }
        else c.lineTo(vx, vy)
      }
    }
    c.closePath()
    c.fill()
  }

  function drawWobblyRectOutline(
    c: CanvasRenderingContext2D,
    rect: RectBlock,
    wobble: number,
    rng: () => number,
  ) {
    const w4 = wobble * 4
    c.beginPath()
    // Top edge
    c.moveTo(
      rect.x + (rng() - 0.5) * w4,
      rect.y + (rng() - 0.5) * w4,
    )
    for (let i = 1; i <= 10; i++) {
      c.lineTo(
        rect.x + (rect.w * i) / 10 + (rng() - 0.5) * w4,
        rect.y + (rng() - 0.5) * w4,
      )
    }
    // Right edge
    for (let i = 0; i <= 10; i++) {
      c.lineTo(
        rect.x + rect.w + (rng() - 0.5) * w4,
        rect.y + (rect.h * i) / 10 + (rng() - 0.5) * w4,
      )
    }
    // Bottom edge
    for (let i = 0; i <= 10; i++) {
      c.lineTo(
        rect.x + rect.w - (rect.w * i) / 10 + (rng() - 0.5) * w4,
        rect.y + rect.h + (rng() - 0.5) * w4,
      )
    }
    // Right-to-left on bottom already handled, now left edge going up
    for (let i = 0; i <= 10; i++) {
      c.lineTo(
        rect.x + (rng() - 0.5) * w4,
        rect.y + rect.h - (rect.h * i) / 10 + (rng() - 0.5) * w4,
      )
    }
    c.closePath()
    c.stroke()
  }

  // --- Post-processing effects ---

  function applyEffects(s: BlocksSettings) {
    const c = ctx()
    const d = p.pixelDensity()
    const w = p.width * d
    const h = p.height * d
    const imageData = c.getImageData(0, 0, w, h)
    const data = imageData.data

    const textureStrength = s.texture / 100
    const grainStrength = s.grain / 100
    const halftoneStrength = s.halftone / 100

    // Texture + grain pass
    if (textureStrength > 0 || grainStrength > 0) {
      const textureVariation = textureStrength * 50
      const grainVariation = grainStrength * 35

      // Noise map only depends on canvas dimensions (always seeded with 42).
      // Cache it so dragging texture/grain sliders doesn't recompute Perlin noise.
      let noiseMap: Float32Array | null = null
      let nmW = 0
      if (textureStrength > 0) {
        const dims = `${w}|${h}|${d}`
        if (cachedNoiseMap && cachedNoiseMapDims === dims) {
          noiseMap = cachedNoiseMap
          nmW = cachedNoiseMapW
        } else {
          p.noiseSeed(42)
          const step = 2
          nmW = Math.ceil(w / (d * step))
          const nmH = Math.ceil(h / (d * step))
          noiseMap = new Float32Array(nmW * nmH)
          for (let ny = 0; ny < nmH; ny++) {
            const py = ny * step
            for (let nx = 0; nx < nmW; nx++) {
              const px = nx * step
              const fine = p.noise(px * 0.5, py * 0.5) - 0.5
              const med = p.noise(px * 0.08 + 100, py * 0.08 + 100) - 0.5
              const coarse = p.noise(px * 0.02 + 200, py * 0.02 + 200) - 0.5
              noiseMap[ny * nmW + nx] = (fine * 0.4 + med * 0.35 + coarse * 0.25) * 2
            }
          }
          cachedNoiseMap = noiseMap
          cachedNoiseMapW = nmW
          cachedNoiseMapDims = dims
        }
      }

      const invD2 = 1 / (d * 2)
      const hasGrain = grainStrength > 0
      const grainScale = grainVariation * 2

      for (let y = 0; y < h; y++) {
        const rowOffset = y * w * 4
        const ny = (y * invD2) | 0
        const noiseRowOffset = ny * nmW
        for (let x = 0; x < w; x++) {
          const i = rowOffset + x * 4
          let variation = 0

          if (noiseMap) {
            const nx = (x * invD2) | 0
            variation += noiseMap[noiseRowOffset + nx] * textureVariation
          }

          if (hasGrain) {
            variation += (Math.random() - 0.5) * grainScale
          }

          // Ternary clamp avoids Math.min/Math.max function call overhead
          let v = data[i] + variation
          data[i] = v > 255 ? 255 : v < 0 ? 0 : v
          v = data[i + 1] + variation
          data[i + 1] = v > 255 ? 255 : v < 0 ? 0 : v
          v = data[i + 2] + variation
          data[i + 2] = v > 255 ? 255 : v < 0 ? 0 : v
        }
      }
    }

    // Halftone pass
    if (halftoneStrength > 0) {
      const originalData = new Uint8ClampedArray(data)
      const dotSpacing = s.halftoneSize * 2
      const maxDotSize = dotSpacing * 0.9
      const maxDotSizeSq = maxDotSize * maxDotSize
      const halftoneAngle = s.halftoneAngle * (Math.PI / 180)
      const misalign = (s.halftoneMisalign / 100) * 4
      // Pre-compute offsets × pixelDensity
      const cyanOX = -misalign * d
      const cyanOY = misalign * 0.7 * d
      const magentaOX = misalign * 0.8 * d
      const magentaOY = -misalign * 0.5 * d
      const yellowOX = misalign * 0.3 * d
      const yellowOY = misalign * d

      const paperR = 252
      const paperG = 250
      const paperB = 245

      const cosA = Math.cos(halftoneAngle)
      const sinA = Math.sin(halftoneAngle)
      const centerX = dotSpacing / 2
      const centerY = dotSpacing / 2

      const blend = halftoneStrength * 0.7
      const wMinus1 = w - 1
      const hMinus1 = h - 1
      const inv255 = 1 / 255

      for (let y = 0; y < h; y++) {
        const rowOffset = y * w
        const rotYsinA = y * sinA
        const rotYcosA = y * cosA
        for (let x = 0; x < w; x++) {
          const i = (rowOffset + x) * 4
          const rotX = x * cosA - rotYsinA
          const rotY = x * sinA + rotYcosA
          const gridX = ((rotX % dotSpacing) + dotSpacing) % dotSpacing
          const gridY = ((rotY % dotSpacing) + dotSpacing) % dotSpacing
          const dx = gridX - centerX
          const dy = gridY - centerY
          // Compare dist² instead of dist to avoid sqrt
          const distSq = dx * dx + dy * dy

          // Inline color sampling — avoids closure + object allocation per call
          let sx: number, sy: number, si: number

          sx = x + cyanOX
          sx = sx > wMinus1 ? wMinus1 : sx < 0 ? 0 : sx | 0
          sy = y + cyanOY
          sy = sy > hMinus1 ? hMinus1 : sy < 0 ? 0 : sy | 0
          si = (sy * w + sx) * 4
          const cyan = 255 - originalData[si]

          sx = x + magentaOX
          sx = sx > wMinus1 ? wMinus1 : sx < 0 ? 0 : sx | 0
          sy = y + magentaOY
          sy = sy > hMinus1 ? hMinus1 : sy < 0 ? 0 : sy | 0
          si = (sy * w + sx) * 4
          const magenta = 255 - originalData[si + 1]

          sx = x + yellowOX
          sx = sx > wMinus1 ? wMinus1 : sx < 0 ? 0 : sx | 0
          sy = y + yellowOY
          sy = sy > hMinus1 ? hMinus1 : sy < 0 ? 0 : sy | 0
          si = (sy * w + sx) * 4
          const yellow = 255 - originalData[si + 2]

          si = (rowOffset + x) * 4
          const bkR = 255 - originalData[si]
          const bkG = 255 - originalData[si + 1]
          const bkB = 255 - originalData[si + 2]
          const black = bkR < bkG ? (bkR < bkB ? bkR : bkB) : (bkG < bkB ? bkG : bkB)

          // Compare dot size² against dist² to avoid sqrt
          const cyanDotSq = (cyan * inv255) * (cyan * inv255) * maxDotSizeSq
          const magentaDotSq = (magenta * inv255) * (magenta * inv255) * maxDotSizeSq
          const yellowDotSq = (yellow * inv255) * (yellow * inv255) * maxDotSizeSq
          const blackDotSq = (black * inv255) * 0.7 * (black * inv255) * 0.7 * maxDotSizeSq

          let finalR = paperR
          let finalG = paperG
          let finalB = paperB

          if (distSq < cyanDotSq) { finalR -= 200; finalG -= 30; finalB -= 20 }
          if (distSq < magentaDotSq) { finalR -= 30; finalG -= 180; finalB -= 30 }
          if (distSq < yellowDotSq) { finalR -= 10; finalG -= 20; finalB -= 200 }
          if (distSq < blackDotSq) { finalR -= 60; finalG -= 60; finalB -= 60 }

          finalR = finalR > 255 ? 255 : finalR < 0 ? 0 : finalR
          finalG = finalG > 255 ? 255 : finalG < 0 ? 0 : finalG
          finalB = finalB > 255 ? 255 : finalB < 0 ? 0 : finalB

          data[i] = data[i] + (finalR - data[i]) * blend
          data[i + 1] = data[i + 1] + (finalG - data[i + 1]) * blend
          data[i + 2] = data[i + 2] + (finalB - data[i + 2]) * blend
        }
      }
    }

    c.putImageData(imageData, 0, 0)
  }
}
