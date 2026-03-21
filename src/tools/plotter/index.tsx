import { useCallback, useRef } from 'react'
import type { RefObject } from 'react'
import type p5 from 'p5'
import { useSettings } from '@/hooks/use-settings'
import { useP5 } from '@/hooks/use-p5'
import { exportPNG, exportSVG, generateFilename } from '@/lib/export'
import { CanvasArea } from '@/components/canvas-area'
import { Sidebar } from '@/components/sidebar'
import { Section } from '@/components/controls/section'
import { SliderControl } from '@/components/controls/slider-control'
import { SelectControl } from '@/components/controls/select-control'
import { ColorControl } from '@/components/controls/color-control'
import { SwitchControl } from '@/components/controls/switch-control'
import { ButtonRow } from '@/components/controls/button-row'
import { Button } from '@/components/ui/button'
import { useShortcutActions } from '@/hooks/use-shortcut-actions'
import { Kbd } from '@/components/ui/kbd'
import { CanvasSizeControl } from '@/components/controls/canvas-size-control'
import type { CanvasPreset } from '@/lib/canvas-size'
import { createPlotterSketch, PALETTES } from './sketch'
import { generatePlotterSvg } from './svg'
import type { PlotterSettings, PlotterGeometry } from './types'

const BG_COLORS = ['#f5f5dc', '#faf0e6', '#fff8e7', '#f0f0f0', '#1a1a1a', '#0d0d0d', '#f5f5f5', '#e8e4d9']

const DEFAULTS: PlotterSettings = {
  canvasPreset: 'square',
  customWidth: 2048,
  customHeight: 2048,
  bgColor: '#f5f5dc',
  margin: 40,
  seed: 12345,
  patternType: 'dotGrid',
  columns: 20,
  rows: 20,
  jitter: 0,
  shapeType: 'circle',
  minSize: 4,
  maxSize: 24,
  strokeWeight: 1,
  filled: true,
  rotation: 0,
  wobble: 0,
  roughness: 0,
  strokeTaper: 0,
  brushType: 'normal',
  stippled: { dotSpacing: 5, dotSize: 2, sizeVariation: 0.3, dash: false, dashLength: 4 },
  multiStroke: { count: 3, spread: 5, variation: 0.2 },
  calligraphic: { angle: 45, minWidth: 0.5, maxWidth: 3, smoothing: 0.5 },
  stamp: { shape: 'circle', spacing: 15, size: 8, sizeVariation: 0.3, rotation: 0, rotationVariation: 0, scatter: 0 },
  noiseScale: 0.02,
  noiseIntensity: 1.0,
  flowField: { lineCount: 200, stepLength: 5, steps: 40 },
  concentric: { count: 20, spacing: 20 },
  waves: { count: 20, amplitude: 30, frequency: 0.05 },
  hatching: { angle: 45, spacing: 8, crossHatch: false },
  geometric: { shape: 'hexagon', size: 40 },
  palette: 'purplePink',
  colors: ['#1a1a3e', '#d4a5c9', '#8b6b8a'],
  textureAmount: 0,
  textureSize: 1,
}

function hsbToHex(h: number, s: number, b: number): string {
  s /= 100; b /= 100
  const k = (n: number) => (n + h / 60) % 6
  const f = (n: number) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)))
  const r = Math.round(255 * f(5))
  const g = Math.round(255 * f(3))
  const bl = Math.round(255 * f(1))
  return '#' + [r, g, bl].map(x => x.toString(16).padStart(2, '0')).join('')
}

function randomColor(): string {
  return hsbToHex(
    Math.floor(Math.random() * 360),
    Math.floor(Math.random() * 60 + 40),
    Math.floor(Math.random() * 60 + 30),
  )
}

const showShapeControls = (t: string) => t === 'dotGrid' || t === 'geometric'
const showBrushControls = (t: string) => t === 'flowField' || t === 'concentric' || t === 'waves' || t === 'hatching'

