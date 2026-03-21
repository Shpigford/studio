import { useRef, useState, useCallback } from 'react'
import { useSettings } from '@/hooks/use-settings'
import { useP5 } from '@/hooks/use-p5'
import { exportPNG, generateFilename, createRecorder } from '@/lib/export'
import { CanvasArea } from '@/components/canvas-area'
import { Sidebar } from '@/components/sidebar'
import { Section } from '@/components/controls/section'
import { SliderControl } from '@/components/controls/slider-control'
import { SwitchControl } from '@/components/controls/switch-control'
import { ButtonRow } from '@/components/controls/button-row'
import { Button } from '@/components/ui/button'
import { GradientEditor } from '@/components/controls/gradient-editor'
import { useShortcutActions } from '@/hooks/use-shortcut-actions'
import { Kbd } from '@/components/ui/kbd'
import { CanvasSizeControl } from '@/components/controls/canvas-size-control'
import type { CanvasPreset } from '@/lib/canvas-size'
import { resolveCanvasSize } from '@/lib/canvas-size'
import { createGradientsSketch } from './sketch'
import type { GradientsSettings } from './types'
import type { ColorStop } from '@/types/tools'

const PALETTES: string[][] = [
  ['#FF6B35', '#F7C59F', '#E891B9', '#2E4057', '#1A1A2E'], // Sunset
  ['#0D1B2A', '#1B4965', '#5FA8D3', '#CAE9FF', '#FFCB77'], // Ocean
  ['#1A1A2E', '#16213E', '#1F6650', '#67B99A', '#D4E4BC'], // Forest
  ['#FF595E', '#FF924C', '#FFCA3A', '#C5CA30', '#8AC926'], // Fire
  ['#2D00F7', '#6A00F4', '#8900F2', '#BC00DD', '#E500A4'], // Dusk
  ['#5F0F40', '#9A031E', '#FB8B24', '#E36414', '#0F4C5C'], // Earthy
  ['#F72585', '#B5179E', '#7209B7', '#3A0CA3', '#4361EE'], // Candy
  ['#12100E', '#2B4141', '#0EB1D2', '#34E4EA', '#8AB0AB'], // Aurora
  ['#0B0C10', '#1F2833', '#C5C6C7', '#66FCF1', '#45A29E'], // Midnight
  ['#FEC89A', '#FFD7BA', '#FEC5BB', '#FCD5CE', '#F8EDEB'], // Peach Blossom
  ['#000000', '#14213D', '#FCA311', '#E5E5E5', '#FFFFFF'], // Deep Space
  ['#E0BBE4', '#957DAD', '#D291BC', '#FEC8D8', '#FFDFD3'], // Lavender Dreams
  ['#05668D', '#028090', '#00A896', '#02C39A', '#F0F3BD'], // Tropical
  ['#1A0000', '#4A0000', '#800000', '#C41E3A', '#FF6B35'], // Volcanic
  ['#CAF0F8', '#90E0EF', '#00B4D8', '#0077B6', '#03045E'], // Arctic
  ['#132A13', '#31572C', '#4F772D', '#90A955', '#ECF39E'], // Moss
  ['#1C1917', '#44403C', '#78716C', '#B45309', '#F59E0B'], // Copper
  ['#0D0221', '#0F084B', '#26408B', '#A6CFD5', '#C2E7D9'], // Neon Night
]

const DEFAULTS: GradientsSettings = {
  canvasPreset: 'square',
  customWidth: 2048,
  customHeight: 2048,
  colorStops: [
    { color: '#FF6B35', position: 0 },
    { color: '#F7C59F', position: 25 },
    { color: '#E891B9', position: 50 },
    { color: '#2E4057', position: 75 },
    { color: '#1A1A2E', position: 100 },
  ],
  flowAngle: 45,
  noiseScale: 2.0,
  noiseIntensity: 55,
  curveDistortion: 70,
  noiseOctaves: 2,
  depthIntensity: 60,
  highlightStrength: 50,
  shadowStrength: 55,
  foldScale: 60,
  grainIntensity: 8,
  grainSize: 1.0,
  brightness: 0,
  contrast: 100,
  saturation: 100,
  isAnimating: false,
  animationSpeed: 30,
}

