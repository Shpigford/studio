import type p5 from 'p5'
import type { RefObject, MutableRefObject } from 'react'
import type { LinesSettings } from './types'
import { resolveCanvasSize } from '@/lib/canvas-size'
import { VERT_SHADER, FRAG_SHADER } from './shaders'
import { generateLineProperties, type LineProperties } from './line-properties'
import {
  parseGradientStops,
  drawHorizontalLines, drawVerticalLines, drawCircles,
  drawDots, drawSpiral, drawRadial, drawLissajous,
} from './shapes'

interface Recorder {
  addFrame: (canvas: HTMLCanvasElement) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P5Any = any

const BLEND_MODE_MAP: Record<string, string> = {
  normal: 'source-over',
  add: 'lighter',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  'hard light': 'hard-light',
  'soft light': 'soft-light',
  dodge: 'color-dodge',
  burn: 'color-burn',
  difference: 'difference',
  exclusion: 'exclusion',
  darken: 'darken',
  lighten: 'lighten',
}

export function createLinesSketch(
  p: p5,
  settingsRef: RefObject<LinesSettings>,
  recorderRef: MutableRefObject<Recorder | null>,
) {
  let effectsGraphics: p5.Graphics | null = null
  let postShader: p5.Shader | null = null
  let noiseBuffer: p5.Graphics | null = null
  let noiseGenerated = false

  let animationTime = 0
  let gradAnimOffset = 0
  let wasPlaying = false

  // Cached line properties
  let cachedProps: LineProperties | null = null
  let cachedPropsKey = ''

  // Cached parsed gradient stops
  let cachedStopsKey = ''
  let parsedStops: ReturnType<typeof parseGradientStops> = []

  let cachedCanvasW = 0
  let cachedCanvasH = 0

  function getLineProps(s: LinesSettings): LineProperties {
    const key = `${s.lineCount}|${s.morseDensity}|${s.dotRatio}`
    if (cachedProps && cachedPropsKey === key) return cachedProps
    cachedPropsKey = key
    cachedProps = generateLineProperties(s.lineCount, s.morseDensity, s.dotRatio, p)
    return cachedProps
  }

  function getParsedStops(s: LinesSettings) {
    const key = s.colorStops.map(st => st.color + st.position).join('|')
    if (key !== cachedStopsKey) {
      cachedStopsKey = key
      parsedStops = parseGradientStops(s.colorStops)
    }
    return parsedStops
  }

  function needsShaderEffects(s: LinesSettings): boolean {
    return s.blur > 0 || s.refraction || s.chromaticAb || s.pixelate ||
      s.halftone || s.crt || s.vhs
  }

  let webglFailed = false

  function ensureEffectsBuffer() {
    if (webglFailed) return
    if (!effectsGraphics) {
      try {
        effectsGraphics = p.createGraphics(cachedCanvasW, cachedCanvasH, p.WEBGL)
        postShader = effectsGraphics.createShader(VERT_SHADER, FRAG_SHADER)
      } catch {
        webglFailed = true
        effectsGraphics = null
        postShader = null
      }
    }
  }

  function generateNoiseBuffer() {
    // Use a canvas directly instead of p5.Graphics + p.noise() which is extremely slow
    // (1M pixels × 2 p.noise calls = ~3 second stall). Fast PRNG + typed array instead.
    const canvas = document.createElement('canvas')
    canvas.width = cachedCanvasW
    canvas.height = cachedCanvasH
    const ctx2 = canvas.getContext('2d')!
    const imageData = ctx2.createImageData(cachedCanvasW, cachedCanvasH)
    const data = imageData.data

    // Simple seeded PRNG (xorshift32) — fast, no p5 dependency
    let seed = (Math.random() * 0xffffffff) >>> 0
    const rand = () => {
      seed ^= seed << 13
      seed ^= seed >> 17
      seed ^= seed << 5
      return (seed >>> 0) / 0xffffffff
    }

    for (let i = 0; i < data.length; i += 4) {
      // Sharp random grain (primary texture)
      const grain = (rand() - 0.5) * 0.5
      // Modulation via fast hash instead of Perlin noise
      const modulation = rand() * 0.4 + 0.6
      // Occasional specks
      const speck = rand() < 0.06 ? (rand() - 0.5) * 0.3 : 0
      // Occasional dust
      const dust = rand() < 0.004 ? -rand() * 0.15 : 0

      let v = grain * modulation + speck + dust
      v = 128 + v * 255 * 0.5

      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }

    ctx2.putImageData(imageData, 0, 0)

    // Wrap in p5.Graphics-compatible image for p.image() / p.tint()
    noiseBuffer = p.createGraphics(cachedCanvasW, cachedCanvasH)
    ;(noiseBuffer.drawingContext as CanvasRenderingContext2D).drawImage(canvas, 0, 0)
    noiseGenerated = true
  }

  function applyShaderEffects(s: LinesSettings) {
    ensureEffectsBuffer()
    if (!effectsGraphics || !postShader) return

    const currentFrame = p.get()
    effectsGraphics.clear()
    effectsGraphics.resetMatrix()
    effectsGraphics.noStroke()
    effectsGraphics.shader(postShader)

    postShader.setUniform('tex0', currentFrame)
    postShader.setUniform('resolution', [cachedCanvasW, cachedCanvasH])
    postShader.setUniform('blurAmount', s.blur)
    postShader.setUniform('chromaticAb', s.chromaticAb ? s.chromaticAbAmount : 0.0)

    // Refraction
    postShader.setUniform('refractionStrength', s.refraction ? s.refractionStrength / 100.0 : 0.0)
    postShader.setUniform('refractionScale', s.refractionScale / 100.0)
    const refractionTypeMap: Record<string, number> = {
      barrel: 0, pincushion: 1, wavyGlass: 2, liquid: 3, ripple: 4, frosted: 5,
    }
    postShader.setUniform('refractionType', refractionTypeMap[s.refractionType] ?? 3)

    // Pixelation
    postShader.setUniform('pixelAmount', s.pixelate ? s.pixelateAmount : 0.0)

    // Halftone
    postShader.setUniform('halftoneEnabled', s.halftone)
    if (s.halftone) {
      const halftoneTypeMap: Record<string, number> = { dots: 0, lines: 1, crosshatch: 2 }
      postShader.setUniform('halftoneType', halftoneTypeMap[s.halftoneType] ?? 0)
      postShader.setUniform('halftoneSize', s.halftoneSize)
      postShader.setUniform('halftoneAngle', s.halftoneAngle)
      postShader.setUniform('halftoneSoftness', s.halftoneSoftness)
      postShader.setUniform('halftoneCoverage', s.halftoneCoverage)
    }

    // CRT/VHS
    postShader.setUniform('time', animationTime * 0.01)
    postShader.setUniform('crtEnabled', s.crt)
    if (s.crt) {
      postShader.setUniform('crtScanlines', s.crtScanlines)
      postShader.setUniform('crtCurvature', s.crtCurvature / 100.0)
      postShader.setUniform('crtVignette', s.crtVignette)
      postShader.setUniform('crtPhosphor', s.crtPhosphor)
    }
    postShader.setUniform('vhsEnabled', s.vhs)
    if (s.vhs) {
      postShader.setUniform('vhsDistortion', s.vhsDistortion)
      postShader.setUniform('vhsTracking', s.vhsTracking)
    }

    // Fullscreen quad
    effectsGraphics.rect(0, 0, cachedCanvasW, cachedCanvasH)

    // Draw result back to main canvas
    p.image(effectsGraphics, 0, 0, cachedCanvasW, cachedCanvasH)
  }

  p.setup = () => {
    const s = settingsRef.current
    const [w, h] = resolveCanvasSize(s.canvasPreset, s.customWidth, s.customHeight)
    cachedCanvasW = w
    cachedCanvasH = h
    p.createCanvas(w, h)
    p.pixelDensity(1)
    p.noLoop()
    p.redraw()
  }

  p.draw = () => {
    const s = settingsRef.current

    // Handle animation toggle
    if (s.isPlaying && !wasPlaying) {
      p.loop()
      wasPlaying = true
    } else if (!s.isPlaying && wasPlaying) {
      wasPlaying = false
    }

    if (s.isPlaying) {
      animationTime += p.deltaTime * 0.001 * (s.animationSpeed / 50)
      if (s.gradAnimSpeed > 0) {
        gradAnimOffset += s.gradAnimSpeed / 5000
        if (gradAnimOffset > 1) gradAnimOffset -= 1
      }
    }

    // Resize canvas if preset changed
    const [tw, th] = resolveCanvasSize(s.canvasPreset, s.customWidth, s.customHeight)
    if (p.width !== tw || p.height !== th) {
      cachedCanvasW = tw
      cachedCanvasH = th
      p.resizeCanvas(tw, th)
      // Recreate effects buffers at new size
      if (effectsGraphics) { effectsGraphics.remove(); effectsGraphics = null; postShader = null }
      if (noiseBuffer) { noiseBuffer.remove(); noiseBuffer = null; noiseGenerated = false }
    }

    const canvasWidth = p.width
    const canvasHeight = p.height
    const ctx = (p.drawingContext as CanvasRenderingContext2D)

    // Background
    if (s.bgGradient) {
      const sortedStops = [...s.bgGradientStops].sort((a, b) => a.position - b.position)
      const w = p.width, h = p.height
      let gradient: CanvasGradient
      if (s.bgGradientType === 'linear') {
        const angle = (s.bgGradientAngle - 90) * Math.PI / 180
        const cx = w / 2, cy = h / 2
        const diag = Math.sqrt(w * w + h * h) / 2
        gradient = ctx.createLinearGradient(
          cx - Math.cos(angle) * diag, cy - Math.sin(angle) * diag,
          cx + Math.cos(angle) * diag, cy + Math.sin(angle) * diag,
        )
      } else {
        const cx = w / 2, cy = h / 2
        const radius = Math.max(w, h) / 2 * 1.42
        gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      }
      for (const stop of sortedStops) {
        gradient.addColorStop(stop.position / 100, stop.color)
      }
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, w, h)
    } else {
      p.background(s.bgColor)
    }

    // Blend mode
    ctx.globalCompositeOperation = (BLEND_MODE_MAP[s.blendMode] ?? 'source-over') as GlobalCompositeOperation

    // Line properties
    const props = getLineProps(s)
    const stops = getParsedStops(s)

    // Set up for line drawing
    ctx.lineCap = 'round'

    // Draw shape
    switch (s.shape) {
      case 'horizontal':
        drawHorizontalLines(p, ctx, s, props, canvasWidth, canvasHeight, animationTime, gradAnimOffset, stops)
        break
      case 'vertical':
        drawVerticalLines(p, ctx, s, props, canvasWidth, canvasHeight, animationTime, gradAnimOffset, stops)
        break
      case 'circles':
        drawCircles(p, ctx, s, props, canvasWidth, canvasHeight, animationTime, gradAnimOffset, stops)
        break
      case 'dots':
        drawDots(p, ctx, s, props, canvasWidth, canvasHeight, animationTime, gradAnimOffset, stops)
        break
      case 'spiral':
        drawSpiral(p, ctx, s, props, canvasWidth, canvasHeight, animationTime, gradAnimOffset, stops)
        break
      case 'radial':
        drawRadial(p, ctx, s, props, canvasWidth, canvasHeight, animationTime, gradAnimOffset, stops)
        break
      case 'lissajous':
        drawLissajous(p, ctx, s, props, canvasWidth, canvasHeight, animationTime, gradAnimOffset, stops)
        break
      default:
        drawHorizontalLines(p, ctx, s, props, canvasWidth, canvasHeight, animationTime, gradAnimOffset, stops)
    }

    // Reset blend mode
    ctx.globalCompositeOperation = 'source-over'

    // Shader post-processing
    if (needsShaderEffects(s)) {
      applyShaderEffects(s)
    }

    // Noise/grain overlay
    if (s.noise > 0) {
      if (!noiseGenerated) generateNoiseBuffer()
      if (noiseBuffer) {
        p.push()
        p.blendMode(p.OVERLAY)
        p.tint(255, s.noise * 2.55)
        p.image(noiseBuffer, 0, 0, p.width, p.height)
        p.pop()
      }
    }

    // Record frame
    if (recorderRef.current) {
      const canvas = (p as P5Any).canvas
      if (canvas) recorderRef.current.addFrame(canvas)
    }

    // Stop looping if not playing
    if (!s.isPlaying) {
      p.noLoop()
    }
  }
}
