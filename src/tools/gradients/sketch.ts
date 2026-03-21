import type p5 from 'p5'
import type { RefObject, MutableRefObject } from 'react'
import type { GradientsSettings } from './types'
import { hexToRgb } from '@/lib/color'
import { resolveCanvasSize } from '@/lib/canvas-size'

interface Recorder {
  addFrame: (canvas: HTMLCanvasElement) => void
}

const vertShader = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  vec4 positionVec4 = vec4(aPosition, 1.0);
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
  gl_Position = positionVec4;
}
`

const fragShader = `
precision highp float;
varying vec2 vTexCoord;

uniform vec2 resolution;
uniform float time;

// Color stops (up to 5)
uniform vec3 color0, color1, color2, color3, color4;
uniform float pos0, pos1, pos2, pos3, pos4;
uniform int numColors;

// Flow controls
uniform float flowAngle;
uniform float noiseScale;
uniform float noiseIntensity;
uniform float curveDistortion;
uniform int noiseOctaves;

// Depth controls
uniform float depthIntensity;
uniform float highlightStrength;
uniform float shadowStrength;
uniform float foldScale;

// Grain controls
uniform float grainIntensity;
uniform float grainSize;

// Adjustments
uniform float brightness;
uniform float contrast;
uniform float saturation;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  float maxValue = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    maxValue += amplitude;
    frequency *= 1.8;
    amplitude *= 0.55;
  }
  return value / maxValue;
}

vec2 warp(vec2 p, float strength) {
  float n1 = fbm(p * 0.4 + time * 0.02, 2);
  float n2 = fbm(p * 0.4 + vec2(5.2, 1.3) + time * 0.018, 2);
  vec2 warped = p + strength * vec2(n1, n2);

  float n3 = fbm(warped * 0.6 + vec2(1.7, 9.2) + time * 0.015, 2);
  float n4 = fbm(warped * 0.6 + vec2(8.3, 2.8) + time * 0.012, 2);
  warped = warped + strength * 0.5 * vec2(n3, n4);

  return warped;
}

float glassWave(vec2 p, float scale, float speed) {
  float wave = sin(p.x * scale + time * speed + fbm(p * 0.5, 2) * 3.0);
  wave += sin(p.y * scale * 0.7 + time * speed * 0.8 + fbm(p * 0.6 + vec2(3.3, 7.1), 2) * 2.5);
  wave += sin((p.x + p.y) * scale * 0.5 + time * speed * 0.6) * 0.5;
  return wave / 2.5;
}

vec3 getGradientColor(float t) {
  t = clamp(t, 0.0, 1.0);

  vec3 colors[5];
  float positions[5];
  colors[0] = color0; positions[0] = pos0;
  colors[1] = color1; positions[1] = pos1;
  colors[2] = color2; positions[2] = pos2;
  colors[3] = color3; positions[3] = pos3;
  colors[4] = color4; positions[4] = pos4;

  vec3 colorA = colors[0];
  vec3 colorB = colors[0];
  float posA = 0.0;
  float posB = 1.0;

  for (int i = 0; i < 4; i++) {
    if (i >= numColors - 1) break;
    if (t >= positions[i] && t <= positions[i + 1]) {
      colorA = colors[i];
      colorB = colors[i + 1];
      posA = positions[i];
      posB = positions[i + 1];
      break;
    }
  }

  float localT = (posB > posA) ? (t - posA) / (posB - posA) : 0.0;
  localT = localT * localT * (3.0 - 2.0 * localT);
  localT = localT * localT * (3.0 - 2.0 * localT);

  return mix(colorA, colorB, localT);
}

