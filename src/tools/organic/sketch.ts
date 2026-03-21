import type p5 from 'p5'
import type { RefObject } from 'react'
import type { OrganicSettings, PathPoint, OrganicGeometry } from './types'
import { hexToRgb } from '@/lib/color'
import { resolveCanvasSize } from '@/lib/canvas-size'

interface ParsedStop {
  r: number
  g: number
  b: number
  position: number
}

export function createOrganicSketch(p: p5, settingsRef: RefObject<OrganicSettings>, geometryRef?: RefObject<OrganicGeometry | null>) {
  const ctx = () => p.drawingContext as CanvasRenderingContext2D

  // Cached paths — recompute only when geometry-affecting settings change
  let cachedPaths: PathPoint[][] = []
  let cachedPathKey = ''

  function pathKey(s: OrganicSettings): string {
    const algo = s[s.pathType]
    return `${s.seed}|${s.pathType}|${s.pathCount}|${s.canvasPreset}|${s.customWidth}|${s.customHeight}|${JSON.stringify(algo)}`
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
      p.colorMode(p.RGB, 255)
      cachedPathKey = ''
    }

    p.background(s.bgColor)

    const pk = pathKey(s)
    if (pk !== cachedPathKey) {
      p.randomSeed(s.seed)
      p.noiseSeed(s.seed)
      cachedPaths = generatePaths(s)
      cachedPathKey = pk
    }

    // Reset seeds for deterministic rendering
    p.randomSeed(s.seed)
    p.noiseSeed(s.seed)

    // Pre-parse color stops once for this frame (avoid hex parsing in hot loop)
    const parsedStops = parseAndSortStops(s)

    // Pre-compute gradient constants
    const gradientConsts = {
      halfW: p.width / 2,
      halfH: p.height / 2,
      radialMaxDist: Math.sqrt((p.width / 2) ** 2 + (p.height / 2) ** 2),
    }

    const c = ctx()

    // Apply padding clipping
    const pad = s.padding
    if (pad > 0) {
      c.save()
      c.beginPath()
      c.rect(pad, pad, p.width - pad * 2, p.height - pad * 2)
      c.clip()
    }

    // Set line caps once (canvas 2D API)
    c.lineCap = 'round'
    c.lineJoin = 'round'

    // Render paths using direct canvas API
    const totalPaths = cachedPaths.length
    const collectedPaths: PathPoint[][] = []
    for (let i = 0; i < totalPaths; i++) {
      const processed = renderPath(cachedPaths[i], i, s, parsedStops, gradientConsts, c)
      if (processed) collectedPaths.push(processed)
    }

    if (geometryRef) {
      geometryRef.current = { paths: collectedPaths, width: p.width, height: p.height }
    }

    if (pad > 0) {
      c.restore()
    }

    // Post-processing
    if (s.textureAmount > 0) {
      applyCanvasTexture(s)
    }
    if (s.grainAmount > 0) {
      applyGrain(s)
    }
  }

  // ============================================
  // COLOR — PRE-PARSED STOPS
  // ============================================

  function parseAndSortStops(s: OrganicSettings): ParsedStop[] {
    const stops = s.colorStops
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
    // Clamp to stop range
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    if (pos <= first.position) return [first.r, first.g, first.b]
    if (pos >= last.position) return [last.r, last.g, last.b]

    // Find surrounding stops
    let lower = first
    let upper = last
    for (let i = 0; i < sorted.length - 1; i++) {
      if (pos >= sorted[i].position && pos <= sorted[i + 1].position) {
        lower = sorted[i]
        upper = sorted[i + 1]
        break
      }
    }

    const range = upper.position - lower.position
    if (range === 0) return [lower.r, lower.g, lower.b]

    const factor = (pos - lower.position) / range
    // Hermite smoothing
    const s = factor * factor * (3 - 2 * factor)

    return [
      (lower.r + (upper.r - lower.r) * s) | 0,
      (lower.g + (upper.g - lower.g) * s) | 0,
      (lower.b + (upper.b - lower.b) * s) | 0,
    ]
  }

  // ============================================
  // PATH GENERATION
  // ============================================

  function generatePaths(s: OrganicSettings): PathPoint[][] {
    switch (s.pathType) {
      case 'flowField': return generateFlowFieldPaths(s)
      case 'wandering': return generateWanderingPaths(s)
      case 'waves': return generateWavePaths(s)
      default: return generateFlowFieldPaths(s)
    }
  }

  function generateFlowFieldPaths(s: OrganicSettings): PathPoint[][] {
    const paths: PathPoint[][] = []
    const opts = s.flowField
    const w = p.width
    const h = p.height

    for (let i = 0; i < s.pathCount; i++) {
      const path: PathPoint[] = []
      let x = p.random(w)
      let y = p.random(h)

      for (let step = 0; step < opts.steps; step++) {
        path.push({ x, y })

        const angle = p.noise(x * opts.noiseScale, y * opts.noiseScale) * p.TWO_PI * opts.turbulence
        x += Math.cos(angle) * opts.stepLength
        y += Math.sin(angle) * opts.stepLength

        if (x < 0 || x > w || y < 0 || y > h) break
      }

      if (path.length > 2) paths.push(path)
    }

    return paths
  }

  function generateWanderingPaths(s: OrganicSettings): PathPoint[][] {
    const paths: PathPoint[][] = []
    const opts = s.wandering
    const margin = 50
    const w = p.width
    const h = p.height

    for (let i = 0; i < s.pathCount; i++) {
      const path: PathPoint[] = []
      let x = p.random(margin, w - margin)
      let y = p.random(margin, h - margin)
      let angle = p.random(p.TWO_PI)
      let momentum = angle

      for (let step = 0; step < opts.steps; step++) {
        path.push({ x, y })

        const angleChange = (p.random(-1, 1) * opts.angleVar + p.noise(x * 0.01, y * 0.01) * 0.5) * p.PI
        angle += angleChange
        angle = p.lerp(momentum, angle, 1 - opts.momentum)
        momentum = angle

        if (opts.attraction > 0) {
          const toCenter = Math.atan2(h / 2 - y, w / 2 - x)
          angle = p.lerp(angle, toCenter, opts.attraction * 0.1)
        }

        const edgePush = 0.15
        if (x < margin) angle = p.lerp(angle, 0, edgePush)
        if (x > w - margin) angle = p.lerp(angle, p.PI, edgePush)
        if (y < margin) angle = p.lerp(angle, p.HALF_PI, edgePush)
        if (y > h - margin) angle = p.lerp(angle, -p.HALF_PI, edgePush)

        x += Math.cos(angle) * opts.stepLength
        y += Math.sin(angle) * opts.stepLength

        x = p.constrain(x, 0, w)
        y = p.constrain(y, 0, h)
      }

      if (path.length > 2) paths.push(path)
    }

    return paths
  }

  function generateWavePaths(s: OrganicSettings): PathPoint[][] {
    const paths: PathPoint[][] = []
    const opts = s.waves
    const variationAmount = opts.variation / 100
    const w = p.width
    const h = p.height

    for (let wv = 0; wv < opts.count; wv++) {
      const path: PathPoint[] = []
      const baseY = (wv + 1) / (opts.count + 1) * h

      const noiseOffsetX = wv * 173.7 + p.random(500)
      const noiseOffsetY = wv * 289.3 + p.random(500)
      const noiseOffsetAmp = wv * 412.9 + p.random(500)

      const baseFreqMult = 1 + (p.random(-0.5, 0.5) * variationAmount)
      const basePhase = p.random(p.TWO_PI) * variationAmount

      for (let x = -50; x <= w + 50; x += 3) {
        const t = (x + 50) / (w + 100)

        const ampNoise = p.noise(t * 2 + noiseOffsetAmp, wv * 50) * 2 - 1
        const ampMult = 1 + ampNoise * variationAmount * 0.7

        const yDisplacement = (p.noise(t * 3 + noiseOffsetY, wv * 77) * 2 - 1) * 80 * variationAmount
        const phaseShift = p.noise(t * 1.5 + noiseOffsetX, wv * 33) * p.TWO_PI * variationAmount

        let y = baseY + yDisplacement

        for (let hm = 1; hm <= opts.harmonics; hm++) {
          const amp = (opts.amplitude / hm) * ampMult
          const freq = opts.frequency * hm * baseFreqMult
          y += Math.sin(x * freq + basePhase + phaseShift * hm) * amp
        }

        path.push({ x, y })
      }

      paths.push(path)
    }

    return paths
  }

  // ============================================
  // PATH RENDERING — Direct Canvas 2D API
  // ============================================

  interface GradientConsts {
    halfW: number
    halfH: number
    radialMaxDist: number
  }

  function renderPath(
    path: PathPoint[],
    pathIndex: number,
    s: OrganicSettings,
    parsedStops: ParsedStop[],
    gc: GradientConsts,
    c: CanvasRenderingContext2D,
  ): PathPoint[] | null {
    if (path.length < 2) return null

    const len = path.length
    const invLen = 1 / (len - 1)
    const subdivisions = 4
    const invSub = 1 / subdivisions
    const hasTaper = s.taper > 0
    const taperAmount = s.taper / 100
    const baseWeight = s.lineWeight
    const hasWobble = s.wobble > 0
    const hasRoughness = s.roughness > 0
    const wobbleAmt = s.wobble * 0.5
    const roughAmt = s.roughness * 0.1
    const gradType = s.gradientType
    const PI = p.PI

    // Pre-apply organic effects to all points
    // Use flat arrays to avoid object allocation
    const px = new Float32Array(len)
    const py = new Float32Array(len)

    for (let i = 0; i < len; i++) {
      let x = path[i].x
      let y = path[i].y

      if (hasWobble) {
        const ws = 0.02
        x += p.noise(i * ws, pathIndex, 0) * wobbleAmt - wobbleAmt / 2
        y += p.noise(i * ws, pathIndex, 100) * wobbleAmt - wobbleAmt / 2
      }
      if (hasRoughness) {
        x += p.random(-roughAmt, roughAmt)
        y += p.random(-roughAmt, roughAmt)
      }

      px[i] = x
      py[i] = y
    }

    // Draw subdivided line segments
    for (let i = 0; i < len - 1; i++) {
      const t1 = i * invLen
      const t2 = (i + 1) * invLen
      const x1 = px[i]
      const y1 = py[i]
      const x2 = px[i + 1]
      const y2 = py[i + 1]
      const dx = x2 - x1
      const dy = y2 - y1

      for (let sub = 0; sub < subdivisions; sub++) {
        const st1 = sub * invSub
        const st2 = (sub + 1) * invSub

        const sx1 = x1 + dx * st1
        const sy1 = y1 + dy * st1
        const sx2 = x1 + dx * st2
        const sy2 = y1 + dy * st2

        // Color at midpoint of sub-segment
        const midT = t1 + (t2 - t1) * ((st1 + st2) * 0.5)

        let gradientT: number
        if (gradType === 'pathAlong') {
          gradientT = midT
        } else {
          const mx = (sx1 + sx2) * 0.5
          const my = (sy1 + sy2) * 0.5
          switch (gradType) {
            case 'horizontal':
              gradientT = mx / p.width
              break
            case 'vertical':
              gradientT = my / p.height
              break
            case 'radial': {
              const rdx = mx - gc.halfW
              const rdy = my - gc.halfH
              gradientT = Math.sqrt(rdx * rdx + rdy * rdy) / gc.radialMaxDist
              break
            }
            case 'angular':
              gradientT = (Math.atan2(my - gc.halfH, mx - gc.halfW) + PI) / (PI * 2)
              break
            default:
              gradientT = midT
          }
        }

        const [r, g, b] = lerpParsedStops(gradientT, parsedStops)
        c.strokeStyle = `rgb(${r},${g},${b})`

        if (hasTaper) {
          const taperCurve = Math.sin(midT * PI)
          c.lineWidth = Math.max(0.5, baseWeight * (1 - taperAmount + taperAmount * taperCurve))
        } else {
          c.lineWidth = baseWeight
        }

        c.beginPath()
        c.moveTo(sx1, sy1)
        c.lineTo(sx2, sy2)
        c.stroke()
      }
    }

    // Convert processed points back to PathPoint[]
    const result: PathPoint[] = new Array(len)
    for (let i = 0; i < len; i++) {
      result[i] = { x: px[i], y: py[i] }
    }
    return result
  }

  // ============================================
  // POST-PROCESSING
  // ============================================

  function applyGrain(s: OrganicSettings) {
    const c = ctx()
    const d = p.pixelDensity()
    const w = p.width * d
    const h = p.height * d
    const imageData = c.getImageData(0, 0, w, h)
    const data = imageData.data
    const intensity = s.grainAmount / 100

    for (let i = 0; i < data.length; i += 4) {
      const v = ((Math.random() - 0.5) * intensity * 100) | 0
      data[i]     = Math.min(255, Math.max(0, data[i] + v))
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + v))
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + v))
    }

    c.putImageData(imageData, 0, 0)
  }

  function applyCanvasTexture(s: OrganicSettings) {
    const c = ctx()
    const d = p.pixelDensity()
    const w = p.width * d
    const h = p.height * d
    const imageData = c.getImageData(0, 0, w, h)
    const data = imageData.data
    const intensity = s.textureAmount / 100

    // Pre-compute noise at half resolution
    const step = 2
    const nmW = Math.ceil(w / step)
    const nmH = Math.ceil(h / step)
    const noiseMap = new Float32Array(nmW * nmH)

    p.noiseSeed(42)
    for (let ny = 0; ny < nmH; ny++) {
      const py = ny * step
      for (let nx = 0; nx < nmW; nx++) {
        const px = nx * step
        const fine = p.noise(px * 0.5, py * 0.5) - 0.5
        const med = p.noise(px * 0.1 + 100, py * 0.1 + 100) - 0.5
        const coarse = p.noise(px * 0.02 + 200, py * 0.02 + 200) - 0.5
        noiseMap[ny * nmW + nx] = (fine * 0.4 + med * 0.35 + coarse * 0.25) * intensity * 80
      }
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4
        const nx = (x / step) | 0
        const ny = (y / step) | 0
        const v = noiseMap[ny * nmW + nx]

        data[idx]     = Math.min(255, Math.max(0, data[idx] + v))
        data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] + v))
        data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] + v))
      }
    }

    c.putImageData(imageData, 0, 0)
  }
}