export default function Plotter() {
  const containerRef = useRef<HTMLDivElement>(null)
  const geometryRef = useRef<PlotterGeometry | null>(null)
  const [settings, update, reset] = useSettings<PlotterSettings>('plotter', DEFAULTS)
  const sketchFn = useCallback(
    (p: p5, settingsRef: RefObject<PlotterSettings>) => createPlotterSketch(p, settingsRef, geometryRef),
    [],
  )
  const p5Ref = useP5(containerRef, sketchFn, settings)
  const hasRasterEffects = settings.textureAmount > 0
  useShortcutActions({ randomize, reset, download: hasRasterEffects ? handleExportPNG : handleExportSVG })

  function handlePaletteChange(name: string) {
    if (name === 'custom') {
      update({ palette: 'custom' })
    } else {
      const pal = PALETTES[name]
      if (pal) update({ palette: name, colors: [...pal] })
    }
  }

  function handleColorChange(index: number, color: string) {
    const newColors = [...settings.colors]
    newColors[index] = color
    update({ colors: newColors, palette: 'custom' })
  }

  function randomize() {
    const patternTypes: PlotterSettings['patternType'][] = ['dotGrid', 'flowField', 'concentric', 'waves', 'hatching', 'geometric']
    const shapeTypes: PlotterSettings['shapeType'][] = ['circle', 'square', 'line', 'cross', 'ring', 'diamond']
    const geoShapes: PlotterSettings['geometric']['shape'][] = ['hexagon', 'triangle', 'square']
    const stampShapes: PlotterSettings['stamp']['shape'][] = ['circle', 'square', 'triangle', 'star', 'cross']
    const brushTypes: PlotterSettings['brushType'][] = ['normal', 'stippled', 'multiStroke', 'calligraphic', 'stamp']

    const useRandomColors = Math.random() < 0.3
    const paletteNames = Object.keys(PALETTES)
    const palName = paletteNames[Math.floor(Math.random() * paletteNames.length)]
    const numColors = Math.floor(Math.random() * 3) + 2
    const colors: string[] = []
    if (useRandomColors) {
      for (let i = 0; i < numColors; i++) colors.push(randomColor())
    } else {
      const pal = PALETTES[palName]
      for (let i = 0; i < numColors; i++) colors.push(pal[i % pal.length])
    }

    const hasOrganic = Math.random() > 0.4

    update({
      seed: Math.floor(Math.random() * 99999),
      patternType: patternTypes[Math.floor(Math.random() * patternTypes.length)],
      bgColor: BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)],
      margin: Math.floor(Math.random() * 60 + 20),
      columns: Math.floor(Math.random() * 42 + 8),
      rows: Math.floor(Math.random() * 42 + 8),
      jitter: Math.random() < 0.5 ? 0 : Math.random() * 0.5,
      shapeType: shapeTypes[Math.floor(Math.random() * shapeTypes.length)],
      minSize: Math.floor(Math.random() * 13 + 2),
      maxSize: Math.floor(Math.random() * 45 + 15),
      strokeWeight: [0.5, 1, 1.5, 2][Math.floor(Math.random() * 4)],
      filled: Math.random() > 0.3,
      rotation: Math.random() < 0.5 ? 0 : Math.floor(Math.random() * 360),
      wobble: hasOrganic ? Math.random() * 2 + 0.5 : 0,
      roughness: hasOrganic ? Math.random() * 1.5 : 0,
      strokeTaper: hasOrganic && Math.random() > 0.5 ? Math.random() * 0.4 + 0.2 : 0,
      brushType: Math.random() > 0.4 ? brushTypes[Math.floor(Math.random() * 4) + 1] : 'normal',
      noiseScale: Math.random() * 0.045 + 0.005,
      noiseIntensity: Math.random() + 0.5,
      palette: useRandomColors ? 'custom' : palName,
      colors,
      textureAmount: Math.random() > 0.5 ? Math.floor(Math.random() * 20 + 5) : 0,
      textureSize: Math.floor(Math.random() * 3 + 1),
      flowField: {
        lineCount: Math.floor(Math.random() * 300 + 100),
        stepLength: Math.floor(Math.random() * 8 + 2),
        steps: Math.floor(Math.random() * 40 + 20),
      },
      concentric: {
        count: Math.floor(Math.random() * 40 + 10),
        spacing: Math.floor(Math.random() * 22 + 8),
      },
      waves: {
        count: Math.floor(Math.random() * 40 + 10),
        amplitude: Math.floor(Math.random() * 50 + 10),
        frequency: Math.random() * 0.08 + 0.02,
      },
      hatching: {
        angle: Math.floor(Math.random() * 180),
        spacing: Math.floor(Math.random() * 11 + 4),
        crossHatch: Math.random() > 0.5,
      },
      geometric: {
        shape: geoShapes[Math.floor(Math.random() * geoShapes.length)],
        size: Math.floor(Math.random() * 40 + 20),
      },
      stippled: {
        dotSpacing: Math.floor(Math.random() * 12 + 3),
        dotSize: Math.random() * 3 + 1,
        sizeVariation: Math.random() * 0.6,
        dash: Math.random() > 0.7,
        dashLength: Math.floor(Math.random() * 7 + 3),
      },
      multiStroke: {
        count: Math.floor(Math.random() * 3 + 2),
        spread: Math.floor(Math.random() * 8 + 2),
        variation: Math.random() * 0.5,
      },
      calligraphic: {
        angle: Math.floor(Math.random() * 180),
        minWidth: Math.random() * 0.4 + 0.2,
        maxWidth: Math.random() * 2.5 + 1.5,
        smoothing: Math.random() * 0.6 + 0.2,
      },
      stamp: {
        shape: stampShapes[Math.floor(Math.random() * stampShapes.length)],
        spacing: Math.floor(Math.random() * 22 + 8),
        size: Math.floor(Math.random() * 9 + 3),
        sizeVariation: Math.random() * 0.5,
        rotation: Math.floor(Math.random() * 360),
        rotationVariation: Math.floor(Math.random() * 90),
        scatter: Math.random() > 0.5 ? Math.floor(Math.random() * 8 + 2) : 0,
      },
    })
  }

  function handleExportSVG() {
    const geo = geometryRef.current
    if (!geo) return
    const svg = generatePlotterSvg(geo)
    if (svg) exportSVG(svg, generateFilename('plotter', 'svg'))
  }

  function handleExportPNG() {
    const canvas = (p5Ref.current as unknown as { canvas: HTMLCanvasElement })?.canvas
    if (canvas) exportPNG(canvas, generateFilename('plotter', 'png'))
  }

  return (
    <>
      <Sidebar footer={
        <ButtonRow>
          <Button variant="secondary" onClick={randomize}>Randomize <Kbd>R</Kbd></Button>
          <Button variant="secondary" onClick={reset}>Reset <Kbd>⌫</Kbd></Button>
          {hasRasterEffects ? (
            <>
              <Button variant="primary" onClick={handleExportPNG}>Export PNG <Kbd>⌘S</Kbd></Button>
              <Button variant="secondary" onClick={handleExportSVG}>Export SVG</Button>
            </>
          ) : (
            <>
              <Button variant="primary" onClick={handleExportSVG}>Export SVG <Kbd>⌘S</Kbd></Button>
              <Button variant="secondary" onClick={handleExportPNG}>Export PNG</Button>
            </>
          )}
        </ButtonRow>
      }>
        <h2 className="mb-3 text-base font-medium text-text-primary">Plotter</h2>

        <Section title="Canvas">
          <CanvasSizeControl
            preset={settings.canvasPreset}
            customWidth={settings.customWidth}
            customHeight={settings.customHeight}
            onPresetChange={(v) => update({ canvasPreset: v as CanvasPreset })}
            onWidthChange={(v) => update({ customWidth: v })}
            onHeightChange={(v) => update({ customHeight: v })}
          />
          <ColorControl label="Background" value={settings.bgColor} onChange={(v) => update({ bgColor: v })} />
          <SliderControl label="Margin" value={settings.margin} min={0} max={100} step={5} onChange={(v) => update({ margin: v })} />
        </Section>

        <Section title="Pattern">
          <SliderControl label="Seed" value={settings.seed} min={0} max={99999} step={1} onChange={(v) => update({ seed: v })} />
          <SelectControl
            label="Type"
            value={settings.patternType}
            options={[
              { value: 'dotGrid', label: 'Dot Grid' },
              { value: 'flowField', label: 'Flow Field' },
              { value: 'concentric', label: 'Concentric' },
              { value: 'waves', label: 'Waves' },
              { value: 'hatching', label: 'Hatching' },
              { value: 'geometric', label: 'Geometric' },
            ]}
            onChange={(v) => update({ patternType: v as PlotterSettings['patternType'] })}
          />

          {settings.patternType === 'dotGrid' && (
            <>
              <SliderControl label="Columns" value={settings.columns} min={5} max={100} step={1} onChange={(v) => update({ columns: v })} />
              <SliderControl label="Rows" value={settings.rows} min={5} max={100} step={1} onChange={(v) => update({ rows: v })} />
              <SliderControl label="Jitter" value={settings.jitter} min={0} max={1} step={0.05} decimals={2} onChange={(v) => update({ jitter: v })} />
            </>
          )}

          {settings.patternType === 'flowField' && (
            <>
              <SliderControl label="Line Count" value={settings.flowField.lineCount} min={50} max={800} step={10} onChange={(v) => update({ flowField: { ...settings.flowField, lineCount: v } })} />
              <SliderControl label="Step Length" value={settings.flowField.stepLength} min={1} max={20} step={1} onChange={(v) => update({ flowField: { ...settings.flowField, stepLength: v } })} />
              <SliderControl label="Steps" value={settings.flowField.steps} min={10} max={100} step={1} onChange={(v) => update({ flowField: { ...settings.flowField, steps: v } })} />
            </>
          )}

          {settings.patternType === 'concentric' && (
            <>
              <SliderControl label="Ring Count" value={settings.concentric.count} min={5} max={100} step={1} onChange={(v) => update({ concentric: { ...settings.concentric, count: v } })} />
              <SliderControl label="Spacing" value={settings.concentric.spacing} min={5} max={50} step={1} onChange={(v) => update({ concentric: { ...settings.concentric, spacing: v } })} />
            </>
          )}

          {settings.patternType === 'waves' && (
            <>
              <SliderControl label="Wave Count" value={settings.waves.count} min={5} max={100} step={1} onChange={(v) => update({ waves: { ...settings.waves, count: v } })} />
              <SliderControl label="Amplitude" value={settings.waves.amplitude} min={5} max={100} step={1} onChange={(v) => update({ waves: { ...settings.waves, amplitude: v } })} />
              <SliderControl label="Frequency" value={settings.waves.frequency} min={0.01} max={0.2} step={0.005} decimals={3} onChange={(v) => update({ waves: { ...settings.waves, frequency: v } })} />
            </>
          )}

          {settings.patternType === 'hatching' && (
            <>
              <SliderControl label="Angle" value={settings.hatching.angle} min={0} max={180} step={1} unit="°" onChange={(v) => update({ hatching: { ...settings.hatching, angle: v } })} />
              <SliderControl label="Spacing" value={settings.hatching.spacing} min={2} max={30} step={1} onChange={(v) => update({ hatching: { ...settings.hatching, spacing: v } })} />
              <SwitchControl label="Cross Hatch" checked={settings.hatching.crossHatch} onChange={(v) => update({ hatching: { ...settings.hatching, crossHatch: v } })} />
            </>
          )}

          {settings.patternType === 'geometric' && (
            <>
              <SelectControl
                label="Grid Layout"
                value={settings.geometric.shape}
                options={[
                  { value: 'hexagon', label: 'Hexagon' },
                  { value: 'triangle', label: 'Triangle' },
                  { value: 'square', label: 'Square' },
                ]}
                onChange={(v) => update({ geometric: { ...settings.geometric, shape: v as PlotterSettings['geometric']['shape'] } })}
              />
              <SliderControl label="Size" value={settings.geometric.size} min={10} max={100} step={1} onChange={(v) => update({ geometric: { ...settings.geometric, size: v } })} />
            </>
          )}
        </Section>

        {showShapeControls(settings.patternType) && (
          <Section title="Shape">
            <SelectControl
              label="Shape"
              value={settings.shapeType}
              options={[
                { value: 'circle', label: 'Circle' },
                { value: 'square', label: 'Square' },
                { value: 'line', label: 'Line' },
                { value: 'cross', label: 'Cross' },
                { value: 'ring', label: 'Ring' },
                { value: 'diamond', label: 'Diamond' },
              ]}
              onChange={(v) => update({ shapeType: v as PlotterSettings['shapeType'] })}
            />
            <SliderControl label="Min Size" value={settings.minSize} min={1} max={50} step={1} onChange={(v) => update({ minSize: v })} />
            <SliderControl label="Max Size" value={settings.maxSize} min={1} max={100} step={1} onChange={(v) => update({ maxSize: v })} />
            <SliderControl label="Stroke Weight" value={settings.strokeWeight} min={0.5} max={5} step={0.5} decimals={1} onChange={(v) => update({ strokeWeight: v })} />
            <SwitchControl label="Filled" checked={settings.filled} onChange={(v) => update({ filled: v })} />
            <SliderControl label="Rotation" value={settings.rotation} min={0} max={360} step={5} unit="°" onChange={(v) => update({ rotation: v })} />
          </Section>
        )}

        {showBrushControls(settings.patternType) && (
          <Section title="Brush">
            <SliderControl label="Stroke Weight" value={settings.strokeWeight} min={0.5} max={5} step={0.5} decimals={1} onChange={(v) => update({ strokeWeight: v })} />
            <SelectControl
              label="Type"
              value={settings.brushType}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'stippled', label: 'Stippled' },
                { value: 'multiStroke', label: 'Multi-stroke' },
                { value: 'calligraphic', label: 'Calligraphic' },
                { value: 'stamp', label: 'Stamp' },
              ]}
              onChange={(v) => update({ brushType: v as PlotterSettings['brushType'] })}
            />

            {settings.brushType === 'stippled' && (
              <>
                <SliderControl label="Dot Spacing" value={settings.stippled.dotSpacing} min={1} max={20} step={1} onChange={(v) => update({ stippled: { ...settings.stippled, dotSpacing: v } })} />
                <SliderControl label="Dot Size" value={settings.stippled.dotSize} min={0.5} max={6} step={0.5} decimals={1} onChange={(v) => update({ stippled: { ...settings.stippled, dotSize: v } })} />
                <SliderControl label="Size Variation" value={settings.stippled.sizeVariation} min={0} max={1} step={0.1} decimals={1} onChange={(v) => update({ stippled: { ...settings.stippled, sizeVariation: v } })} />
                <SwitchControl label="Dash" checked={settings.stippled.dash} onChange={(v) => update({ stippled: { ...settings.stippled, dash: v } })} />
                {settings.stippled.dash && (
                  <SliderControl label="Dash Length" value={settings.stippled.dashLength} min={1} max={15} step={1} onChange={(v) => update({ stippled: { ...settings.stippled, dashLength: v } })} />
                )}
              </>
            )}

            {settings.brushType === 'multiStroke' && (
              <>
                <SliderControl label="Count" value={settings.multiStroke.count} min={2} max={8} step={1} onChange={(v) => update({ multiStroke: { ...settings.multiStroke, count: v } })} />
                <SliderControl label="Spread" value={settings.multiStroke.spread} min={1} max={20} step={1} onChange={(v) => update({ multiStroke: { ...settings.multiStroke, spread: v } })} />
                <SliderControl label="Variation" value={settings.multiStroke.variation} min={0} max={1} step={0.1} decimals={1} onChange={(v) => update({ multiStroke: { ...settings.multiStroke, variation: v } })} />
              </>
            )}

            {settings.brushType === 'calligraphic' && (
              <>
                <SliderControl label="Pen Angle" value={settings.calligraphic.angle} min={0} max={180} step={1} unit="°" onChange={(v) => update({ calligraphic: { ...settings.calligraphic, angle: v } })} />
                <SliderControl label="Min Width" value={settings.calligraphic.minWidth} min={0.1} max={2} step={0.1} decimals={1} onChange={(v) => update({ calligraphic: { ...settings.calligraphic, minWidth: v } })} />
                <SliderControl label="Max Width" value={settings.calligraphic.maxWidth} min={1} max={6} step={0.5} decimals={1} onChange={(v) => update({ calligraphic: { ...settings.calligraphic, maxWidth: v } })} />
                <SliderControl label="Smoothing" value={settings.calligraphic.smoothing} min={0} max={1} step={0.1} decimals={1} onChange={(v) => update({ calligraphic: { ...settings.calligraphic, smoothing: v } })} />
              </>
            )}

            {settings.brushType === 'stamp' && (
              <>
                <SelectControl
                  label="Shape"
                  value={settings.stamp.shape}
                  options={[
                    { value: 'circle', label: 'Circle' },
                    { value: 'square', label: 'Square' },
                    { value: 'triangle', label: 'Triangle' },
                    { value: 'star', label: 'Star' },
                    { value: 'cross', label: 'Cross' },
                  ]}
                  onChange={(v) => update({ stamp: { ...settings.stamp, shape: v as PlotterSettings['stamp']['shape'] } })}
                />
                <SliderControl label="Spacing" value={settings.stamp.spacing} min={3} max={40} step={1} onChange={(v) => update({ stamp: { ...settings.stamp, spacing: v } })} />
                <SliderControl label="Size" value={settings.stamp.size} min={1} max={20} step={1} onChange={(v) => update({ stamp: { ...settings.stamp, size: v } })} />
                <SliderControl label="Size Variation" value={settings.stamp.sizeVariation} min={0} max={1} step={0.1} decimals={1} onChange={(v) => update({ stamp: { ...settings.stamp, sizeVariation: v } })} />
                <SliderControl label="Rotation" value={settings.stamp.rotation} min={0} max={360} step={5} unit="°" onChange={(v) => update({ stamp: { ...settings.stamp, rotation: v } })} />
                <SliderControl label="Rotation Var" value={settings.stamp.rotationVariation} min={0} max={180} step={5} unit="°" onChange={(v) => update({ stamp: { ...settings.stamp, rotationVariation: v } })} />
                <SliderControl label="Scatter" value={settings.stamp.scatter} min={0} max={20} step={1} onChange={(v) => update({ stamp: { ...settings.stamp, scatter: v } })} />
              </>
            )}
          </Section>
        )}

        <Section title="Organic">
          <SliderControl label="Wobble" value={settings.wobble} min={0} max={5} step={0.1} decimals={1} onChange={(v) => update({ wobble: v })} />
          <SliderControl label="Roughness" value={settings.roughness} min={0} max={5} step={0.1} decimals={1} onChange={(v) => update({ roughness: v })} />
          <SliderControl label="Stroke Taper" value={settings.strokeTaper} min={0} max={1} step={0.1} decimals={1} onChange={(v) => update({ strokeTaper: v })} />
        </Section>

        <Section title="Noise">
          <SliderControl label="Scale" value={settings.noiseScale} min={0.001} max={0.1} step={0.001} decimals={3} onChange={(v) => update({ noiseScale: v })} />
          <SliderControl label="Intensity" value={settings.noiseIntensity} min={0} max={2} step={0.1} decimals={1} onChange={(v) => update({ noiseIntensity: v })} />
        </Section>

        <Section title="Color">
          <SelectControl
            label="Palette"
            value={settings.palette}
            options={[
              ...Object.keys(PALETTES).map(name => ({ value: name, label: name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()) })),
              { value: 'custom', label: 'Custom' },
            ]}
            onChange={handlePaletteChange}
          />
          {settings.colors.map((c, i) => (
            <ColorControl
              key={i}
              label={`Color ${i + 1}`}
              value={c}
              onChange={(v) => handleColorChange(i, v)}
            />
          ))}
        </Section>

        <Section title="Texture">
          <SliderControl label="Amount" value={settings.textureAmount} min={0} max={50} step={1} onChange={(v) => update({ textureAmount: v })} />
        </Section>

      </Sidebar>
      <CanvasArea ref={containerRef} />
    </>
  )
}