void main() {
  vec2 uv = vTexCoord;
  uv.y = 1.0 - uv.y;

  float angle = flowAngle * 3.14159 / 180.0;
  vec2 center = vec2(0.5, 0.5);
  vec2 centeredUV = uv - center;
  vec2 rotatedUV = vec2(
    centeredUV.x * cos(angle) - centeredUV.y * sin(angle),
    centeredUV.x * sin(angle) + centeredUV.y * cos(angle)
  );
  rotatedUV += center;

  vec2 surfaceUV = rotatedUV * noiseScale * 0.4;

  float surface1 = glassWave(surfaceUV, foldScale * 0.8, 0.015);
  float surface2 = fbm(surfaceUV * 0.7 + time * 0.01, 2);
  float surface3 = glassWave(surfaceUV * 1.3 + vec2(2.2, 3.3), foldScale * 1.5, 0.012);

  float heightField = surface1 * 0.5 + surface2 * 0.3 + surface3 * 0.2;

  vec2 warpedUV = warp(surfaceUV, curveDistortion * 2.0);

  float heightDisplace = heightField * curveDistortion * 0.8;
  warpedUV += vec2(heightDisplace, heightDisplace * 0.6);

  float eps = 0.01;

  vec2 uvX = surfaceUV + vec2(eps, 0.0);
  float hX = glassWave(uvX, foldScale * 0.8, 0.015) * 0.5 +
             fbm(uvX * 0.7 + time * 0.01, 2) * 0.3 +
             glassWave(uvX * 1.3 + vec2(2.2, 3.3), foldScale * 1.5, 0.012) * 0.2;

  vec2 uvY = surfaceUV + vec2(0.0, eps);
  float hY = glassWave(uvY, foldScale * 0.8, 0.015) * 0.5 +
             fbm(uvY * 0.7 + time * 0.01, 2) * 0.3 +
             glassWave(uvY * 1.3 + vec2(2.2, 3.3), foldScale * 1.5, 0.012) * 0.2;

  vec3 surfaceNormal = normalize(vec3(
    (heightField - hX) * 2.0,
    (heightField - hY) * 2.0,
    0.3
  ));

  vec3 lightDir = normalize(vec3(0.5, 0.6, 0.8));
  float diffuse = max(dot(surfaceNormal, lightDir), 0.0);

  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(surfaceNormal, halfDir), 0.0), 24.0);

  float fresnel = pow(1.0 - max(dot(surfaceNormal, viewDir), 0.0), 2.5);

  float lighting = diffuse * 0.7 + spec * 0.4 + fresnel * 0.2;

  float gradientT = rotatedUV.x;

  gradientT += fbm(warpedUV * 0.5, noiseOctaves) * noiseIntensity * 0.8;

  gradientT += heightField * depthIntensity * 0.5;

  float lightShift = (lighting - 0.5) * depthIntensity * 0.4;
  gradientT += lightShift;

  gradientT += fresnel * highlightStrength * 0.2;

  vec3 surfaceColor = getGradientColor(gradientT);

  float brightnessVar = 1.0 + (lighting - 0.5) * highlightStrength * 0.3;
  brightnessVar += (heightField - 0.0) * shadowStrength * 0.15;
  surfaceColor *= brightnessVar;

  surfaceColor += vec3(spec * highlightStrength * 0.15);

  vec2 grainUV = uv * resolution / (grainSize * 3.0);
  float grain = fract(sin(dot(grainUV + time * 0.3, vec2(12.9898, 78.233))) * 43758.5453);
  grain = (grain - 0.5) * grainIntensity * 0.3;

  vec3 finalColor = surfaceColor + grain;

  finalColor = (finalColor - 0.5) * contrast + 0.5 + brightness;
  float luminance = dot(finalColor, vec3(0.299, 0.587, 0.114));
  finalColor = mix(vec3(luminance), finalColor, saturation);

  gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
}
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P5Any = any

