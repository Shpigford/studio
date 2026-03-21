export type PlotterPoint = { x: number; y: number }

export type PlotterPrimitiveShapeType =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'star'
  | 'cross'
  | 'ring'
  | 'line'
  | 'diamond'

export type PlotterShapePrimitive = {
  type: 'shape'
  shapeType: PlotterPrimitiveShapeType
  x: number
  y: number
  size: number
  color: string
  rotation: number
  filled: boolean
  strokeWeight: number
}

export type PlotterPathPrimitive = {
  type: 'path'
  points: PlotterPoint[]
  closed: boolean
  color: string
  strokeWeight: number
  filled: boolean
}

export type PlotterGeometry = {
  elements: (PlotterShapePrimitive | PlotterPathPrimitive)[]
  bgColor: string
  width: number
  height: number
  margin: number
}

export type StippledSettings = {
  dotSpacing: number
  dotSize: number
  sizeVariation: number
  dash: boolean
  dashLength: number
}

export type MultiStrokeSettings = {
  count: number
  spread: number
  variation: number
}

export type CalligraphicSettings = {
  angle: number
  minWidth: number
  maxWidth: number
  smoothing: number
}

export type StampSettings = {
  shape: 'circle' | 'square' | 'triangle' | 'star' | 'cross'
  spacing: number
  size: number
  sizeVariation: number
  rotation: number
  rotationVariation: number
  scatter: number
}

export type FlowFieldSettings = {
  lineCount: number
  stepLength: number
  steps: number
}

export type ConcentricSettings = {
  count: number
  spacing: number
}

export type WavesSettings = {
  count: number
  amplitude: number
  frequency: number
}

export type HatchingSettings = {
  angle: number
  spacing: number
  crossHatch: boolean
}

export type GeometricSettings = {
  shape: 'hexagon' | 'triangle' | 'square'
  size: number
}

export type PlotterSettings = {
  canvasPreset: import('@/lib/canvas-size').CanvasPreset
  customWidth: number
  customHeight: number
  bgColor: string
  margin: number
  seed: number
  patternType: 'dotGrid' | 'flowField' | 'concentric' | 'waves' | 'hatching' | 'geometric'
  columns: number
  rows: number
  jitter: number
  shapeType: 'circle' | 'square' | 'line' | 'cross' | 'ring' | 'diamond'
  minSize: number
  maxSize: number
  strokeWeight: number
  filled: boolean
  rotation: number
  wobble: number
  roughness: number
  strokeTaper: number
  brushType: 'normal' | 'stippled' | 'multiStroke' | 'calligraphic' | 'stamp'
  stippled: StippledSettings
  multiStroke: MultiStrokeSettings
  calligraphic: CalligraphicSettings
  stamp: StampSettings
  noiseScale: number
  noiseIntensity: number
  flowField: FlowFieldSettings
  concentric: ConcentricSettings
  waves: WavesSettings
  hatching: HatchingSettings
  geometric: GeometricSettings
  palette: string
  colors: string[]
  textureAmount: number
  textureSize: number
}
