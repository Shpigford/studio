import { useRef } from 'react'
import { useSettings } from '@/hooks/use-settings'
import { useP5 } from '@/hooks/use-p5'
import { exportPNG, generateFilename } from '@/lib/export'
import { CanvasArea } from '@/components/canvas-area'
import { Sidebar } from '@/components/sidebar'
import { Section } from '@/components/controls/section'
import { SliderControl } from '@/components/controls/slider-control'
import { SelectControl } from '@/components/controls/select-control'
import { ColorControl } from '@/components/controls/color-control'
import { ButtonRow } from '@/components/controls/button-row'
import { Button } from '@/components/ui/button'
import { createBlocksSketch, PALETTES } from './sketch'
import type { BlocksSettings } from './types'

const DEFAULTS: BlocksSettings = {
  seed: 4242,
  patternType: 'mondrian',
  blockCount: 6,
  complexity: 4,
  lineWeight: 0,
  rotation: 0,
  palette: 'mondrian',
  colors: ['#c92a2a', '#1862a8', '#f4d03f', '#ffffff', '#ffffff'],
  lineColor: '#000000',
  canvasSize: 'square',
  asymmetry: 50,
  colorDensity: 40,
  gridDivisions: 4,
  texture: 60,
  grain: 30,
  halftone: 0,
  halftoneSize: 4,
  halftoneMisalign: 30,
  halftoneAngle: 15,
  edgeWobble: 40,
}

