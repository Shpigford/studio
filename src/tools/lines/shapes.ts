import type p5 from 'p5'
import type { LinesSettings } from './types'
import type { LineProperties } from './line-properties'
import type { ColorStop } from '@/types/tools'

// Pre-parsed gradient stop in HSB space
type HSBStop = { h: number; s: number; b: number; pos: number }

// --- Gradient color helpers (HSB space with hue wrapping) ---

function hexToHsb(hex: string): { h: number; s: number; b: number } {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16) / 255
  const g = parseInt(c.slice(2, 4), 16) / 255
  const b = parseInt(c.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : (delta / max) * 100
  return { h, s, b: max * 100 }
}

export function parseGradientStops(stops: ColorStop[]): HSBStop[] {
  return [...stops]
    .sort((a, b) => a.position - b.position)
    .map(s => ({ ...hexToHsb(s.color), pos: s.position / 100 }))
}

function getGradientColorAt(
  t: number,
  animOffset: number,
  stops: HSBStop[],
  animMode: string,
): { h: number; s: number; b: number } {
  let adj = t + animOffset
  if (animMode === 'cycle') {
    adj = adj % 1
    if (adj < 0) adj += 1
  } else if (animMode === 'reverse') {
    adj = 1 - (adj % 1)
    if (adj < 0) adj += 1
  } else if (animMode === 'bounce') {
    adj = adj % 2
    if (adj > 1) adj = 2 - adj
    if (adj < 0) adj = -adj
  }
  adj = Math.max(0, Math.min(1, adj))

  if (stops.length === 0) return { h: 0, s: 0, b: 100 }
  if (stops.length === 1) return stops[0]

  let lower = stops[0]
  let upper = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (adj >= stops[i].pos && adj <= stops[i + 1].pos) {
      lower = stops[i]
      upper = stops[i + 1]
      break
    }
  }

  const range = upper.pos - lower.pos
  const localT = range > 0 ? (adj - lower.pos) / range : 0

  let hDiff = upper.h - lower.h
  if (hDiff > 180) hDiff -= 360
  if (hDiff < -180) hDiff += 360

  return {
    h: (lower.h + hDiff * localT + 360) % 360,
    s: lower.s + (upper.s - lower.s) * localT,
    b: lower.b + (upper.b - lower.b) * localT,
  }
}

function getPerLineColor(
  idx: number, count: number, animOffset: number, stops: HSBStop[], animMode: string,
): { h: number; s: number; b: number } {
  const t = count > 1 ? idx / (count - 1) : 0
  return getGradientColorAt(t, animOffset, stops, animMode)
}

function getAlongLineColor(
  progress: number, animOffset: number, stops: HSBStop[], animMode: string,
): { h: number; s: number; b: number } {
  return getGradientColorAt(progress, animOffset, stops, animMode)
}

function getSpatialColor(
  x: number, y: number, w: number, h: number,
  spatialType: string, animOffset: number, stops: HSBStop[], animMode: string,
): { h: number; s: number; b: number } {
  let t: number
  if (spatialType === 'horizontal') t = x / w
  else if (spatialType === 'vertical') t = y / h
  else if (spatialType === 'radial') {
    const cx = w / 2, cy = h / 2
    const maxDist = Math.sqrt(cx * cx + cy * cy)
    t = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist
  } else t = 0
  return getGradientColorAt(t, animOffset, stops, animMode)
}

// --- HSB to CSS rgb string (with LRU-1 cache for repeated calls) ---
let _lastHsbKey = ''
let _lastRgbStr = 'rgb(0,0,0)'

function hsbToRgbStr(h: number, s: number, b: number): string {
  // Hot path: same color as last call (common in single-color lines)
  const key = `${h | 0},${(s * 10) | 0},${(b * 10) | 0}`
  if (key === _lastHsbKey) return _lastRgbStr

  const sn = s / 100, bn = b / 100
  const c = bn * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = bn - c
  let r = 0, g = 0, bl = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; bl = x }
  else if (h < 240) { g = x; bl = c }
  else if (h < 300) { r = x; bl = c }
  else { r = c; bl = x }
  _lastHsbKey = key
  _lastRgbStr = `rgb(${Math.round((r + m) * 255)},${Math.round((g + m) * 255)},${Math.round((bl + m) * 255)})`
  return _lastRgbStr
}

// --- Multi-octave p5 noise ---
function getMultiOctaveNoise(p: p5, x: number, y: number, octaves: number): number {
  let total = 0, freq = 1, amp = 1, maxVal = 0
  for (let i = 0; i < octaves; i++) {
    total += p.noise(x * freq, y * freq) * amp
    maxVal += amp
    amp *= 0.5
    freq *= 2
  }
  return total / maxVal
}

