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
import { ButtonRow } from '@/components/controls/button-row'
import { Button } from '@/components/ui/button'
import { GradientEditor } from '@/components/controls/gradient-editor'
import { useShortcutActions } from '@/hooks/use-shortcut-actions'
import { Kbd } from '@/components/ui/kbd'
import { createOrganicSketch } from './sketch'
import { generateOrganicSvg } from './svg'
import type { OrganicSettings, OrganicGeometry } from './types'
import type { ColorStop } from '@/types/tools'

const PALETTES: Record<string, string[]> = {
  rainbow: ['#FF0000', '#FF8800', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF'],
  sunset: ['#FF6B35', '#F7C59F', '#EFEFD0', '#FF9F1C', '#E63946'],
  ocean: ['#0077B6', '#00B4D8', '#90E0EF', '#CAF0F8', '#03045E'],
  forest: ['#2D6A4F', '#40916C', '#52B788', '#74C69D', '#95D5B2'],
  fire: ['#D00000', '#DC2F02', '#E85D04', '#F48C06', '#FAA307'],
  aurora: ['#7400B8', '#6930C3', '#5E60CE', '#5390D9', '#4EA8DE'],
  neon: ['#FF00FF', '#00FFFF', '#FF00AA', '#00FF00', '#FFFF00'],
  pastel: ['#FFB5A7', '#FCD5CE', '#F8EDEB', '#F9DCC4', '#FEC89A'],
  earth: ['#8B4513', '#A0522D', '#CD853F', '#DEB887', '#D2691E'],
  mono: ['#000000', '#333333', '#666666', '#999999', '#CCCCCC'],
}

function paletteToStops(colors: string[]): ColorStop[] {
  return colors.map((color, i) => ({
    color,
    position: Math.round((i / (colors.length - 1)) * 100),
  }))
}

const DEFAULTS: OrganicSettings = {
  canvasSize: 800,
  bgColor: '#ffffff',
  pathType: 'wandering',
  pathCount: 20,
  lineWeight: 12,
  seed: 12345,
  wobble: 0,
  roughness: 0,
  taper: 0,
  gradientType: 'pathAlong',
  palette: 'rainbow',
  colorStops: paletteToStops(PALETTES.rainbow),
  grainAmount: 0,
  textureAmount: 0,
  padding: 0,
  flowField: { noiseScale: 0.01, turbulence: 1.0, steps: 100, stepLength: 5 },
  wandering: { angleVar: 0.15, momentum: 0.85, attraction: 0.02, steps: 200, stepLength: 8 },
  waves: { count: 25, amplitude: 60, frequency: 0.03, phaseShift: 0.2, harmonics: 2, variation: 30 },
}

export default function Organic() {
  const containerRef = useRef<HTMLDivElement>(null)
  const geometryRef = useRef<OrganicGeometry | null>(null)
  const [settings, update, reset] = useSettings<OrganicSettings>('organic', DEFAULTS)
  const sketchFn = useCallback(
    (p: p5, settingsRef: RefObject<OrganicSettings>) => createOrganicSketch(p, settingsRef, geometryRef),
    [],
  )
  const p5Ref = useP5(containerRef, sketchFn, settings)
  const hasRasterEffects = settings.grainAmount > 0 || settings.textureAmount > 0
  useShortcutActions({ randomize, reset, download: hasRasterEffects ? handleExportPNG : handleExportSVG })

  function handlePaletteChange(name: string) {
    if (name === 'custom') {
      update({ palette: 'custom' })
    } else {
      const colors = PALETTES[name]
      if (colors) {
        update({ palette: name, colorStops: paletteToStops(colors) })
      }
    }
  }

  function handleColorStopsChange(colorStops: ColorStop[]) {
    update({ colorStops, palette: 'custom' })
  }

  function randomize() {
    const pathTypes: OrganicSettings['pathType'][] = ['flowField', 'wandering', 'waves']
    const paletteNames = Object.keys(PALETTES)

    // 70% named palette, 30% random colors
    let palette: string
    let colorStops: ColorStop[]
    if (Math.random() > 0.3) {
      palette = paletteNames[Math.floor(Math.random() * paletteNames.length)]
      colorStops = paletteToStops(PALETTES[palette])
    } else {
      palette = 'custom'
      const numColors = Math.floor(Math.random() * 3) + 3
      const baseHue = Math.random() * 360
      colorStops = Array.from({ length: numColors }, (_, i) => {
        const hue = (baseHue + i * (360 / numColors) + (Math.random() - 0.5) * 40) % 360
        const sat = Math.floor(Math.random() * 40 + 50)
        const light = Math.floor(Math.random() * 40 + 30)
        return {
          color: hslToHex(hue, sat, light),
          position: Math.round((i / (numColors - 1)) * 100),
        }
      })
    }

    const hasOrganic = Math.random() > 0.5

    update({
      seed: Math.floor(Math.random() * 99999),
      pathType: pathTypes[Math.floor(Math.random() * pathTypes.length)],
      pathCount: Math.floor(Math.random() * 75) + 5,
      lineWeight: Math.floor(Math.random() * 38) + 2,
      wobble: hasOrganic ? Math.floor(Math.random() * 35) + 5 : 0,
      roughness: hasOrganic ? Math.floor(Math.random() * 20) : 0,
      taper: hasOrganic ? Math.floor(Math.random() * 50) : 0,
      palette,
      colorStops,
      grainAmount: Math.random() > 0.5 ? Math.floor(Math.random() * 20) + 5 : 0,
      textureAmount: Math.random() > 0.7 ? Math.floor(Math.random() * 15) + 5 : 0,
      flowField: {
        noiseScale: Math.random() * 0.02 + 0.005,
        turbulence: Math.random() * 2 + 0.5,
        steps: Math.floor(Math.random() * 100) + 50,
        stepLength: Math.random() * 7 + 3,
      },
      wandering: {
        angleVar: Math.random() * 0.4 + 0.1,
        momentum: Math.random() * 0.6 + 0.2,
        attraction: Math.random() * 0.3,
        steps: Math.floor(Math.random() * 70) + 50,
        stepLength: Math.floor(Math.random() * 22) + 3,
      },
      waves: {
        count: Math.floor(Math.random() * 30) + 10,
        amplitude: Math.random() * 70 + 30,
        frequency: Math.random() * 0.05 + 0.01,
        phaseShift: Math.random() * 0.5,
        harmonics: Math.floor(Math.random() * 3) + 1,
        variation: Math.floor(Math.random() * 80) + 10,
      },
    })
  }

  function handleExportSVG() {
    const geo = geometryRef.current
    if (!geo) return
    const svg = generateOrganicSvg(geo, settings)
    if (svg) exportSVG(svg, generateFilename('organic', 'svg'))
  }

  function handleExportPNG() {
    const canvas = (p5Ref.current as unknown as { canvas: HTMLCanvasElement })?.canvas
    if (canvas) {
      exportPNG(canvas, generateFilename('organic', 'png'))
    }
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
        <h2 className="mb-3 text-base font-medium text-text-primary">Organic</h2>

        <Section title="Canvas">
          <SelectControl
            label="Size"
            value={String(settings.canvasSize)}
            options={[
              { value: '800', label: 'Square (800×800)' },
              { value: '1920', label: 'Wide (1920×1080)' },
            ]}
            onChange={(v) => update({ canvasSize: parseInt(v) })}
          />
          <ColorControl
            label="Background"
            value={settings.bgColor}
            onChange={(v) => update({ bgColor: v })}
          />
          <SliderControl
            label="Padding"
            value={settings.padding}
            min={0}
            max={100}
            step={1}
            onChange={(v) => update({ padding: v })}
          />
        </Section>

        <Section title="Paths">
          <SliderControl
            label="Seed"
            value={settings.seed}
            min={0}
            max={99999}
            step={1}
            onChange={(v) => update({ seed: v })}
          />
          <SelectControl
            label="Path Type"
            value={settings.pathType}
            options={[
              { value: 'flowField', label: 'Flow Field' },
              { value: 'wandering', label: 'Wandering' },
              { value: 'waves', label: 'Waves' },
            ]}
            onChange={(v) => update({ pathType: v as OrganicSettings['pathType'] })}
          />
          <SliderControl
            label="Path Count"
            value={settings.pathCount}
            min={1}
            max={100}
            step={1}
            onChange={(v) => update({ pathCount: v })}
          />
          <SliderControl
            label="Line Weight"
            value={settings.lineWeight}
            min={0.5}
            max={50}
            step={0.5}
            decimals={1}
            onChange={(v) => update({ lineWeight: v })}
          />
        </Section>

        <Section title="Algorithm" defaultOpen={true}>
          {settings.pathType === 'flowField' && (
            <>
              <SliderControl
                label="Noise Scale"
                value={settings.flowField.noiseScale}
                min={0.001}
                max={0.05}
                step={0.001}
                decimals={3}
                onChange={(v) => update({ flowField: { ...settings.flowField, noiseScale: v } })}
              />
              <SliderControl
                label="Turbulence"
                value={settings.flowField.turbulence}
                min={0.5}
                max={3}
                step={0.1}
                decimals={1}
                onChange={(v) => update({ flowField: { ...settings.flowField, turbulence: v } })}
              />
              <SliderControl
                label="Steps"
                value={settings.flowField.steps}
                min={20}
                max={200}
                step={10}
                onChange={(v) => update({ flowField: { ...settings.flowField, steps: v } })}
              />
              <SliderControl
                label="Step Length"
                value={settings.flowField.stepLength}
                min={1}
                max={15}
                step={1}
                onChange={(v) => update({ flowField: { ...settings.flowField, stepLength: v } })}
              />
            </>
          )}
          {settings.pathType === 'wandering' && (
            <>
              <SliderControl
                label="Steps"
                value={settings.wandering.steps}
                min={10}
                max={1000}
                step={10}
                onChange={(v) => update({ wandering: { ...settings.wandering, steps: v } })}
              />
              <SliderControl
                label="Step Length"
                value={settings.wandering.stepLength}
                min={1}
                max={30}
                step={1}
                onChange={(v) => update({ wandering: { ...settings.wandering, stepLength: v } })}
              />
              <SliderControl
                label="Angle Variation"
                value={settings.wandering.angleVar}
                min={0.05}
                max={1}
                step={0.05}
                decimals={2}
                onChange={(v) => update({ wandering: { ...settings.wandering, angleVar: v } })}
              />
              <SliderControl
                label="Momentum"
                value={settings.wandering.momentum}
                min={0}
                max={1}
                step={0.01}
                decimals={2}
                onChange={(v) => update({ wandering: { ...settings.wandering, momentum: v } })}
              />
              <SliderControl
                label="Attraction"
                value={settings.wandering.attraction}
                min={0}
                max={0.5}
                step={0.05}
                decimals={2}
                onChange={(v) => update({ wandering: { ...settings.wandering, attraction: v } })}
              />
            </>
          )}
          {settings.pathType === 'waves' && (
            <>
              <SliderControl
                label="Count"
                value={settings.waves.count}
                min={5}
                max={50}
                step={1}
                onChange={(v) => update({ waves: { ...settings.waves, count: v } })}
              />
              <SliderControl
                label="Amplitude"
                value={settings.waves.amplitude}
                min={10}
                max={150}
                step={5}
                onChange={(v) => update({ waves: { ...settings.waves, amplitude: v } })}
              />
              <SliderControl
                label="Frequency"
                value={settings.waves.frequency}
                min={0.005}
                max={0.1}
                step={0.005}
                decimals={3}
                onChange={(v) => update({ waves: { ...settings.waves, frequency: v } })}
              />
              <SliderControl
                label="Harmonics"
                value={settings.waves.harmonics}
                min={1}
                max={5}
                step={1}
                onChange={(v) => update({ waves: { ...settings.waves, harmonics: v } })}
              />
              <SliderControl
                label="Variation"
                value={settings.waves.variation}
                min={0}
                max={100}
                step={5}
                onChange={(v) => update({ waves: { ...settings.waves, variation: v } })}
              />
            </>
          )}
        </Section>

        <Section title="Style">
          <SliderControl
            label="Wobble"
            value={settings.wobble}
            min={0}
            max={50}
            step={1}
            onChange={(v) => update({ wobble: v })}
          />
          <SliderControl
            label="Roughness"
            value={settings.roughness}
            min={0}
            max={50}
            step={1}
            onChange={(v) => update({ roughness: v })}
          />
          <SliderControl
            label="Taper"
            value={settings.taper}
            min={0}
            max={100}
            step={1}
            onChange={(v) => update({ taper: v })}
          />
        </Section>

        <Section title="Color">
          <SelectControl
            label="Gradient"
            value={settings.gradientType}
            options={[
              { value: 'pathAlong', label: 'Along Path' },
              { value: 'horizontal', label: 'Horizontal' },
              { value: 'vertical', label: 'Vertical' },
              { value: 'radial', label: 'Radial' },
              { value: 'angular', label: 'Angular' },
            ]}
            onChange={(v) => update({ gradientType: v as OrganicSettings['gradientType'] })}
          />
          <SelectControl
            label="Palette"
            value={settings.palette}
            options={[
              { value: 'rainbow', label: 'Rainbow' },
              { value: 'sunset', label: 'Sunset' },
              { value: 'ocean', label: 'Ocean' },
              { value: 'forest', label: 'Forest' },
              { value: 'fire', label: 'Fire' },
              { value: 'aurora', label: 'Aurora' },
              { value: 'neon', label: 'Neon' },
              { value: 'pastel', label: 'Pastel' },
              { value: 'earth', label: 'Earth' },
              { value: 'mono', label: 'Mono' },
              { value: 'custom', label: 'Custom' },
            ]}
            onChange={handlePaletteChange}
          />
          <GradientEditor
            stops={settings.colorStops}
            onChange={handleColorStopsChange}
          />
        </Section>

        <Section title="Effects">
          <SliderControl
            label="Grain"
            value={settings.grainAmount}
            min={0}
            max={50}
            step={1}
            onChange={(v) => update({ grainAmount: v })}
          />
          <SliderControl
            label="Texture"
            value={settings.textureAmount}
            min={0}
            max={50}
            step={1}
            onChange={(v) => update({ textureAmount: v })}
          />
        </Section>

      </Sidebar>
      <CanvasArea ref={containerRef} />
    </>
  )
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