interface Recorder {
  start: () => void
  addFrame: (canvas: HTMLCanvasElement) => void
  stop: () => Promise<Blob>
}

export default function Gradients() {
  const containerRef = useRef<HTMLDivElement>(null)
  const recorderRef = useRef<Recorder | null>(null)
  const [settings, update, reset] = useSettings<GradientsSettings>('gradients', DEFAULTS)
  const [isRecording, setIsRecording] = useState(false)

  const sketchFn = useCallback(
    (p: Parameters<typeof createGradientsSketch>[0], settingsRef: Parameters<typeof createGradientsSketch>[1]) => {
      createGradientsSketch(p, settingsRef, recorderRef)
    },
    [],
  )

  useP5(containerRef, sketchFn, settings)
  useShortcutActions({ randomize, reset, download })

  function handleColorStopsChange(colorStops: ColorStop[]) {
    update({ colorStops })
  }

  function randomize() {
    let colorStops: ColorStop[]
    if (Math.random() > 0.3) {
      // Pick from preset palettes
      const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)]
      colorStops = palette.map((color, i) => ({
        color,
        position: Math.round((i / (palette.length - 1)) * 100),
      }))
    } else {
      // Generate harmonious HSL colors
      const numStops = Math.floor(Math.random() * 3) + 3
      const baseHue = Math.random() * 360
      colorStops = Array.from({ length: numStops }, (_, i) => {
        const hue = (baseHue + i * (360 / numStops) + Math.random() * 30 - 15) % 360
        const sat = Math.random() * 40 + 60
        const bri = i < numStops / 2 ? Math.random() * 40 + 60 : Math.random() * 30 + 20
        return {
          color: hslToHex(hue, sat, bri),
          position: Math.round((i / (numStops - 1)) * 100),
        }
      })
    }

    update({
      colorStops,
      flowAngle: Math.floor(Math.random() * 360),
      noiseScale: parseFloat((Math.random() * 2.0 + 0.5).toFixed(1)),
      noiseIntensity: Math.floor(Math.random() * 40 + 20),
      curveDistortion: Math.floor(Math.random() * 50 + 30),
      noiseOctaves: Math.floor(Math.random() * 2 + 1),
      depthIntensity: Math.floor(Math.random() * 50 + 30),
      highlightStrength: Math.floor(Math.random() * 40 + 20),
      shadowStrength: Math.floor(Math.random() * 50 + 30),
      foldScale: Math.floor(Math.random() * 60 + 30),
      grainIntensity: Math.floor(Math.random() * 12 + 3),
      grainSize: parseFloat((Math.random() * 1.5 + 0.5).toFixed(1)),
      brightness: Math.floor(Math.random() * 20 - 10),
      contrast: Math.floor(Math.random() * 40 + 90),
      saturation: Math.floor(Math.random() * 50 + 80),
    })
  }

  function download() {
    const canvas = containerRef.current?.querySelector('canvas')
    if (canvas) {
      exportPNG(canvas, generateFilename('gradients', 'png'))
    }
  }

  async function toggleRecording() {
    if (isRecording) {
      // Stop recording
      const recorder = recorderRef.current
      if (recorder) {
        const blob = await recorder.stop()
        recorderRef.current = null
        setIsRecording(false)

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = generateFilename('gradient', 'mp4')
        a.click()
        URL.revokeObjectURL(url)
      }
    } else {
      // Start recording
      const [rw, rh] = resolveCanvasSize(settings.canvasPreset, settings.customWidth, settings.customHeight)
      const recorder = createRecorder({ width: rw, height: rh, fps: 30, bitrate: 8_000_000 })
      if (!recorder) return
      recorder.start()
      recorderRef.current = recorder
      setIsRecording(true)

      // Force animation on
      if (!settings.isAnimating) {
        update({ isAnimating: true })
      }
    }
  }

  return (
    <>
      <Sidebar footer={
        <ButtonRow>
          <Button variant="secondary" onClick={randomize}>Randomize <Kbd>R</Kbd></Button>
          <Button variant="secondary" onClick={reset}>Reset <Kbd>⌫</Kbd></Button>
          <Button variant="primary" onClick={download}>Download PNG <Kbd>⌘S</Kbd></Button>
          <Button variant="secondary" onClick={toggleRecording}>
            {isRecording ? 'Stop Recording' : 'Record MP4'}
          </Button>
        </ButtonRow>
      }>
        <h2 className="mb-3 text-base font-medium text-text-primary">Gradients</h2>

        <Section title="Canvas">
          <CanvasSizeControl
            preset={settings.canvasPreset}
            customWidth={settings.customWidth}
            customHeight={settings.customHeight}
            onPresetChange={(v) => update({ canvasPreset: v as CanvasPreset })}
            onWidthChange={(v) => update({ customWidth: v })}
            onHeightChange={(v) => update({ customHeight: v })}
          />
        </Section>

        <Section title="Colors">
          <GradientEditor
            stops={settings.colorStops}
            onChange={handleColorStopsChange}
          />
        </Section>

        <Section title="Flow">
          <SliderControl
            label="Angle"
            value={settings.flowAngle}
            min={0}
            max={360}
            step={1}
            onChange={(v) => update({ flowAngle: v })}
          />
          <SliderControl
            label="Noise Scale"
            value={settings.noiseScale}
            min={0.5}
            max={5.0}
            step={0.1}
            decimals={1}
            onChange={(v) => update({ noiseScale: v })}
          />
          <SliderControl
            label="Noise Intensity"
            value={settings.noiseIntensity}
            min={0}
            max={100}
            step={1}
            onChange={(v) => update({ noiseIntensity: v })}
          />
          <SliderControl
            label="Curve Distortion"
            value={settings.curveDistortion}
            min={0}
            max={100}
            step={1}
            onChange={(v) => update({ curveDistortion: v })}
          />
          <SliderControl
            label="Detail"
            value={settings.noiseOctaves}
            min={1}
            max={6}
            step={1}
            onChange={(v) => update({ noiseOctaves: v })}
          />
        </Section>

        <Section title="Depth & Light">
          <SliderControl
            label="Depth"
            value={settings.depthIntensity}
            min={0}
            max={100}
            step={1}
            onChange={(v) => update({ depthIntensity: v })}
          />
          <SliderControl
            label="Highlights"
            value={settings.highlightStrength}
            min={0}
            max={100}
            step={1}
            onChange={(v) => update({ highlightStrength: v })}
          />
          <SliderControl
            label="Shadows"
            value={settings.shadowStrength}
            min={0}
            max={100}
            step={1}
            onChange={(v) => update({ shadowStrength: v })}
          />
          <SliderControl
            label="Fold Scale"
            value={settings.foldScale}
            min={10}
            max={100}
            step={1}
            onChange={(v) => update({ foldScale: v })}
          />
        </Section>

        <Section title="Grain">
          <SliderControl
            label="Amount"
            value={settings.grainIntensity}
            min={0}
            max={30}
            step={1}
            onChange={(v) => update({ grainIntensity: v })}
          />
          <SliderControl
            label="Size"
            value={settings.grainSize}
            min={0.5}
            max={3.0}
            step={0.1}
            decimals={1}
            onChange={(v) => update({ grainSize: v })}
          />
        </Section>

        <Section title="Adjustments">
          <SliderControl
            label="Brightness"
            value={settings.brightness}
            min={-50}
            max={50}
            step={1}
            onChange={(v) => update({ brightness: v })}
          />
          <SliderControl
            label="Contrast"
            value={settings.contrast}
            min={50}
            max={200}
            step={1}
            onChange={(v) => update({ contrast: v })}
          />
          <SliderControl
            label="Saturation"
            value={settings.saturation}
            min={0}
            max={200}
            step={1}
            onChange={(v) => update({ saturation: v })}
          />
        </Section>

        <Section title="Animation">
          <SwitchControl
            label="Animate"
            checked={settings.isAnimating}
            onChange={(v) => update({ isAnimating: v })}
          />
          <SliderControl
            label="Speed"
            value={settings.animationSpeed}
            min={1}
            max={100}
            step={1}
            onChange={(v) => update({ animationSpeed: v })}
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