// --- LCM / GCD for Lissajous ---
function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b)
  while (b) { const t = b; b = a % b; a = t }
  return a
}
function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b)
}

// --- Vertex type ---
type Vertex = { x: number; y: number; progress: number }

// --- Draw a line segment (the core renderer) ---
function drawSegment(
  p: p5,
  ctx: CanvasRenderingContext2D,
  vertices: Vertex[],
  settings: LinesSettings,
  _props: LineProperties,
  lineIndex: number,
  canvasW: number,
  canvasH: number,
  baseH: number,
  baseS: number,
  baseB: number,
  baseOpacity: number,
  parsedStops: HSBStop[],
  gradAnimOffset: number,
) {
  if (vertices.length < 2) return

  const { thickness, weightVar: wvRaw, taper: taperRaw, watercolor, wcWetness: wcWRaw, wcPigment: wcPRaw,
    wcLayers, wcEdgeDarkening: wcEdRaw, enableGradient, gradientType, gradAnimMode } = settings
  const weightVar = wvRaw / 100
  const taper = taperRaw / 100
  const wcWetness = wcWRaw / 100
  const wcPigment = wcPRaw / 100
  const wcEdgeDarkening = wcEdRaw / 100

  const needsPerVertexColor = enableGradient &&
    (gradientType === 'alongLine' || gradientType === 'horizontal' || gradientType === 'vertical' || gradientType === 'radial')

  // Calculate weights
  const weights: number[] = []
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i]
    let weight = thickness
    if (weightVar > 0) {
      weight *= 1 + (p.noise(v.x * 0.02, lineIndex * 5) - 0.5) * weightVar * 2
    }
    if (taper > 0) {
      const ta = 1 - taper * (1 - Math.sin(v.progress * Math.PI))
      weight *= Math.max(0.1, ta)
    }
    weights.push(Math.max(0.5, weight))
  }

  const needsRibbon = weightVar > 0 || taper > 0
  const alpha = baseOpacity / 255

  // Precompute perpendiculars once if ribbon mode is needed
  let perps: { x: number; y: number }[] | null = null
  if (needsRibbon) {
    perps = new Array(vertices.length)
    for (let i = 0; i < vertices.length; i++) {
      perps[i] = calcPerp(vertices, i)
    }
  }

  if (watercolor) {
    // Watercolor: multiple transparent layers
    for (let layer = 0; layer < wcLayers; layer++) {
      const layerOffset = (layer - wcLayers / 2) * wcWetness * 3
      const layerAlpha = (alpha / wcLayers) * (0.6 + p.noise(lineIndex * 50, layer * 50) * 0.4)

      const layerHueShift = (p.noise(layer * 100, lineIndex) - 0.5) * wcPigment * 20
      const layerSatShift = (p.noise(layer * 200, lineIndex) - 0.5) * wcPigment * 30
      const layerBrightShift = (p.noise(layer * 300, lineIndex) - 0.5) * wcPigment * 20

      const h = (baseH + layerHueShift + 360) % 360
      const s = Math.max(0, Math.min(100, baseS + layerSatShift))
      const b = Math.max(0, Math.min(100, baseB + layerBrightShift))

      const bleedX = (p.noise(lineIndex * 10, layer * 20) - 0.5) * wcWetness * 6
      const bleedY = layerOffset + (p.noise(lineIndex * 20, layer * 30) - 0.5) * wcWetness * 6

      ctx.globalAlpha = layerAlpha
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (needsRibbon) {
        ctx.fillStyle = hsbToRgbStr(h, s, b)
        ctx.beginPath()
        // Top edge
        for (let i = 0; i < vertices.length; i++) {
          const v = vertices[i]
          const w = weights[i] * (1 + wcWetness)
          const perp = perps![i]
          const px = v.x + bleedX + perp.x * w / 2
          const py = v.y + bleedY + perp.y * w / 2
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        // Bottom edge (reverse)
        for (let i = vertices.length - 1; i >= 0; i--) {
          const v = vertices[i]
          const w = weights[i] * (1 + wcWetness)
          const perp = perps![i]
          ctx.lineTo(v.x + bleedX - perp.x * w / 2, v.y + bleedY - perp.y * w / 2)
        }
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.strokeStyle = hsbToRgbStr(h, s, b)
        ctx.lineWidth = thickness * (1 + wcWetness)
        ctx.beginPath()
        for (let i = 0; i < vertices.length; i++) {
          const v = vertices[i]
          if (i === 0) ctx.moveTo(v.x + bleedX, v.y + bleedY)
          else ctx.lineTo(v.x + bleedX, v.y + bleedY)
        }
        ctx.stroke()
      }
    }

    // Edge darkening
    if (wcEdgeDarkening > 0) {
      ctx.globalAlpha = alpha * wcEdgeDarkening * 0.3
      ctx.strokeStyle = hsbToRgbStr(baseH, baseS, baseB * 0.6)
      ctx.lineWidth = thickness * 0.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      const edgeLen = Math.min(Math.floor(vertices.length * 0.15), 20)
      // Start edge
      ctx.beginPath()
      for (let i = 0; i < edgeLen && i < vertices.length; i++) {
        if (i === 0) ctx.moveTo(vertices[i].x, vertices[i].y)
        else ctx.lineTo(vertices[i].x, vertices[i].y)
      }
      ctx.stroke()
      // End edge
      ctx.beginPath()
      for (let i = Math.max(0, vertices.length - edgeLen); i < vertices.length; i++) {
        if (i === Math.max(0, vertices.length - edgeLen)) ctx.moveTo(vertices[i].x, vertices[i].y)
        else ctx.lineTo(vertices[i].x, vertices[i].y)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  } else {
    // Normal drawing
    ctx.globalAlpha = alpha
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (needsRibbon) {
      ctx.fillStyle = hsbToRgbStr(baseH, baseS, baseB)
      ctx.beginPath()
      for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i]
        const w = weights[i]
        const perp = calcPerp(vertices, i)
        const px = v.x + perp.x * w / 2
        const py = v.y + perp.y * w / 2
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      for (let i = vertices.length - 1; i >= 0; i--) {
        const v = vertices[i]
        const w = weights[i]
        const perp = calcPerp(vertices, i)
        ctx.lineTo(v.x - perp.x * w / 2, v.y - perp.y * w / 2)
      }
      ctx.closePath()
      ctx.fill()
    } else if (needsPerVertexColor) {
      // Per-segment gradient coloring
      ctx.lineWidth = thickness
      for (let i = 0; i < vertices.length - 1; i++) {
        const v1 = vertices[i]
        const v2 = vertices[i + 1]
        let gc: { h: number; s: number; b: number }
        if (gradientType === 'alongLine') {
          gc = getAlongLineColor(v1.progress, gradAnimOffset, parsedStops, gradAnimMode)
        } else {
          gc = getSpatialColor(v1.x, v1.y, canvasW, canvasH, gradientType, gradAnimOffset, parsedStops, gradAnimMode)
        }
        ctx.strokeStyle = hsbToRgbStr(gc.h, gc.s, gc.b)
        ctx.beginPath()
        ctx.moveTo(v1.x, v1.y)
        ctx.lineTo(v2.x, v2.y)
        ctx.stroke()
      }
    } else {
      ctx.strokeStyle = hsbToRgbStr(baseH, baseS, baseB)
      ctx.lineWidth = thickness
      ctx.beginPath()
      for (let i = 0; i < vertices.length; i++) {
        if (i === 0) ctx.moveTo(vertices[i].x, vertices[i].y)
        else ctx.lineTo(vertices[i].x, vertices[i].y)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
}

function calcPerp(vertices: Vertex[], i: number): { x: number; y: number } {
  let dx = 0, dy = 1
  if (i < vertices.length - 1) {
    dx = vertices[i + 1].x - vertices[i].x
    dy = vertices[i + 1].y - vertices[i].y
  } else if (i > 0) {
    dx = vertices[i].x - vertices[i - 1].x
    dy = vertices[i].y - vertices[i - 1].y
  }
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return { x: 0, y: 1 }
  return { x: -dy / len, y: dx / len }
}

// --- Check if position is in a gap (break or morse) ---
function isInGap(
  progress: number,
  lineIndex: number,
  settings: LinesSettings,
  props: LineProperties,
): boolean {
  if (settings.morsePattern && props.morsePatterns[lineIndex]) {
    let inElement = false
    for (const elem of props.morsePatterns[lineIndex]) {
      if (progress >= elem.start && progress <= elem.end) { inElement = true; break }
    }
    return !inElement
  } else if (settings.lineBreaks) {
    const breaks = props.breakPositions[lineIndex]?.slice(0, settings.breakFrequency) ?? []
    for (const brk of breaks) {
      if (progress > brk.pos && progress < brk.pos + brk.width) return true
    }
  }
  return false
}

// --- Shape drawing functions ---

export function drawHorizontalLines(
  p: p5, ctx: CanvasRenderingContext2D, settings: LinesSettings,
  props: LineProperties, canvasSize: number, animTime: number,
  gradAnimOffset: number, parsedStops: HSBStop[],
) {
  const { frequency: freq, amplitude: amp, lineCount, spacing, padding,
    perlinFlow: pfRaw, freqVar: fvRaw, noiseOctaves, spacingVar,
    rotationJitter, opacityVar: ovRaw, colorDrift, enableGradient, gradientType, gradAnimMode } = settings
  const perlinFlow = pfRaw / 100
  const freqVar = fvRaw / 100
  const opacityVar = ovRaw / 100
  const baseHSB = hexToHsb(settings.lineColor)

  const baseSpacing = 20
  const totalHeight = (lineCount - 1) * baseSpacing * spacing
  const startY = (canvasSize - totalHeight) / 2

  for (let i = 0; i < lineCount; i++) {
    const spacingOffset = (props.spacingOffsets[i] ?? 0) * spacingVar
    const baseY = startY + i * baseSpacing * spacing + spacingOffset
    const rotation = (props.rotations[i] ?? 0) * rotationJitter * (Math.PI / 180)
    const opacity = 255 * (1 - opacityVar * Math.abs(props.opacities[i] ?? 0))

    let h: number, s: number, b: number
    if (enableGradient && gradientType === 'perLine') {
      const gc = getPerLineColor(i, lineCount, gradAnimOffset, parsedStops, gradAnimMode)
      h = gc.h; s = gc.s; b = gc.b
    } else {
      h = baseHSB.h; s = baseHSB.s; b = baseHSB.b
    }

    if (colorDrift > 0) {
      h = (h + (props.hueShifts[i] ?? 0) * colorDrift + 360) % 360
    }

    const lineFreq = freq * (props.frequencies[i] ?? 1)
    const phase = props.phases[i] ?? 0

    const hasRotation = rotation !== 0
    if (hasRotation) {
      ctx.save()
      ctx.translate(canvasSize / 2, baseY)
      ctx.rotate(rotation)
      ctx.translate(-canvasSize / 2, -baseY)
    }

    const lineStart = padding
    const lineEnd = canvasSize - padding
    const lineLength = lineEnd - lineStart
    const step = 2

    let vertices: Vertex[] = []

    for (let x = lineStart; x <= lineEnd; x += step) {
      const progress = (x - lineStart) / lineLength

      if (isInGap(progress, i, settings, props)) {
        if (vertices.length > 1) {
          drawSegment(p, ctx, vertices, settings, props, i, canvasSize, canvasSize, h, s, b, opacity, parsedStops, gradAnimOffset)
        }
        vertices = []
        continue
      }

      let y = baseY
      const animPhase = phase + animTime
      const sineY = Math.sin(x * lineFreq + animPhase) * amp

      if (perlinFlow > 0) {
        const perlinY = (getMultiOctaveNoise(p, x * 0.01, i * 0.5 + animTime * 0.1, noiseOctaves) - 0.5) * 2 * amp
        y += sineY + (perlinY - sineY) * perlinFlow
      } else {
        y += sineY
      }

      if (freqVar > 0) {
        const freqMod = 1 + Math.sin(progress * Math.PI * 4) * freqVar
        const modSineY = Math.sin(x * lineFreq * freqMod + animPhase) * amp
        y += (modSineY - sineY) * freqVar
      }

      if (settings.wobble > 0) {
        y += (p.noise(x * 0.1, i * 10) - 0.5) * settings.wobble
      }

      vertices.push({ x, y, progress })
    }

    if (vertices.length > 1) {
      drawSegment(p, ctx, vertices, settings, props, i, canvasSize, canvasSize, h, s, b, opacity, parsedStops, gradAnimOffset)
    }

    if (hasRotation) ctx.restore()
  }
}

export function drawVerticalLines(
  p: p5, ctx: CanvasRenderingContext2D, settings: LinesSettings,
  props: LineProperties, canvasSize: number, animTime: number,
  gradAnimOffset: number, parsedStops: HSBStop[],
) {
  const { frequency: freq, amplitude: amp, lineCount, spacing, padding, wobble,
    perlinFlow: pfRaw, freqVar: fvRaw, noiseOctaves, spacingVar,
    rotationJitter, opacityVar: ovRaw, colorDrift, enableGradient, gradientType, gradAnimMode } = settings
  const perlinFlow = pfRaw / 100
  const freqVar = fvRaw / 100
  const opacityVar = ovRaw / 100
  const baseHSB = hexToHsb(settings.lineColor)

  const baseSpacing = 20
  const totalWidth = (lineCount - 1) * baseSpacing * spacing
  const startX = (canvasSize - totalWidth) / 2

  for (let i = 0; i < lineCount; i++) {
    const spacingOffset = (props.spacingOffsets[i] ?? 0) * spacingVar
    const baseX = startX + i * baseSpacing * spacing + spacingOffset
    const rotation = (props.rotations[i] ?? 0) * rotationJitter * (Math.PI / 180)
    const opacity = 255 * (1 - opacityVar * Math.abs(props.opacities[i] ?? 0))

    let h: number, s: number, b: number
    if (enableGradient && gradientType === 'perLine') {
      const gc = getPerLineColor(i, lineCount, gradAnimOffset, parsedStops, gradAnimMode)
      h = gc.h; s = gc.s; b = gc.b
    } else {
      h = baseHSB.h; s = baseHSB.s; b = baseHSB.b
    }

    if (colorDrift > 0) {
      h = (h + (props.hueShifts[i] ?? 0) * colorDrift + 360) % 360
    }

    const lineFreq = freq * (props.frequencies[i] ?? 1)
    const phase = props.phases[i] ?? 0

    const hasRotation = rotation !== 0
    if (hasRotation) {
      ctx.save()
      ctx.translate(baseX, canvasSize / 2)
      ctx.rotate(rotation)
      ctx.translate(-baseX, -canvasSize / 2)
    }

    const lineStart = padding
    const lineEnd = canvasSize - padding
    const lineLength = lineEnd - lineStart
    const step = 2
    let vertices: Vertex[] = []

    for (let y = lineStart; y <= lineEnd; y += step) {
      const progress = (y - lineStart) / lineLength

      if (isInGap(progress, i, settings, props)) {
        if (vertices.length > 1) {
          drawSegment(p, ctx, vertices, settings, props, i, canvasSize, canvasSize, h, s, b, opacity, parsedStops, gradAnimOffset)
        }
        vertices = []
        continue
      }

      let x = baseX
      const animPhase = phase + animTime
      const sineX = Math.sin(y * lineFreq + animPhase) * amp

      if (perlinFlow > 0) {
        const perlinX = (getMultiOctaveNoise(p, y * 0.01, i * 0.5 + animTime * 0.1, noiseOctaves) - 0.5) * 2 * amp
        x += sineX + (perlinX - sineX) * perlinFlow
      } else {
        x += sineX
      }

      if (freqVar > 0) {
        const freqMod = 1 + Math.sin(progress * Math.PI * 4) * freqVar
        const modSineX = Math.sin(y * lineFreq * freqMod + animPhase) * amp
        x += (modSineX - sineX) * freqVar
      }

      if (wobble > 0) {
        x += (p.noise(y * 0.1, i * 10) - 0.5) * wobble
      }

      vertices.push({ x, y, progress })
    }

    if (vertices.length > 1) {
      drawSegment(p, ctx, vertices, settings, props, i, canvasSize, canvasSize, h, s, b, opacity, parsedStops, gradAnimOffset)
    }

    if (hasRotation) ctx.restore()
  }
}

export function drawCircles(
  p: p5, ctx: CanvasRenderingContext2D, settings: LinesSettings,
  props: LineProperties, canvasSize: number, animTime: number,
  gradAnimOffset: number, parsedStops: HSBStop[],
) {
  const { frequency: freq, amplitude: amp, lineCount, spacing, padding, wobble,
    perlinFlow: pfRaw, noiseOctaves, opacityVar: ovRaw, colorDrift,
    enableGradient, gradientType, gradAnimMode } = settings
  const perlinFlow = pfRaw / 100
  const opacityVar = ovRaw / 100
  const baseHSB = hexToHsb(settings.lineColor)

  const centerX = canvasSize / 2
  const centerY = canvasSize / 2
  const maxRadius = canvasSize / 2 - padding
  const minRadius = padding
  const radiusStep = (maxRadius - minRadius) / Math.max(1, lineCount - 1)

  for (let i = 0; i < lineCount; i++) {
    const baseRadius = minRadius + i * radiusStep * spacing
    if (baseRadius > maxRadius) continue

    const opacity = 255 * (1 - opacityVar * Math.abs(props.opacities[i] ?? 0))
    let h: number, s: number, b: number
    if (enableGradient && gradientType === 'perLine') {
      const gc = getPerLineColor(i, lineCount, gradAnimOffset, parsedStops, gradAnimMode)
      h = gc.h; s = gc.s; b = gc.b
    } else {
      h = baseHSB.h; s = baseHSB.s; b = baseHSB.b
    }
    if (colorDrift > 0) h = (h + (props.hueShifts[i] ?? 0) * colorDrift + 360) % 360

    const ringFreq = freq * 50 * (props.frequencies[i] ?? 1)
    const phase = props.phases[i] ?? 0
    const steps = Math.floor(Math.PI * 2 * baseRadius / 3)
    const vertices: Vertex[] = []

    for (let j = 0; j <= steps; j++) {
      const angle = (j / steps) * Math.PI * 2
      const progress = j / steps
      const animPhase = phase + animTime
      const sineR = Math.sin(angle * ringFreq + animPhase) * amp * 0.5
      const perlinR = (getMultiOctaveNoise(p, Math.cos(angle) * 2 + i + animTime * 0.1, Math.sin(angle) * 2, noiseOctaves) - 0.5) * amp
      let r = baseRadius + sineR + (perlinR - sineR) * perlinFlow
      if (wobble > 0) r += (p.noise(angle * 3, i * 10) - 0.5) * wobble

      vertices.push({ x: centerX + Math.cos(angle) * r, y: centerY + Math.sin(angle) * r, progress })
    }

    if (vertices.length > 1) {
      drawSegment(p, ctx, vertices, settings, props, i, canvasSize, canvasSize, h, s, b, opacity, parsedStops, gradAnimOffset)
    }
  }
}

export function drawDots(
  p: p5, ctx: CanvasRenderingContext2D, settings: LinesSettings,
  props: LineProperties, canvasSize: number, animTime: number,
  gradAnimOffset: number, parsedStops: HSBStop[],
) {
  const { frequency: freq, amplitude: amp, lineCount, spacing, padding, thickness,
    weightVar: wvRaw, perlinFlow: pfRaw, noiseOctaves, opacityVar: ovRaw, colorDrift,
    enableGradient, gradientType, gradAnimMode, watercolor, wcWetness: wcWRaw, wcLayers } = settings
  const perlinFlow = pfRaw / 100
  const opacityVar = ovRaw / 100
  const weightVar = wvRaw / 100
  const wcWetness = wcWRaw / 100
  const baseHSB = hexToHsb(settings.lineColor)

  const baseSpacing = 20
  const totalHeight = (lineCount - 1) * baseSpacing * spacing
  const startY = (canvasSize - totalHeight) / 2
  const dotSpacing = thickness * 8

  for (let i = 0; i < lineCount; i++) {
    const baseY = startY + i * baseSpacing * spacing
    const opacity = 255 * (1 - opacityVar * Math.abs(props.opacities[i] ?? 0))

    let h: number, s: number, b: number
    if (enableGradient && gradientType === 'perLine') {
      const gc = getPerLineColor(i, lineCount, gradAnimOffset, parsedStops, gradAnimMode)
      h = gc.h; s = gc.s; b = gc.b
    } else {
      h = baseHSB.h; s = baseHSB.s; b = baseHSB.b
    }
    if (colorDrift > 0) h = (h + (props.hueShifts[i] ?? 0) * colorDrift + 360) % 360

    const lineFreq = freq * (props.frequencies[i] ?? 1)
    const phase = props.phases[i] ?? 0

    for (let x = padding; x <= canvasSize - padding; x += dotSpacing) {
      const progress = (x - padding) / (canvasSize - 2 * padding)
      const animPhase = phase + animTime
      const sineY = Math.sin(x * lineFreq + animPhase) * amp
      const perlinY = (getMultiOctaveNoise(p, x * 0.01, i * 0.5 + animTime * 0.1, noiseOctaves) - 0.5) * 2 * amp
      const y = baseY + sineY + (perlinY - sineY) * perlinFlow

      const sizeVar = 1 + (p.noise(x * 0.05, i * 5) - 0.5) * weightVar
      const dotSize = thickness * 2 * sizeVar

      let dotH = h, dotS = s, dotB = b
      if (enableGradient && gradientType !== 'perLine') {
        const gc = gradientType === 'alongLine'
          ? getAlongLineColor(progress, gradAnimOffset, parsedStops, gradAnimMode)
          : getSpatialColor(x, y, canvasSize, canvasSize, gradientType, gradAnimOffset, parsedStops, gradAnimMode)
        dotH = gc.h; dotS = gc.s; dotB = gc.b
      }

      if (watercolor) {
        for (let layer = 0; layer < wcLayers; layer++) {
          const layerOpacity = (opacity / 255 / wcLayers) * (0.6 + p.noise(i * 50, layer * 50) * 0.4)
          const offsetX = (p.noise(layer * 100, i) - 0.5) * wcWetness * 4
          const offsetY = (p.noise(layer * 200, i) - 0.5) * wcWetness * 4
          ctx.globalAlpha = layerOpacity
          ctx.fillStyle = hsbToRgbStr(dotH, dotS, dotB)
          ctx.beginPath()
          ctx.arc(x + offsetX, y + offsetY, dotSize * (1 + wcWetness * 0.3) / 2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      } else {
        ctx.globalAlpha = opacity / 255
        ctx.fillStyle = hsbToRgbStr(dotH, dotS, dotB)
        ctx.beginPath()
        ctx.arc(x, y, dotSize / 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }
  }
}

export function drawSpiral(
  p: p5, ctx: CanvasRenderingContext2D, settings: LinesSettings,
  props: LineProperties, canvasSize: number, animTime: number,
  gradAnimOffset: number, parsedStops: HSBStop[],
) {
  const { frequency: freq, amplitude: amp, lineCount, spacing, padding, wobble,
    perlinFlow: pfRaw, noiseOctaves, opacityVar: ovRaw, colorDrift,
    enableGradient, gradientType, gradAnimMode } = settings
  const perlinFlow = pfRaw / 100
  const opacityVar = ovRaw / 100
  const baseHSB = hexToHsb(settings.lineColor)

  const centerX = canvasSize / 2
  const centerY = canvasSize / 2
  const maxRadius = canvasSize / 2 - padding
  const minRadius = padding * 0.5
  const arms = Math.max(1, lineCount)

  for (let arm = 0; arm < arms; arm++) {
    const idx = arm % props.opacities.length
    const opacity = 255 * (1 - opacityVar * Math.abs(props.opacities[idx] ?? 0))

    let h: number, s: number, b: number
    if (enableGradient && gradientType === 'perLine') {
      const gc = getPerLineColor(arm, arms, gradAnimOffset, parsedStops, gradAnimMode)
      h = gc.h; s = gc.s; b = gc.b
    } else {
      h = baseHSB.h; s = baseHSB.s; b = baseHSB.b
    }
    if (colorDrift > 0) h = (h + (props.hueShifts[idx] ?? 0) * colorDrift + 360) % 360

    const armPhase = (arm / arms) * Math.PI * 2
    const spiralFreq = freq * 20 * (props.frequencies[idx] ?? 1)
    const phase = props.phases[idx] ?? 0
    const totalRotations = 3 + spacing * 2
    const steps = Math.floor(totalRotations * 100)
    let vertices: Vertex[] = []

    for (let j = 0; j <= steps; j++) {
      const progress = j / steps
      if (isInGap(progress, idx, settings, props)) {
        if (vertices.length > 1) {
          drawSegment(p, ctx, vertices, settings, props, arm, canvasSize, canvasSize, h, s, b, opacity, parsedStops, gradAnimOffset)
        }
        vertices = []
        continue
      }

      const angle = armPhase + progress * totalRotations * Math.PI * 2 + animTime * 0.5
      const baseRadius = minRadius + progress * (maxRadius - minRadius)
      const animPhase = phase + animTime
      const sineR = Math.sin(angle * spiralFreq + animPhase) * amp * 0.3
      const perlinR = (getMultiOctaveNoise(p, Math.cos(angle) + arm + animTime * 0.1, Math.sin(angle), noiseOctaves) - 0.5) * amp * 0.5
      let r = baseRadius + sineR + (perlinR - sineR) * perlinFlow
      if (wobble > 0) r += (p.noise(angle * 2, arm * 10) - 0.5) * wobble

      vertices.push({ x: centerX + Math.cos(angle) * r, y: centerY + Math.sin(angle) * r, progress })
    }

    if (vertices.length > 1) {
      drawSegment(p, ctx, vertices, settings, props, arm, canvasSize, canvasSize, h, s, b, opacity, parsedStops, gradAnimOffset)
    }
  }
}

export function drawRadial(
  p: p5, ctx: CanvasRenderingContext2D, settings: LinesSettings,
  props: LineProperties, canvasSize: number, animTime: number,
  gradAnimOffset: number, parsedStops: HSBStop[],
) {
  const { frequency: freq, amplitude: amp, lineCount, padding, wobble,
    perlinFlow: pfRaw, noiseOctaves, opacityVar: ovRaw, colorDrift,
    enableGradient, gradientType, gradAnimMode } = settings
  const perlinFlow = pfRaw / 100
  const opacityVar = ovRaw / 100
  const baseHSB = hexToHsb(settings.lineColor)

  const centerX = canvasSize / 2
  const centerY = canvasSize / 2
  const maxRadius = canvasSize / 2 - padding
  const minRadius = padding
  const rays = Math.max(1, lineCount)

  for (let i = 0; i < rays; i++) {
    const idx = i % props.opacities.length
    const baseAngle = (i / rays) * Math.PI * 2
    const opacity = 255 * (1 - opacityVar * Math.abs(props.opacities[idx] ?? 0))

    let h: number, s: number, b: number
    if (enableGradient && gradientType === 'perLine') {
      const gc = getPerLineColor(i, rays, gradAnimOffset, parsedStops, gradAnimMode)
      h = gc.h; s = gc.s; b = gc.b
    } else {
      h = baseHSB.h; s = baseHSB.s; b = baseHSB.b
    }
    if (colorDrift > 0) h = (h + (props.hueShifts[idx] ?? 0) * colorDrift + 360) % 360

    const rayFreq = freq * 30 * (props.frequencies[idx] ?? 1)
    const phase = props.phases[idx] ?? 0
    const steps = 50
    let vertices: Vertex[] = []

    for (let j = 0; j <= steps; j++) {
      const progress = j / steps
      if (isInGap(progress, idx, settings, props)) {
        if (vertices.length > 1) {
          drawSegment(p, ctx, vertices, settings, props, i, canvasSize, canvasSize, h, s, b, opacity, parsedStops, gradAnimOffset)
        }
        vertices = []
        continue
      }

      const r = minRadius + progress * (maxRadius - minRadius)
      const animPhase = phase + animTime
      const sineAngle = Math.sin(r * rayFreq * 0.01 + animPhase) * amp * 0.01
      const perlinAngle = (getMultiOctaveNoise(p, r * 0.01, i * 0.5 + animTime * 0.1, noiseOctaves) - 0.5) * amp * 0.02
      const angle = baseAngle + sineAngle + (perlinAngle - sineAngle) * perlinFlow

      let finalR = r
      if (wobble > 0) finalR += (p.noise(r * 0.05, i * 10) - 0.5) * wobble

      vertices.push({ x: centerX + Math.cos(angle) * finalR, y: centerY + Math.sin(angle) * finalR, progress })
    }

    if (vertices.length > 1) {
      drawSegment(p, ctx, vertices, settings, props, i, canvasSize, canvasSize, h, s, b, opacity, parsedStops, gradAnimOffset)
    }
  }
}

export function drawLissajous(
  p: p5, ctx: CanvasRenderingContext2D, settings: LinesSettings,
  props: LineProperties, canvasSize: number, animTime: number,
  gradAnimOffset: number, parsedStops: HSBStop[],
) {
  const { lissFreqA: freqA, lissFreqB: freqB, lissPhase: phase, lissScale: scale,
    lissResolution: resolution, oscillonMode, oscillonLayers: layers, oscillonSpread: spread } = settings
  const baseHSB = hexToHsb(settings.lineColor)

  const cx = canvasSize / 2
  const cy = canvasSize / 2
  const scaleAmt = canvasSize * scale * 0.4
  const animPhase = animTime * 0.5

  if (oscillonMode) {
    for (let layer = 0; layer < layers; layer++) {
      const freqOffset = (layer - layers / 2) * spread
      const layerFreqA = freqA + freqOffset * 0.5
      const layerFreqB = freqB + freqOffset
      const layerPhase = phase + layer * 0.2 + animPhase
      const layerOpacity = p.map(layer, 0, layers - 1, 0.3, 1)

      drawSingleLissajous(p, ctx, settings, props, cx, cy, scaleAmt,
        layerFreqA, layerFreqB, layerPhase, resolution, baseHSB,
        layerOpacity, layer, layers, canvasSize,
        parsedStops, gradAnimOffset)
    }
  } else {
    drawSingleLissajous(p, ctx, settings, props, cx, cy, scaleAmt,
      freqA, freqB, phase + animPhase, resolution, baseHSB,
      1, 0, 1, canvasSize, parsedStops, gradAnimOffset)
  }
}

function drawSingleLissajous(
  p: p5, ctx: CanvasRenderingContext2D, settings: LinesSettings,
  props: LineProperties,
  cx: number, cy: number, scale: number,
  freqA: number, freqB: number, phase: number, resolution: number,
  baseHSB: { h: number; s: number; b: number },
  opacity: number, layerIndex: number, totalLayers: number,
  canvasSize: number, parsedStops: HSBStop[], gradAnimOffset: number,
) {
  const { colorDrift, enableGradient, gradientType, gradAnimMode, wobble } = settings
  void gradAnimMode

  const cycles = lcm(Math.round(Math.abs(freqA)) || 1, Math.round(Math.abs(freqB)) || 1) / (Math.round(Math.abs(freqA)) || 1)
  const vertices: Vertex[] = []

  for (let i = 0; i <= resolution; i++) {
    const progress = i / resolution
    const t = progress * Math.PI * 2 * cycles

    let x = cx + Math.sin(freqA * t + phase) * scale
    let y = cy + Math.sin(freqB * t) * scale

    if (wobble > 0) {
      x += (p.noise(t * 0.5, layerIndex * 100) - 0.5) * wobble * 20
      y += (p.noise(t * 0.5, layerIndex * 100 + 50) - 0.5) * wobble * 20
    }

    vertices.push({ x, y, progress })
  }

  let h: number, s: number, b: number
  if (enableGradient && gradientType === 'perLine') {
    const gc = getPerLineColor(layerIndex, totalLayers, gradAnimOffset, parsedStops, gradAnimMode)
    h = gc.h; s = gc.s; b = gc.b
  } else {
    h = baseHSB.h; s = baseHSB.s; b = baseHSB.b
    const idx = layerIndex % (props.hueShifts.length || 1)
    if (colorDrift > 0) h = (h + (props.hueShifts[idx] ?? 0) * colorDrift + 360) % 360
  }

  drawSegment(p, ctx, vertices, settings, props, layerIndex, canvasSize, canvasSize,
    h, s, b, opacity * 255, parsedStops, gradAnimOffset)
}