export function createGradientsSketch(
  p: p5,
  settingsRef: RefObject<GradientsSettings>,
  recorderRef: MutableRefObject<Recorder | null>,
) {
  let shaderGraphics: p5.Graphics
  let gradientShader: p5.Shader
  let animationTime = 0
  let wasAnimating = false
  let cachedCanvasW = 0
  let cachedCanvasH = 0

  // Cached parsed color stops — only recomputed when colorStops change
  let cachedStopsKey = ''
  let parsedColors: number[][] = []
  let parsedPositions: number[] = []
  let parsedCount = 0

  function recomputeColorStops(stops: GradientsSettings['colorStops']) {
    const key = stops.map(s => s.color + s.position).join('|')
    if (key === cachedStopsKey) return
    cachedStopsKey = key

    const sorted = [...stops].sort((a, b) => a.position - b.position)
    parsedCount = sorted.length
    parsedColors = []
    parsedPositions = []

    for (let i = 0; i < 5; i++) {
      const stop = sorted[i] || sorted[sorted.length - 1]
      const c = hexToRgb(stop.color) ?? { r: 0, g: 0, b: 0 }
      parsedColors.push([c.r / 255, c.g / 255, c.b / 255])
      parsedPositions.push(stop.position / 100)
    }
  }

  function setShaderUniforms(shader: p5.Shader) {
    const s = settingsRef.current

    shader.setUniform('resolution', [cachedCanvasW, cachedCanvasH])
    shader.setUniform('time', animationTime)

    recomputeColorStops(s.colorStops)
    for (let i = 0; i < 5; i++) {
      shader.setUniform(`color${i}`, parsedColors[i])
      shader.setUniform(`pos${i}`, parsedPositions[i])
    }
    shader.setUniform('numColors', parsedCount)

    // Flow uniforms
    shader.setUniform('flowAngle', s.flowAngle)
    shader.setUniform('noiseScale', s.noiseScale)
    shader.setUniform('noiseIntensity', s.noiseIntensity / 100)
    shader.setUniform('curveDistortion', s.curveDistortion / 100)
    shader.setUniform('noiseOctaves', s.noiseOctaves)

    // Depth uniforms
    shader.setUniform('depthIntensity', s.depthIntensity / 100)
    shader.setUniform('highlightStrength', s.highlightStrength / 100)
    shader.setUniform('shadowStrength', s.shadowStrength / 100)
    shader.setUniform('foldScale', (s.foldScale / 100) * 3.0)

    // Grain uniforms
    shader.setUniform('grainIntensity', s.grainIntensity / 100)
    shader.setUniform('grainSize', s.grainSize)

    // Adjustment uniforms
    shader.setUniform('brightness', s.brightness / 100)
    shader.setUniform('contrast', s.contrast / 100)
    shader.setUniform('saturation', s.saturation / 100)
  }

  p.setup = () => {
    const s = settingsRef.current
    const [w, h] = resolveCanvasSize(s.canvasPreset, s.customWidth, s.customHeight)
    cachedCanvasW = w
    cachedCanvasH = h
    p.createCanvas(w, h)
    p.pixelDensity(1)

    shaderGraphics = p.createGraphics(w, h, p.WEBGL)
    gradientShader = shaderGraphics.createShader(vertShader, fragShader)

    p.noLoop()
    p.redraw()
  }

  p.draw = () => {
    const s = settingsRef.current

    // Handle animation toggle
    if (s.isAnimating && !wasAnimating) {
      p.loop()
      wasAnimating = true
    } else if (!s.isAnimating && wasAnimating) {
      wasAnimating = false
    }

    if (s.isAnimating) {
      animationTime += p.deltaTime * 0.001 * (s.animationSpeed / 50)
    }

    // Resize canvas if preset changed
    const [tw, th] = resolveCanvasSize(s.canvasPreset, s.customWidth, s.customHeight)
    if (p.width !== tw || p.height !== th) {
      cachedCanvasW = tw
      cachedCanvasH = th
      p.resizeCanvas(tw, th)
      shaderGraphics.remove()
      shaderGraphics = p.createGraphics(tw, th, p.WEBGL)
      gradientShader = shaderGraphics.createShader(vertShader, fragShader)
    }

    // Render shader to offscreen graphics
    shaderGraphics.shader(gradientShader)
    setShaderUniforms(gradientShader)
    shaderGraphics.rect(0, 0, tw, th)

    // Draw to main canvas
    p.image(shaderGraphics, 0, 0, p.width, p.height)

    // Record frame if recording
    if (recorderRef.current) {
      const canvas = (shaderGraphics as P5Any).canvas ?? (shaderGraphics as P5Any).elt
      if (canvas) {
        recorderRef.current.addFrame(canvas)
      }
    }

    // If not animating, stop looping after this frame
    if (!s.isAnimating) {
      p.noLoop()
    }
  }
}
