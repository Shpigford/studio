import type { ColorStop } from '@/types/tools'

export type PathPoint = { x: number; y: number }
export type OrganicGeometry = { paths: PathPoint[][]; width: number; height: number }

export type FlowFieldSettings = {
  noiseScale: number
  turbulence: number
  steps: number
  stepLength: number
}

export type WanderingSettings = {
  angleVar: number
  momentum: number
  attraction: number
  steps: number
  stepLength: number
}

export type WaveSettings = {
  count: number
  amplitude: number
  frequency: number
  phaseShift: number
  harmonics: number
  variation: number
}

export type OrganicSettings = {
  canvasSize: number
  bgColor: string
  pathType: 'flowField' | 'wandering' | 'waves'
  pathCount: number
  lineWeight: number
  seed: number
  wobble: number
  roughness: number
  taper: number
  gradientType: 'pathAlong' | 'horizontal' | 'vertical' | 'radial' | 'angular'
  palette: string
  colorStops: ColorStop[]
  grainAmount: number
  textureAmount: number
  padding: number
  flowField: FlowFieldSettings
  wandering: WanderingSettings
  waves: WaveSettings
}
