export type BlocksSettings = {
  seed: number
  patternType: 'mondrian' | 'grid' | 'horizontal' | 'diagonal'
  blockCount: number
  complexity: number
  lineWeight: number
  rotation: number
  palette: string
  colors: string[]
  lineColor: string
  canvasSize: 'square' | 'landscape' | 'portrait'
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
