export type RectBlock = { x: number; y: number; w: number; h: number }
export type PolyBlock = { points: { x: number; y: number }[] }
export type BlocksGeometry = { rects: RectBlock[]; polys: PolyBlock[]; width: number; height: number }

export type BlocksSettings = {
  seed: number
  bgColor: string
  patternType: 'mondrian' | 'grid' | 'horizontal' | 'diagonal'
  blockCount: number
  complexity: number
  lineWeight: number
  rotation: number
  palette: string
  colors: string[]
  lineColor: string
  canvasPreset: import('@/lib/canvas-size').CanvasPreset
  customWidth: number
  customHeight: number
  asymmetry: number
  colorDensity: number
  gridDivisions: number
  texture: number
  grain: number
  halftone: number
  halftoneSize: number
  halftoneMisalign: number
  halftoneAngle: number
  edgeWobble: number
}
