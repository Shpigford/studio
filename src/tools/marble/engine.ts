import type { RefObject } from "react"
import type { MarbleSettings } from "./types"
import { VERT_SHADER, FRAG_SHADER } from "./shaders"
import { hexToRgb } from "@/lib/color"

export type MarbleEngine = {
  canvas: HTMLCanvasElement
  resize: (w: number, h: number) => void
  destroy: () => void
}

function hexToVec3(hex: string): [number, number, number] {
  const rgb = hexToRgb(hex)
  if (!rgb) return [1, 1, 1]
  return [rgb.r / 255, rgb.g / 255, rgb.b / 255]
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function generateNoiseTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
  const size = 256
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const v = (Math.random() * 255) | 0
    data[i * 4] = v
    data[i * 4 + 1] = (Math.random() * 255) | 0
    data[i * 4 + 2] = (Math.random() * 255) | 0
    data[i * 4 + 3] = 255
  }

  const texture = gl.createTexture()
  if (!texture) return null
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  return texture
}

export function createMarbleEngine(
  canvas: HTMLCanvasElement,
  settingsRef: RefObject<MarbleSettings>,
): MarbleEngine | null {
  const ctx = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
  })
  if (!ctx) return null
  // Local alias so TypeScript narrows the type in closures
  const gl: WebGL2RenderingContext = ctx

  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SHADER)
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SHADER)
  if (!vert || !frag) return null

  const program = gl.createProgram()!
  gl.attachShader(program, vert)
  gl.attachShader(program, frag)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program))
    return null
  }

  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)

  const noiseTex = generateNoiseTexture(gl)

  // Cache uniform locations
  const loc = {
    uTime: gl.getUniformLocation(program, "uTime"),
    uResolution: gl.getUniformLocation(program, "uResolution"),
    uNoiseTex: gl.getUniformLocation(program, "uNoiseTex"),
    uColorMain: gl.getUniformLocation(program, "uColorMain"),
    uColorLow: gl.getUniformLocation(program, "uColorLow"),
    uColorMid: gl.getUniformLocation(program, "uColorMid"),
    uColorHigh: gl.getUniformLocation(program, "uColorHigh"),
    uNoiseScale: gl.getUniformLocation(program, "uNoiseScale"),
    uWindSpeed: gl.getUniformLocation(program, "uWindSpeed"),
    uWarpPower: gl.getUniformLocation(program, "uWarpPower"),
    uFbmStrength: gl.getUniformLocation(program, "uFbmStrength"),
    uFbmDamping: gl.getUniformLocation(program, "uFbmDamping"),
    uWatercolorDetail: gl.getUniformLocation(program, "uWatercolorDetail"),
    uWatercolorWarp: gl.getUniformLocation(program, "uWatercolorWarp"),
    uBlurRadius: gl.getUniformLocation(program, "uBlurRadius"),
    uGrain: gl.getUniformLocation(program, "uGrain"),
    uVeinIntensity: gl.getUniformLocation(program, "uVeinIntensity"),
    uVeinScale: gl.getUniformLocation(program, "uVeinScale"),
    uVeinColor: gl.getUniformLocation(program, "uVeinColor"),
  }

  let rafId = 0
  let animTime = 0
  let lastFrameTime = performance.now()

  function frame() {
    const s = settingsRef.current
    if (!s) { rafId = requestAnimationFrame(frame); return }

    const now = performance.now()
    if (s.animated) {
      animTime += ((now - lastFrameTime) / 1000) * s.speed * 0.85
    }
    lastFrameTime = now
    const elapsed = animTime

    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(program)

    gl.uniform1f(loc.uTime, elapsed)
    gl.uniform2f(loc.uResolution, canvas.width, canvas.height)

    const main = hexToVec3(s.colorMain)
    const low = hexToVec3(s.colorLow)
    const mid = hexToVec3(s.colorMid)
    const high = hexToVec3(s.colorHigh)
    gl.uniform3f(loc.uColorMain, main[0], main[1], main[2])
    gl.uniform3f(loc.uColorLow, low[0], low[1], low[2])
    gl.uniform3f(loc.uColorMid, mid[0], mid[1], mid[2])
    gl.uniform3f(loc.uColorHigh, high[0], high[1], high[2])

    gl.uniform1f(loc.uNoiseScale, s.noiseScale)
    gl.uniform1f(loc.uWindSpeed, s.windSpeed)
    gl.uniform1f(loc.uWarpPower, s.warpPower)
    gl.uniform1f(loc.uFbmStrength, s.fbmStrength)
    gl.uniform1f(loc.uFbmDamping, s.fbmDamping)
    gl.uniform1f(loc.uWatercolorDetail, s.watercolorDetail)
    gl.uniform1f(loc.uWatercolorWarp, s.watercolorWarp)
    gl.uniform1f(loc.uBlurRadius, s.blurRadius)
    gl.uniform1f(loc.uGrain, s.grain / 100)
    gl.uniform1f(loc.uVeinIntensity, s.veinIntensity)
    gl.uniform1f(loc.uVeinScale, s.veinScale)
    const vc = hexToVec3(s.veinColor)
    gl.uniform3f(loc.uVeinColor, vc[0], vc[1], vc[2])

    if (noiseTex) {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, noiseTex)
      gl.uniform1i(loc.uNoiseTex, 0)
    }

    gl.drawArrays(gl.TRIANGLES, 0, 3)
    rafId = requestAnimationFrame(frame)
  }

  rafId = requestAnimationFrame(frame)

  return {
    canvas,
    resize(w: number, h: number) {
      canvas.width = w
      canvas.height = h
    },
    destroy() {
      cancelAnimationFrame(rafId)
      gl.deleteTexture(noiseTex)
      gl.deleteProgram(program)
      gl.deleteShader(vert)
      gl.deleteShader(frag)
      if (vao) gl.deleteVertexArray(vao)
    },
  }
}
