import type { ColorStop } from '@/types/tools'

export type LinesSettings = {
  canvasPreset: import('@/lib/canvas-size').CanvasPreset
  customWidth: number
  customHeight: number
  // Core
  shape: 'horizontal' | 'vertical' | 'circles' | 'dots' | 'spiral' | 'radial' | 'lissajous'
  frequency: number
  amplitude: number
  lineCount: number
  spacing: number
  padding: number
  thickness: number
  noise: number
  bgColor: string
  lineColor: string
  blendMode: string

  // Lissajous
  lissFreqA: number
  lissFreqB: number
  lissPhase: number
  lissScale: number
  lissResolution: number
  oscillonMode: boolean
  oscillonLayers: number
  oscillonSpread: number

  // Organic
  weightVar: number
  wobble: number
  taper: number
  lineBreaks: boolean
  breakFrequency: number
  morsePattern: boolean
  morseDensity: number
  dotRatio: number
  spacingVar: number
  rotationJitter: number
  opacityVar: number
  colorDrift: number
  perlinFlow: number
  freqVar: number
  noiseOctaves: number

  // Watercolor
  watercolor: boolean
  wcWetness: number
  wcPigment: number
  wcLayers: number
  wcEdgeDarkening: number

  // Glass/Lens
  blur: number
  refraction: boolean
  refractionType: 'barrel' | 'pincushion' | 'wavyGlass' | 'liquid' | 'ripple' | 'frosted'
  refractionStrength: number
  refractionScale: number
  chromaticAb: boolean
  chromaticAbAmount: number
  pixelate: boolean
  pixelateAmount: number

  // Halftone
  halftone: boolean
  halftoneType: 'dots' | 'lines' | 'crosshatch'
  halftoneSize: number
  halftoneAngle: number
  halftoneSoftness: number
  halftoneCoverage: number

  // CRT/VHS
  crt: boolean
  crtScanlines: number
  crtCurvature: number
  crtVignette: number
  crtPhosphor: number
  vhs: boolean
  vhsDistortion: number
  vhsTracking: number

  // Line gradient
  enableGradient: boolean
  gradientType: 'perLine' | 'alongLine' | 'horizontal' | 'vertical' | 'radial'
  colorStops: ColorStop[]
  gradAnimSpeed: number
  gradAnimMode: 'cycle' | 'reverse' | 'bounce'

  // Background gradient
  bgGradient: boolean
  bgGradientType: 'linear' | 'radial'
  bgGradientAngle: number
  bgGradientStops: ColorStop[]

  // Animation
  isPlaying: boolean
  animationSpeed: number
}

export const DEFAULTS: LinesSettings = {
  canvasPreset: 'square',
  customWidth: 2048,
  customHeight: 2048,
  shape: 'horizontal',
  frequency: 0.02,
  amplitude: 30,
  lineCount: 20,
  spacing: 1,
  padding: 50,
  thickness: 1.5,
  noise: 0,
  bgColor: '#141414',
  lineColor: '#ffffff',
  blendMode: 'normal',

  lissFreqA: 3,
  lissFreqB: 4,
  lissPhase: 0,
  lissScale: 0.8,
  lissResolution: 1000,
  oscillonMode: false,
  oscillonLayers: 5,
  oscillonSpread: 0.3,

  weightVar: 0,
  wobble: 0,
  taper: 0,
  lineBreaks: false,
  breakFrequency: 3,
  morsePattern: false,
  morseDensity: 5,
  dotRatio: 30,
  spacingVar: 0,
  rotationJitter: 0,
  opacityVar: 0,
  colorDrift: 0,
  perlinFlow: 0,
  freqVar: 0,
  noiseOctaves: 1,

  watercolor: false,
  wcWetness: 50,
  wcPigment: 50,
  wcLayers: 3,
  wcEdgeDarkening: 30,

  blur: 0,
  refraction: false,
  refractionType: 'liquid',
  refractionStrength: 30,
  refractionScale: 50,
  chromaticAb: false,
  chromaticAbAmount: 5,
  pixelate: false,
  pixelateAmount: 8,

  halftone: false,
  halftoneType: 'dots',
  halftoneSize: 6,
  halftoneAngle: 45,
  halftoneSoftness: 30,
  halftoneCoverage: 70,

  crt: false,
  crtScanlines: 50,
  crtCurvature: 20,
  crtVignette: 30,
  crtPhosphor: 20,
  vhs: false,
  vhsDistortion: 30,
  vhsTracking: 20,

  enableGradient: false,
  gradientType: 'perLine',
  colorStops: [
    { color: '#ff0000', position: 0 },
    { color: '#0000ff', position: 100 },
  ],
  gradAnimSpeed: 0,
  gradAnimMode: 'cycle',

  bgGradient: false,
  bgGradientType: 'linear',
  bgGradientAngle: 0,
  bgGradientStops: [
    { color: '#141414', position: 0 },
    { color: '#2a2a2a', position: 100 },
  ],

  isPlaying: false,
  animationSpeed: 50,
}
