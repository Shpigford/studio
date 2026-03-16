import { useRef, useState, useCallback } from 'react'
import { useSettings } from '@/hooks/use-settings'
import { useP5 } from '@/hooks/use-p5'
import { exportPNG, generateFilename, createRecorder } from '@/lib/export'
import { CanvasArea } from '@/components/canvas-area'
import { Sidebar } from '@/components/sidebar'
import { Section } from '@/components/controls/section'
import { SliderControl } from '@/components/controls/slider-control'
import { SelectControl } from '@/components/controls/select-control'
import { ColorControl } from '@/components/controls/color-control'
import { SwitchControl } from '@/components/controls/switch-control'
import { ButtonRow } from '@/components/controls/button-row'
import { Button } from '@/components/ui/button'
import { GradientEditor } from '@/components/controls/gradient-editor'
import { createLinesSketch } from './sketch'
import { DEFAULTS } from './types'
import type { LinesSettings } from './types'
import type { ColorStop } from '@/types/tools'

const SHAPE_OPTIONS = [
  { value: 'horizontal', label: 'Horizontal Lines' },
  { value: 'vertical', label: 'Vertical Lines' },
  { value: 'circles', label: 'Circles' },
  { value: 'dots', label: 'Dots' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'radial', label: 'Radial' },
  { value: 'lissajous', label: 'Lissajous' },
]

const BLEND_MODE_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'add', label: 'Add' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'hard light', label: 'Hard Light' },
  { value: 'soft light', label: 'Soft Light' },
  { value: 'dodge', label: 'Dodge' },
  { value: 'burn', label: 'Burn' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
]

const GRADIENT_TYPE_OPTIONS = [
  { value: 'perLine', label: 'Per Line' },
  { value: 'alongLine', label: 'Along Line' },
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'radial', label: 'Radial' },
]

const GRAD_ANIM_MODE_OPTIONS = [
  { value: 'cycle', label: 'Cycle' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'bounce', label: 'Bounce' },
]

const BG_GRADIENT_TYPE_OPTIONS = [
  { value: 'linear', label: 'Linear' },
  { value: 'radial', label: 'Radial' },
]

const REFRACTION_TYPE_OPTIONS = [
  { value: 'barrel', label: 'Barrel' },
  { value: 'pincushion', label: 'Pincushion' },
  { value: 'wavyGlass', label: 'Wavy Glass' },
  { value: 'liquid', label: 'Liquid' },
  { value: 'ripple', label: 'Ripple' },
  { value: 'frosted', label: 'Frosted' },
]

const HALFTONE_TYPE_OPTIONS = [
  { value: 'dots', label: 'Dots' },
  { value: 'lines', label: 'Lines' },
  { value: 'crosshatch', label: 'Crosshatch' },
]

interface Recorder {
  start: () => void
  addFrame: (canvas: HTMLCanvasElement) => void
  stop: () => Promise<Blob>
}