export default function Blocks() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [settings, update, reset] = useSettings<BlocksSettings>('blocks', DEFAULTS)
  const p5Ref = useP5(containerRef, createBlocksSketch, settings)

  function handlePaletteChange(name: string) {
    if (name === 'custom') {
      update({ palette: 'custom' })
    } else {
      const pal = PALETTES[name]
      if (pal) {
        update({ palette: name, colors: [...pal] })
      }
    }
  }

  function handleColorChange(index: number, color: string) {
    const newColors = [...settings.colors]
    newColors[index] = color
    update({ colors: newColors, palette: 'custom' })
  }

  function randomize() {
    const patternTypes: BlocksSettings['patternType'][] = ['mondrian', 'grid', 'horizontal', 'diagonal']
    const paletteNames = Object.keys(PALETTES)
    const palName = paletteNames[Math.floor(Math.random() * paletteNames.length)]

    update({
      seed: Math.floor(Math.random() * 99999),
      patternType: patternTypes[Math.floor(Math.random() * patternTypes.length)],
      blockCount: Math.floor(Math.random() * 15) + 3,
      complexity: Math.floor(Math.random() * 7) + 1,
      lineWeight: Math.random() > 0.5 ? Math.floor(Math.random() * 5) : 0,
      rotation: Math.random() > 0.7 ? Math.floor(Math.random() * 30) : 0,
      palette: palName,
      colors: [...(PALETTES[palName] ?? DEFAULTS.colors)],
      asymmetry: Math.floor(Math.random() * 80) + 10,
      colorDensity: Math.floor(Math.random() * 70) + 15,
      gridDivisions: Math.floor(Math.random() * 6) + 3,
      texture: Math.floor(Math.random() * 80),
      grain: Math.floor(Math.random() * 50),
      halftone: Math.random() > 0.7 ? Math.floor(Math.random() * 60) : 0,
      edgeWobble: Math.floor(Math.random() * 70),
    })
  }

  function download() {
    const canvas = (p5Ref.current as unknown as { canvas: HTMLCanvasElement })?.canvas
    if (canvas) {
      exportPNG(canvas, generateFilename('blocks', 'png'))
    }
  }

  return (
    <>
      <Sidebar footer={
        <ButtonRow>
          <Button variant="secondary" onClick={randomize}>Randomize</Button>
          <Button variant="secondary" onClick={reset}>Reset</Button>
          <Button variant="primary" onClick={download}>Download PNG</Button>
        </ButtonRow>
      }>
        <h2 className="mb-3 text-sm font-medium text-text-primary">Blocks</h2>

        <Section title="Pattern">
          <SliderControl
            label="Seed"
            value={settings.seed}
            min={0}
            max={99999}
            step={1}
            onChange={(v) => update({ seed: v })}
          />
          <SelectControl
            label="Pattern Type"
            value={settings.patternType}
            options={[
              { value: 'mondrian', label: 'Mondrian' },
              { value: 'grid', label: 'Grid' },
              { value: 'horizontal', label: 'Horizontal' },
              { value: 'diagonal', label: 'Diagonal' },
            ]}
            onChange={(v) => update({ patternType: v as BlocksSettings['patternType'] })}
          />
          {settings.patternType !== 'diagonal' && (
            <SliderControl
              label="Block Count"
              value={settings.blockCount}
              min={1}
              max={20}
              step={1}
              onChange={(v) => update({ blockCount: v })}
            />
          )}
          <SliderControl
            label="Complexity"
            value={settings.complexity}
            min={0}
            max={8}
            step={1}
            onChange={(v) => update({ complexity: v })}
          />
          {settings.patternType === 'grid' && (
            <SliderControl
              label="Grid Divisions"
              value={settings.gridDivisions}
              min={2}
              max={10}
              step={1}
              onChange={(v) => update({ gridDivisions: v })}
            />
          )}
          {(settings.patternType === 'mondrian' || settings.patternType === 'horizontal') && (
            <SliderControl
              label="Asymmetry"
              value={settings.asymmetry}
              min={0}
              max={100}
              step={1}
              onChange={(v) => update({ asymmetry: v })}
            />
          )}
        </Section>

        <Section title="Layout">
          <SelectControl
            label="Canvas Size"
            value={settings.canvasSize}
            options={[
              { value: 'square', label: 'Square (800×800)' },
              { value: 'landscape', label: 'Landscape (1024×768)' },
              { value: 'portrait', label: 'Portrait (768×1024)' },
            ]}
            onChange={(v) => update({ canvasSize: v as BlocksSettings['canvasSize'] })}
          />
          <SliderControl
            label="Rotation"
            value={settings.rotation}
            min={0}
            max={360}
            step={1}
            unit="°"
            onChange={(v) => update({ rotation: v })}
          />
        </Section>

        <Section title="Color">
          <SelectControl
            label="Palette"
            value={settings.palette}
            options={[
              { value: 'mondrian', label: 'Mondrian' },
              { value: 'neo-mondrian', label: 'Neo-Mondrian' },
              { value: 'warm', label: 'Warm' },
              { value: 'cool', label: 'Cool' },
              { value: 'monochrome', label: 'Monochrome' },
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
          <ColorControl
            label="Line Color"
            value={settings.lineColor}
            onChange={(v) => update({ lineColor: v })}
          />
          <SliderControl
            label="Color Density"
            value={settings.colorDensity}
            min={0}
            max={100}
            step={1}
            onChange={(v) => update({ colorDensity: v })}
          />
        </Section>

        <Section title="Stroke">
          <SliderControl
            label="Line Weight"
            value={settings.lineWeight}
            min={0}
            max={10}
            step={1}
            onChange={(v) => update({ lineWeight: v })}
          />
          <SliderControl
            label="Edge Wobble"
            value={settings.edgeWobble}
            min={0}
            max={100}
            step={1}
            onChange={(v) => update({ edgeWobble: v })}
          />
        </Section>

        <Section title="Effects">
          <SliderControl
            label="Texture"
            value={settings.texture}
            min={0}
            max={100}
            step={1}
            onChange={(v) => update({ texture: v })}
          />
          <SliderControl
            label="Grain"
            value={settings.grain}
            min={0}
            max={100}
            step={1}
            onChange={(v) => update({ grain: v })}
          />
          <SliderControl
            label="Halftone"
            value={settings.halftone}
            min={0}
            max={100}
            step={1}
            onChange={(v) => update({ halftone: v })}
          />
          {settings.halftone > 0 && (
            <>
              <SliderControl
                label="Halftone Size"
                value={settings.halftoneSize}
                min={1}
                max={12}
                step={1}
                onChange={(v) => update({ halftoneSize: v })}
              />
              <SliderControl
                label="Halftone Misalign"
                value={settings.halftoneMisalign}
                min={0}
                max={100}
                step={1}
                onChange={(v) => update({ halftoneMisalign: v })}
              />
              <SliderControl
                label="Halftone Angle"
                value={settings.halftoneAngle}
                min={0}
                max={90}
                step={1}
                unit="°"
                onChange={(v) => update({ halftoneAngle: v })}
              />
            </>
          )}
        </Section>

      </Sidebar>
      <CanvasArea ref={containerRef} />
    </>
  )
}
