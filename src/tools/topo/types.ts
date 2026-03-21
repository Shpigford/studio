export type Point = { x: number; y: number }
export type ContourPath = { points: Point[]; level: number }
export type TopoGeometry = { contours: ContourPath[]; width: number; height: number }

export type TopoSettings = {
  seed: number
  contourLevels: number
  noiseScale: number
  octaves: number
  falloff: number
  strokeWeight: number
  wobble: number
  roughness: number
  smoothing: number
  bgColor: string
  colorMode: 'single' | 'elevation' | 'palette'
  lineColor: string
  palette: string
  opacity: number
  grain: number
  margin: number
  canvasPreset: import('@/lib/canvas-size').CanvasPreset
  customWidth: number
  customHeight: number
};