export default function Lines() {
  const containerRef = useRef<HTMLDivElement>(null)
  const recorderRef = useRef<Recorder | null>(null)
  const [settings, update, reset] = useSettings<LinesSettings>('lines', DEFAULTS)
  const [isRecording, setIsRecording] = useState(false)

  const sketchFn = useCallback(
    (p: Parameters<typeof createLinesSketch>[0], settingsRef: Parameters<typeof createLinesSketch>[1]) => {
      createLinesSketch(p, settingsRef, recorderRef)
    },
    [],
  )

  useP5(containerRef, sketchFn, settings)

  function randomize() {
    const shapes: LinesSettings['shape'][] = ['horizontal', 'vertical', 'circles', 'dots', 'spiral', 'radial', 'lissajous']
    const blendModes = BLEND_MODE_OPTIONS.map(o => o.value)
    const refractionTypes: LinesSettings['refractionType'][] = ['barrel', 'pincushion', 'wavyGlass', 'liquid', 'ripple', 'frosted']
    const halftoneTypes: LinesSettings['halftoneType'][] = ['dots', 'lines', 'crosshatch']
    const gradTypes: LinesSettings['gradientType'][] = ['perLine', 'alongLine', 'horizontal', 'vertical', 'radial']
    const animModes: LinesSettings['gradAnimMode'][] = ['cycle', 'reverse', 'bounce']

    const randHex = () => '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
    const randInt = (a: number, b: number) => Math.floor(Math.random() * (b - a)) + a
    const randFloat = (a: number, b: number) => Math.random() * (b - a) + a
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

    // Random gradient stops (2-4)
    const numStops = randInt(2, 5)
    const colorStops: ColorStop[] = Array.from({ length: numStops }, (_, i) => ({
      color: randHex(),
      position: i === 0 ? 0 : i === numStops - 1 ? 100 : randInt(10, 90),
    }))

    const numBgStops = randInt(2, 5)
    const bgGradientStops: ColorStop[] = Array.from({ length: numBgStops }, (_, i) => ({
      color: randHex(),
      position: i === 0 ? 0 : i === numBgStops - 1 ? 100 : randInt(10, 90),
    }))

    update({
      shape: pick(shapes),
      frequency: randFloat(0.005, 0.05),
      amplitude: randFloat(5, 100),
      lineCount: randInt(5, 50),
      spacing: randFloat(0.5, 10),
      padding: Math.floor(randInt(0, 150) / 5) * 5,
      thickness: Math.floor(randFloat(0.5, 10) / 0.5) * 0.5,
      bgColor: randHex(),
      lineColor: randHex(),
      noise: randInt(0, 100),
      blendMode: pick(blendModes),

      weightVar: randFloat(0, 100),
      wobble: randFloat(0, 50),
      taper: randFloat(0, 100),
      lineBreaks: Math.random() > 0.5,
      breakFrequency: randInt(1, 10),
      morsePattern: Math.random() > 0.7,
      morseDensity: randInt(1, 15),
      dotRatio: randInt(0, 100),
      spacingVar: randFloat(0, 50),
      rotationJitter: randFloat(0, 10),
      opacityVar: randFloat(0, 50),
      colorDrift: randFloat(0, 50),
      perlinFlow: randFloat(0, 100),
      freqVar: randFloat(0, 100),
      noiseOctaves: randInt(1, 5),

      watercolor: Math.random() > 0.5,
      wcWetness: randInt(20, 80),
      wcPigment: randInt(20, 80),
      wcLayers: randInt(2, 6),
      wcEdgeDarkening: randInt(10, 50),

      blur: Math.random() > 0.7 ? Math.floor(randFloat(0, 5) * 2) / 2 : 0,
      refraction: Math.random() > 0.75,
      refractionType: pick(refractionTypes),
      refractionStrength: randInt(10, 60),
      refractionScale: randInt(20, 80),
      chromaticAb: Math.random() > 0.8,
      chromaticAbAmount: randInt(2, 10),
      pixelate: Math.random() > 0.8,
      pixelateAmount: randInt(4, 20),

      halftone: Math.random() > 0.8,
      halftoneType: pick(halftoneTypes),
      halftoneSize: randInt(4, 12),
      halftoneAngle: randInt(0, 180),
      halftoneSoftness: randInt(10, 60),
      halftoneCoverage: randInt(40, 90),

      crt: Math.random() > 0.85,
      crtScanlines: randInt(20, 80),
      crtCurvature: randInt(10, 40),
      crtVignette: randInt(10, 50),
      crtPhosphor: randInt(10, 40),
      vhs: Math.random() > 0.9,
      vhsDistortion: randInt(20, 60),
      vhsTracking: randInt(10, 40),

      enableGradient: Math.random() > 0.6,
      gradientType: pick(gradTypes),
      colorStops,
      gradAnimSpeed: randInt(0, 50),
      gradAnimMode: pick(animModes),

      bgGradient: Math.random() > 0.7,
      bgGradientType: Math.random() > 0.5 ? 'linear' : 'radial',
      bgGradientAngle: randInt(0, 360),
      bgGradientStops,

      lissFreqA: randInt(1, 13),
      lissFreqB: randInt(1, 13),
      lissPhase: randFloat(0, 6.28),
      lissScale: randFloat(0.3, 1),
      lissResolution: randInt(500, 2000),
      oscillonMode: Math.random() > 0.5,
      oscillonLayers: randInt(2, 15),
      oscillonSpread: randFloat(0.1, 0.8),
    })
  }

  function download() {
    const canvas = containerRef.current?.querySelector('canvas')
    if (canvas) exportPNG(canvas, generateFilename('lines', 'png'))
  }

  async function toggleRecording() {
    if (isRecording) {
      const recorder = recorderRef.current
      if (recorder) {
        const blob = await recorder.stop()
        recorderRef.current = null
        setIsRecording(false)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = generateFilename('lines', 'mp4')
        a.click()
        URL.revokeObjectURL(url)
      }
    } else {
      const canvas = containerRef.current?.querySelector('canvas')
      if (!canvas) return
      const recorder = createRecorder({ width: canvas.width, height: canvas.height, fps: 30, bitrate: 8_000_000 })
      if (!recorder) return
      recorder.start()
      recorderRef.current = recorder
      setIsRecording(true)
      if (!settings.isPlaying) update({ isPlaying: true })
    }
  }

  return (
    <>
      <Sidebar footer={
        <ButtonRow>
          <Button variant="secondary" onClick={randomize}>Randomize</Button>
          <Button variant="secondary" onClick={reset}>Reset</Button>
          <Button variant="primary" onClick={download}>Download PNG</Button>
          <Button variant="secondary" onClick={toggleRecording}>
            {isRecording ? 'Stop Recording' : 'Record MP4'}
          </Button>
        </ButtonRow>
      }>
        <h2 className="mb-3 text-sm font-medium text-text-primary">Lines</h2>

        <Section title="Shape" defaultOpen>
          <SelectControl
            label="Shape"
            value={settings.shape}
            options={SHAPE_OPTIONS}
            onChange={(v) => update({ shape: v as LinesSettings['shape'] })}
          />
          <SliderControl label="Frequency" value={settings.frequency} min={0.005} max={0.05} step={0.001} decimals={3} onChange={(v) => update({ frequency: v })} />
          <SliderControl label="Amplitude" value={settings.amplitude} min={5} max={100} step={1} onChange={(v) => update({ amplitude: v })} />
          <SliderControl label="Line Count" value={settings.lineCount} min={1} max={50} step={1} onChange={(v) => update({ lineCount: v })} />
          <SliderControl label="Spacing" value={settings.spacing} min={0.5} max={10} step={0.1} decimals={1} onChange={(v) => update({ spacing: v })} />
          <SliderControl label="Padding" value={settings.padding} min={0} max={150} step={5} onChange={(v) => update({ padding: v })} />
          <SliderControl label="Thickness" value={settings.thickness} min={0.5} max={10} step={0.5} decimals={1} onChange={(v) => update({ thickness: v })} />
        </Section>

        {settings.shape === 'lissajous' && (
          <Section title="Lissajous">
            <SliderControl label="Freq A" value={settings.lissFreqA} min={1} max={12} step={1} onChange={(v) => update({ lissFreqA: v })} />
            <SliderControl label="Freq B" value={settings.lissFreqB} min={1} max={12} step={1} onChange={(v) => update({ lissFreqB: v })} />
            <SliderControl label="Phase" value={settings.lissPhase} min={0} max={6.28} step={0.1} decimals={1} onChange={(v) => update({ lissPhase: v })} />
            <SliderControl label="Scale" value={settings.lissScale} min={0.1} max={1} step={0.01} decimals={2} onChange={(v) => update({ lissScale: v })} />
            <SliderControl label="Resolution" value={settings.lissResolution} min={100} max={2000} step={50} onChange={(v) => update({ lissResolution: v })} />
            <SwitchControl label="Oscillon Mode" checked={settings.oscillonMode} onChange={(v) => update({ oscillonMode: v })} />
            {settings.oscillonMode && (
              <>
                <SliderControl label="Layers" value={settings.oscillonLayers} min={2} max={20} step={1} onChange={(v) => update({ oscillonLayers: v })} />
                <SliderControl label="Spread" value={settings.oscillonSpread} min={0} max={1} step={0.01} decimals={2} onChange={(v) => update({ oscillonSpread: v })} />
              </>
            )}
          </Section>
        )}

        <Section title="Background">
          <SwitchControl label="Gradient" checked={settings.bgGradient} onChange={(v) => update({ bgGradient: v })} />
          {settings.bgGradient ? (
            <>
              <SelectControl label="Type" value={settings.bgGradientType} options={BG_GRADIENT_TYPE_OPTIONS} onChange={(v) => update({ bgGradientType: v as LinesSettings['bgGradientType'] })} />
              {settings.bgGradientType === 'linear' && (
                <SliderControl label="Angle" value={settings.bgGradientAngle} min={0} max={360} step={1} onChange={(v) => update({ bgGradientAngle: v })} />
              )}
              <GradientEditor stops={settings.bgGradientStops} onChange={(stops) => update({ bgGradientStops: stops })} />
            </>
          ) : (
            <ColorControl label="Background" value={settings.bgColor} onChange={(v) => update({ bgColor: v })} />
          )}
        </Section>

        <Section title="Line Color">
          <ColorControl label="Color" value={settings.lineColor} onChange={(v) => update({ lineColor: v })} />
          <SwitchControl label="Gradient" checked={settings.enableGradient} onChange={(v) => update({ enableGradient: v })} />
        </Section>

        {settings.enableGradient && (
          <Section title="Gradient">
            <SelectControl label="Type" value={settings.gradientType} options={GRADIENT_TYPE_OPTIONS} onChange={(v) => update({ gradientType: v as LinesSettings['gradientType'] })} />
            <GradientEditor stops={settings.colorStops} onChange={(stops) => update({ colorStops: stops })} />
            <SliderControl label="Anim Speed" value={settings.gradAnimSpeed} min={0} max={100} step={1} onChange={(v) => update({ gradAnimSpeed: v })} />
            <SelectControl label="Anim Mode" value={settings.gradAnimMode} options={GRAD_ANIM_MODE_OPTIONS} onChange={(v) => update({ gradAnimMode: v as LinesSettings['gradAnimMode'] })} />
          </Section>
        )}

        <Section title="Organic Effects">
          <SliderControl label="Weight Var" value={settings.weightVar} min={0} max={100} step={1} onChange={(v) => update({ weightVar: v })} />
          <SliderControl label="Wobble" value={settings.wobble} min={0} max={50} step={1} onChange={(v) => update({ wobble: v })} />
          <SliderControl label="Taper" value={settings.taper} min={0} max={100} step={1} onChange={(v) => update({ taper: v })} />
          <SwitchControl label="Line Breaks" checked={settings.lineBreaks} onChange={(v) => update({ lineBreaks: v })} />
          {settings.lineBreaks && (
            <SliderControl label="Break Freq" value={settings.breakFrequency} min={1} max={10} step={1} onChange={(v) => update({ breakFrequency: v })} />
          )}
          <SwitchControl label="Morse Pattern" checked={settings.morsePattern} onChange={(v) => update({ morsePattern: v })} />
          {settings.morsePattern && (
            <>
              <SliderControl label="Density" value={settings.morseDensity} min={1} max={15} step={1} onChange={(v) => update({ morseDensity: v })} />
              <SliderControl label="Dot Ratio" value={settings.dotRatio} min={0} max={100} step={1} onChange={(v) => update({ dotRatio: v })} />
            </>
          )}
        </Section>

        <Section title="Advanced Variations">
          <SliderControl label="Spacing Var" value={settings.spacingVar} min={0} max={50} step={1} onChange={(v) => update({ spacingVar: v })} />
          <SliderControl label="Rotation Jitter" value={settings.rotationJitter} min={0} max={10} step={0.1} decimals={1} onChange={(v) => update({ rotationJitter: v })} />
          <SliderControl label="Opacity Var" value={settings.opacityVar} min={0} max={50} step={1} onChange={(v) => update({ opacityVar: v })} />
          <SliderControl label="Color Drift" value={settings.colorDrift} min={0} max={50} step={1} onChange={(v) => update({ colorDrift: v })} />
        </Section>

        <Section title="Flow">
          <SliderControl label="Perlin Flow" value={settings.perlinFlow} min={0} max={100} step={1} onChange={(v) => update({ perlinFlow: v })} />
          <SliderControl label="Freq Var" value={settings.freqVar} min={0} max={100} step={1} onChange={(v) => update({ freqVar: v })} />
          <SliderControl label="Octaves" value={settings.noiseOctaves} min={1} max={5} step={1} onChange={(v) => update({ noiseOctaves: v })} />
        </Section>

        <Section title="Texture">
          <SliderControl label="Noise" value={settings.noise} min={0} max={100} step={1} onChange={(v) => update({ noise: v })} />
        </Section>

        <Section title="Watercolor">
          <SwitchControl label="Watercolor" checked={settings.watercolor} onChange={(v) => update({ watercolor: v })} />
          {settings.watercolor && (
            <>
              <SliderControl label="Wetness" value={settings.wcWetness} min={0} max={100} step={1} onChange={(v) => update({ wcWetness: v })} />
              <SliderControl label="Pigment" value={settings.wcPigment} min={0} max={100} step={1} onChange={(v) => update({ wcPigment: v })} />
              <SliderControl label="Layers" value={settings.wcLayers} min={1} max={8} step={1} onChange={(v) => update({ wcLayers: v })} />
              <SliderControl label="Edge Darkening" value={settings.wcEdgeDarkening} min={0} max={100} step={1} onChange={(v) => update({ wcEdgeDarkening: v })} />
            </>
          )}
        </Section>

        <Section title="Blend Mode">
          <SelectControl label="Mode" value={settings.blendMode} options={BLEND_MODE_OPTIONS} onChange={(v) => update({ blendMode: v })} />
        </Section>

        <Section title="Glass/Lens">
          <SliderControl label="Blur" value={settings.blur} min={0} max={10} step={0.5} decimals={1} onChange={(v) => update({ blur: v })} />
          <SwitchControl label="Refraction" checked={settings.refraction} onChange={(v) => update({ refraction: v })} />
          {settings.refraction && (
            <>
              <SelectControl label="Type" value={settings.refractionType} options={REFRACTION_TYPE_OPTIONS} onChange={(v) => update({ refractionType: v as LinesSettings['refractionType'] })} />
              <SliderControl label="Strength" value={settings.refractionStrength} min={0} max={100} step={1} onChange={(v) => update({ refractionStrength: v })} />
              <SliderControl label="Scale" value={settings.refractionScale} min={10} max={100} step={1} onChange={(v) => update({ refractionScale: v })} />
            </>
          )}
          <SwitchControl label="Chromatic Ab" checked={settings.chromaticAb} onChange={(v) => update({ chromaticAb: v })} />
          {settings.chromaticAb && (
            <SliderControl label="Amount" value={settings.chromaticAbAmount} min={0} max={20} step={1} onChange={(v) => update({ chromaticAbAmount: v })} />
          )}
          <SwitchControl label="Pixelate" checked={settings.pixelate} onChange={(v) => update({ pixelate: v })} />
          {settings.pixelate && (
            <SliderControl label="Amount" value={settings.pixelateAmount} min={2} max={50} step={1} onChange={(v) => update({ pixelateAmount: v })} />
          )}
        </Section>

        <Section title="Halftone">
          <SwitchControl label="Halftone" checked={settings.halftone} onChange={(v) => update({ halftone: v })} />
          {settings.halftone && (
            <>
              <SelectControl label="Type" value={settings.halftoneType} options={HALFTONE_TYPE_OPTIONS} onChange={(v) => update({ halftoneType: v as LinesSettings['halftoneType'] })} />
              <SliderControl label="Size" value={settings.halftoneSize} min={2} max={20} step={1} onChange={(v) => update({ halftoneSize: v })} />
              <SliderControl label="Angle" value={settings.halftoneAngle} min={0} max={180} step={1} onChange={(v) => update({ halftoneAngle: v })} />
              <SliderControl label="Softness" value={settings.halftoneSoftness} min={0} max={100} step={1} onChange={(v) => update({ halftoneSoftness: v })} />
              <SliderControl label="Coverage" value={settings.halftoneCoverage} min={0} max={100} step={1} onChange={(v) => update({ halftoneCoverage: v })} />
            </>
          )}
        </Section>

        <Section title="CRT/VHS">
          <SwitchControl label="CRT" checked={settings.crt} onChange={(v) => update({ crt: v })} />
          {settings.crt && (
            <>
              <SliderControl label="Scanlines" value={settings.crtScanlines} min={0} max={100} step={1} onChange={(v) => update({ crtScanlines: v })} />
              <SliderControl label="Curvature" value={settings.crtCurvature} min={0} max={50} step={1} onChange={(v) => update({ crtCurvature: v })} />
              <SliderControl label="Vignette" value={settings.crtVignette} min={0} max={100} step={1} onChange={(v) => update({ crtVignette: v })} />
              <SliderControl label="Phosphor" value={settings.crtPhosphor} min={0} max={100} step={1} onChange={(v) => update({ crtPhosphor: v })} />
            </>
          )}
          <SwitchControl label="VHS" checked={settings.vhs} onChange={(v) => update({ vhs: v })} />
          {settings.vhs && (
            <>
              <SliderControl label="Distortion" value={settings.vhsDistortion} min={0} max={100} step={1} onChange={(v) => update({ vhsDistortion: v })} />
              <SliderControl label="Tracking" value={settings.vhsTracking} min={0} max={100} step={1} onChange={(v) => update({ vhsTracking: v })} />
            </>
          )}
        </Section>

        <Section title="Animation">
          <SwitchControl label="Play" checked={settings.isPlaying} onChange={(v) => update({ isPlaying: v })} />
          <SliderControl label="Speed" value={settings.animationSpeed} min={1} max={100} step={1} onChange={(v) => update({ animationSpeed: v })} />
        </Section>
      </Sidebar>
      <CanvasArea ref={containerRef} />
    </>
  )
}
