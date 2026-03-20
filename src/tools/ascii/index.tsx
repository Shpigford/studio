import { useCallback, useRef, useEffect } from "react"
import { useSettings } from "@/hooks/use-settings"
import { useP5 } from "@/hooks/use-p5"
import { exportPNG, generateFilename } from "@/lib/export"
import { CanvasArea } from "@/components/canvas-area"
import { Sidebar } from "@/components/sidebar"
import { Section } from "@/components/controls/section"
import { SliderControl } from "@/components/controls/slider-control"
import { SelectControl } from "@/components/controls/select-control"
import { ColorControl } from "@/components/controls/color-control"
import { SwitchControl } from "@/components/controls/switch-control"
import { ButtonRow } from "@/components/controls/button-row"
import { Button } from "@/components/ui/button"
import { useShortcutActions } from '@/hooks/use-shortcut-actions'
import { Kbd } from '@/components/ui/kbd'
import { getSourceImage, setSourceImage } from "@/lib/source-image"
import { createAsciiSketch } from "./sketch"
import type { AsciiSettings, SetConfig } from "./types"
import type p5 from "p5"
import type { RefObject } from "react"

const SET_NAMES = [
  "standard",
  "detailed",
  "blocks",
  "simple",
  "dots",
  "minimal",
] as const

const DEFAULT_SET_CONFIG: SetConfig = {
  standard: { enabled: true, weight: 100 },
  detailed: { enabled: false, weight: 50 },
  blocks: { enabled: false, weight: 50 },
  simple: { enabled: false, weight: 50 },
  dots: { enabled: false, weight: 50 },
  minimal: { enabled: false, weight: 50 },
}

const DEFAULTS: AsciiSettings = {
  charSet: "standard",
  mixingEnabled: false,
  mixingMode: "hybrid",
  mixingSeed: 12345,
  setConfig: DEFAULT_SET_CONFIG,
  hybridBlend: { random: 33, zone: 34, spatial: 33 },
  zoneMapping: { dark: "standard", mid: "standard", light: "standard" },
  spatialNoiseScale: 0.1,

  sizeVariationEnabled: false,
  sizeVariationMode: "detail",
  sizeConfig: { minSize: 4, maxSize: 16, tileSize: 64, sizeSteps: 4 },
  sizeDetailSettings: {
    edgeSensitivity: 50,
    brightnessBias: 50,
    detailThreshold: 30,
  },
  sizeTextureSettings: { noiseScale: 0.05, noiseOctaves: 2, seed: 12345 },
  sizeFocusSettings: {
    focusX: 0.5,
    focusY: 0.5,
    focusRadius: 0.3,
    falloffCurve: "linear",
    centerSize: "small",
  },

  fontSize: 8,
  letterSpacing: 0,
  lineHeight: 1.0,

  useColors: true,
  textColor: "#ffffff",
  colorSaturation: 100,
  bgColor: "#0a0a0f",

  showOriginal: false,
  originalOpacity: 30,
  asciiOpacity: 100,

  contrast: 100,
  brightness: 0,
  invert: false,

  grainAmount: 0,
  textureAmount: 0,

  sketchEnabled: false,
  sketchStyle: "hatching",
  sketchDensity: 50,
  sketchWobble: 5,
  sketchStrokeWeight: 1,
  sketchOpacity: 60,

  sketchReactTo: "darks",
  sketchMinThreshold: 0,
  sketchMaxThreshold: 70,
  sketchInvert: false,

  sketchColorMatch: true,
  sketchColor: "#ffffff",
  sketchColorVariation: 0,
  sketchSaturationBoost: 0,

  hatchAngle: 45,
  hatchAngleVariation: 15,
  hatchLineLength: 20,
  hatchCrossHatch: false,
  hatchCrossOpacity: 50,

  contourMinStrength: 20,
  contourEdgeSensitivity: 70,
  contourSmoothness: 5,
  contourFlowDirection: "follow-gradient",

  stippleDotSize: 3,
  stippleSizeVariation: 50,
  stippleClustering: 50,

  blocksLevels: 5,
  blocksResolution: 8,
  blocksMinSize: 10,
  blocksSmoothing: 50,
  blocksFill: false,
  blocksFillOpacity: 30,

  sketchDrawOrder: "above-ascii",
  sketchBlendMode: "normal",

  imageVersion: 0,
}

const CHAR_SET_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "detailed", label: "Detailed" },
  { value: "blocks", label: "Blocks" },
  { value: "simple", label: "Simple" },
  { value: "dots", label: "Dots" },
  { value: "minimal", label: "Minimal" },
]

const MIXING_MODE_OPTIONS = [
  { value: "random", label: "Random" },
  { value: "brightness", label: "Brightness Zones" },
  { value: "spatial", label: "Spatial Noise" },
  { value: "hybrid", label: "Hybrid" },
]

const SIZE_MODE_OPTIONS = [
  { value: "detail", label: "Detail Emphasis" },
  { value: "texture", label: "Artistic Texture" },
  { value: "focus", label: "Depth/Focus" },
]

const FALLOFF_OPTIONS = [
  { value: "linear", label: "Linear" },
  { value: "ease-in", label: "Ease In" },
  { value: "ease-out", label: "Ease Out" },
  { value: "gaussian", label: "Gaussian" },
]

const CENTER_SIZE_OPTIONS = [
  { value: "small", label: "Small (Sharp Focus)" },
  { value: "large", label: "Large (Soft Focus)" },
]

const SKETCH_STYLE_OPTIONS = [
  { value: "hatching", label: "Cross-Hatching" },
  { value: "contour", label: "Contour Lines" },
  { value: "stipple", label: "Stippling" },
  { value: "blocks", label: "Blocks" },
  { value: "mixed", label: "Mixed" },
]

const REACT_TO_OPTIONS = [
  { value: "darks", label: "Dark Areas" },
  { value: "lights", label: "Light Areas" },
  { value: "midtones", label: "Midtones" },
  { value: "edges", label: "Edges" },
  { value: "all", label: "All Areas" },
]

const FLOW_DIRECTION_OPTIONS = [
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
  { value: "angled-right", label: "Angled Right" },
  { value: "angled-left", label: "Angled Left" },
  { value: "radial", label: "Radial" },
  { value: "follow-gradient", label: "Follow Gradient" },
]

const DRAW_ORDER_OPTIONS = [
  { value: "behind-ascii", label: "Behind ASCII" },
  { value: "above-ascii", label: "Above ASCII" },
  { value: "both", label: "Both" },
]

const BLEND_MODE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
]

export default function Ascii() {
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [settings, update, reset] = useSettings<AsciiSettings>(
    "ascii",
    DEFAULTS,
  )

  const sketchFn = useCallback(
    (p: p5, settingsRef: RefObject<AsciiSettings>) => {
      createAsciiSketch(p, settingsRef, imageRef)
    },
    [],
  )

  const p5Ref = useP5(containerRef, sketchFn, settings)

  const loadImageFromDataUrl = useCallback(
    (dataUrl: string) => {
      const img = new Image()
      img.onload = () => {
        imageRef.current = img
        setSourceImage('ascii', dataUrl)
        update({ imageVersion: settings.imageVersion + 1 })
      }
      img.src = dataUrl
    },
    [update, settings.imageVersion],
  )

  const handleImageFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => loadImageFromDataUrl(reader.result as string)
      reader.readAsDataURL(file)
    },
    [loadImageFromDataUrl],
  )

  // Restore source image on mount (when navigating from saved designs panel)
  // and on settings-loaded event (when already on this tool)
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      const src = getSourceImage('ascii')
      if (src && !imageRef.current) loadImageFromDataUrl(src)
    }
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.key !== 'studio:ascii') return
      const src = getSourceImage('ascii')
      if (src) loadImageFromDataUrl(src)
    }
    window.addEventListener('studio:settings-loaded', handler)
    return () => window.removeEventListener('studio:settings-loaded', handler)
  }, [loadImageFromDataUrl])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith("image/")) handleImageFile(file)
    },
    [handleImageFile],
  )

  const handleExportPNG = useCallback(() => {
    const canvas = (p5Ref.current as unknown as { canvas: HTMLCanvasElement })
      ?.canvas
    if (!canvas) return
    exportPNG(canvas, generateFilename("ascii", "png"))
  }, [p5Ref])

  function randomize() {
    const r = Math.random
    const ri = (min: number, max: number) =>
      Math.floor(r() * (max - min) + min)
    const rf = (min: number, max: number) => r() * (max - min) + min

    const sets = Object.keys(DEFAULT_SET_CONFIG) as Array<
      keyof typeof DEFAULT_SET_CONFIG
    >
    const charSet = sets[ri(0, sets.length)]

    const patch: Partial<AsciiSettings> = {
      fontSize: ri(5, 16),
      letterSpacing: rf(-1, 3),
      lineHeight: rf(0.7, 1.5),
      colorSaturation: ri(50, 150),
      contrast: ri(80, 150),
      brightness: ri(-30, 30),
      grainAmount: ri(0, 40),
      textureAmount: ri(0, 40),
      charSet,
      useColors: r() > 0.3,
    }

    // 25% chance: enable mixing
    if (r() > 0.75) {
      const numToEnable = ri(2, 5)
      const shuffled = [...sets].sort(() => r() - 0.5)
      const newSetConfig = { ...DEFAULT_SET_CONFIG }
      for (const name of sets) {
        newSetConfig[name] = {
          enabled: shuffled.indexOf(name) < numToEnable,
          weight: ri(30, 100),
        }
      }
      const modes = ["random", "brightness", "spatial", "hybrid"]
      patch.mixingEnabled = true
      patch.mixingSeed = ri(0, 100000)
      patch.setConfig = newSetConfig
      patch.mixingMode = modes[ri(0, modes.length)]
      patch.hybridBlend = {
        random: ri(0, 100),
        zone: ri(0, 100),
        spatial: ri(0, 100),
      }
      patch.spatialNoiseScale = rf(0.05, 0.55)
    } else {
      patch.mixingEnabled = false
    }

    // 30% chance: enable sketch
    if (r() > 0.7) {
      const styles = ["hatching", "contour", "stipple", "blocks", "mixed"]
      const reactModes = ["darks", "lights", "midtones", "edges", "all"]
      const flowDirs = [
        "horizontal",
        "vertical",
        "angled-right",
        "angled-left",
        "radial",
        "follow-gradient",
      ]
      const drawOrders = ["behind-ascii", "above-ascii", "both"]
      const blendModes = ["normal", "multiply", "screen", "overlay"]

      patch.sketchEnabled = true
      patch.sketchStyle = styles[ri(0, styles.length)]
      patch.sketchDensity = ri(20, 80)
      patch.sketchWobble = rf(2, 12)
      patch.sketchStrokeWeight = rf(0.5, 2.5)
      patch.sketchOpacity = ri(30, 80)
      patch.sketchReactTo = reactModes[ri(0, reactModes.length)]
      patch.sketchMinThreshold = ri(0, 30)
      patch.sketchMaxThreshold = ri(50, 100)
      patch.sketchInvert = r() > 0.8
      patch.sketchColorMatch = r() > 0.3
      patch.sketchColorVariation = ri(0, 30)
      patch.sketchSaturationBoost = ri(0, 50)
      patch.hatchAngle = ri(0, 180)
      patch.hatchAngleVariation = ri(5, 35)
      patch.hatchLineLength = ri(10, 40)
      patch.hatchCrossHatch = r() > 0.5
      patch.hatchCrossOpacity = ri(30, 70)
      patch.contourMinStrength = ri(10, 60)
      patch.contourEdgeSensitivity = ri(30, 80)
      patch.contourSmoothness = ri(3, 8)
      patch.contourFlowDirection = flowDirs[ri(0, flowDirs.length)]
      patch.stippleDotSize = ri(1, 7)
      patch.stippleSizeVariation = ri(20, 80)
      patch.stippleClustering = ri(20, 80)
      patch.blocksLevels = ri(3, 10)
      patch.blocksResolution = ri(3, 15)
      patch.blocksMinSize = ri(5, 30)
      patch.blocksSmoothing = ri(20, 80)
      patch.blocksFill = r() > 0.5
      patch.blocksFillOpacity = ri(20, 60)
      patch.sketchDrawOrder = drawOrders[ri(0, drawOrders.length)]
      patch.sketchBlendMode = blendModes[ri(0, blendModes.length)]
    } else {
      patch.sketchEnabled = false
    }

    // 25% chance: enable size variation
    if (r() > 0.75) {
      const sizeModes = ["detail", "texture", "focus"]
      const curves = ["linear", "ease-in", "ease-out", "gaussian"]
      const minSize = ri(4, 10)
      patch.sizeVariationEnabled = true
      patch.sizeVariationMode = sizeModes[ri(0, sizeModes.length)]
      patch.sizeConfig = {
        minSize,
        maxSize: minSize + ri(4, 16),
        tileSize: 32 + ri(0, 12) * 8,
        sizeSteps: ri(2, 8),
      }
      patch.sizeDetailSettings = {
        edgeSensitivity: ri(0, 100),
        brightnessBias: ri(0, 100),
        detailThreshold: ri(0, 60),
      }
      patch.sizeTextureSettings = {
        noiseScale: rf(0.01, 0.31),
        noiseOctaves: ri(1, 5),
        seed: ri(0, 100000),
      }
      patch.sizeFocusSettings = {
        focusX: r(),
        focusY: r(),
        focusRadius: rf(0.1, 0.7),
        falloffCurve: curves[ri(0, curves.length)],
        centerSize: r() > 0.5 ? "small" : "large",
      }
    } else {
      patch.sizeVariationEnabled = false
    }

    update(patch)
  }

  useShortcutActions({ randomize, reset, download: handleExportPNG })

  const enabledSets = SET_NAMES.filter((n) => settings.setConfig[n].enabled)

  return (
    <>
      <Sidebar
        footer={
          <ButtonRow>
            <Button variant="secondary" className="w-full" onClick={randomize}>
              Randomize <Kbd>R</Kbd>
            </Button>
            <Button variant="secondary" className="w-full" onClick={reset}>
              Reset <Kbd>⌫</Kbd>
            </Button>
            <Button
              variant="primary"
              className="w-full"
              onClick={handleExportPNG}
            >
              Download <Kbd>⌘S</Kbd>
            </Button>
          </ButtonRow>
        }
      >
        <h2 className="mb-3 text-base font-medium text-text-primary">ASCII</h2>
        <div className="flex flex-col gap-4">
          {/* Image */}
          <Section title="Image">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageFile(file)
              }}
            />
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              Load Image
            </Button>
          </Section>

          {/* Characters */}
          <Section title="Characters">
            <SelectControl
              label="Character Set"
              value={settings.charSet}
              options={CHAR_SET_OPTIONS}
              onChange={(v) => update({ charSet: v })}
            />
            <SwitchControl
              label="Enable Mixing"
              checked={settings.mixingEnabled}
              onChange={(v) => update({ mixingEnabled: v })}
            />
            {settings.mixingEnabled && (
              <div className="flex flex-col gap-3 rounded-md border border-border-control p-3">
                <SelectControl
                  label="Mixing Mode"
                  value={settings.mixingMode}
                  options={MIXING_MODE_OPTIONS}
                  onChange={(v) => update({ mixingMode: v })}
                />
                <div className="flex flex-col gap-2">
                  <span className="text-2xs font-medium uppercase tracking-wider text-text-tertiary">
                    Active Sets
                  </span>
                  {SET_NAMES.map((name) => (
                    <div key={name} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.setConfig[name].enabled}
                        onChange={(e) =>
                          update({
                            setConfig: {
                              ...settings.setConfig,
                              [name]: {
                                ...settings.setConfig[name],
                                enabled: e.target.checked,
                              },
                            },
                          })
                        }
                        className="h-3 w-3 accent-white"
                      />
                      <span className="w-14 text-xs capitalize text-text-secondary">
                        {name}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={settings.setConfig[name].weight}
                        onChange={(e) =>
                          update({
                            setConfig: {
                              ...settings.setConfig,
                              [name]: {
                                ...settings.setConfig[name],
                                weight: parseInt(e.target.value),
                              },
                            },
                          })
                        }
                        className="h-1 flex-1"
                        disabled={!settings.setConfig[name].enabled}
                      />
                      <span className="w-8 text-right font-mono text-xs tabular-nums text-text-tertiary">
                        {settings.setConfig[name].weight}
                      </span>
                    </div>
                  ))}
                </div>

                {settings.mixingMode === "hybrid" && (
                  <>
                    <SliderControl
                      label="Random Blend"
                      value={settings.hybridBlend.random}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) =>
                        update({
                          hybridBlend: { ...settings.hybridBlend, random: v },
                        })
                      }
                    />
                    <SliderControl
                      label="Zone Blend"
                      value={settings.hybridBlend.zone}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) =>
                        update({
                          hybridBlend: { ...settings.hybridBlend, zone: v },
                        })
                      }
                    />
                    <SliderControl
                      label="Spatial Blend"
                      value={settings.hybridBlend.spatial}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) =>
                        update({
                          hybridBlend: { ...settings.hybridBlend, spatial: v },
                        })
                      }
                    />
                  </>
                )}

                {(settings.mixingMode === "brightness" ||
                  settings.mixingMode === "hybrid") && (
                  <>
                    <SelectControl
                      label="Dark Zone"
                      value={settings.zoneMapping.dark}
                      options={enabledSets.map((n) => ({
                        value: n,
                        label: n.charAt(0).toUpperCase() + n.slice(1),
                      }))}
                      onChange={(v) =>
                        update({
                          zoneMapping: { ...settings.zoneMapping, dark: v },
                        })
                      }
                    />
                    <SelectControl
                      label="Mid Zone"
                      value={settings.zoneMapping.mid}
                      options={enabledSets.map((n) => ({
                        value: n,
                        label: n.charAt(0).toUpperCase() + n.slice(1),
                      }))}
                      onChange={(v) =>
                        update({
                          zoneMapping: { ...settings.zoneMapping, mid: v },
                        })
                      }
                    />
                    <SelectControl
                      label="Light Zone"
                      value={settings.zoneMapping.light}
                      options={enabledSets.map((n) => ({
                        value: n,
                        label: n.charAt(0).toUpperCase() + n.slice(1),
                      }))}
                      onChange={(v) =>
                        update({
                          zoneMapping: { ...settings.zoneMapping, light: v },
                        })
                      }
                    />
                  </>
                )}

                {(settings.mixingMode === "spatial" ||
                  settings.mixingMode === "hybrid") && (
                  <SliderControl
                    label="Noise Scale"
                    value={settings.spatialNoiseScale}
                    min={0.01}
                    max={1}
                    step={0.01}
                    decimals={2}
                    onChange={(v) => update({ spatialNoiseScale: v })}
                  />
                )}
              </div>
            )}
          </Section>

          {/* Size Variation */}
          <Section title="Size Variation" defaultOpen={false}>
            <SwitchControl
              label="Enable Size Variation"
              checked={settings.sizeVariationEnabled}
              onChange={(v) => update({ sizeVariationEnabled: v })}
            />
            {settings.sizeVariationEnabled && (
              <div className="flex flex-col gap-3">
                <SelectControl
                  label="Mode"
                  value={settings.sizeVariationMode}
                  options={SIZE_MODE_OPTIONS}
                  onChange={(v) => update({ sizeVariationMode: v })}
                />
                <SliderControl
                  label="Min Size"
                  value={settings.sizeConfig.minSize}
                  min={4}
                  max={16}
                  step={1}
                  onChange={(v) =>
                    update({
                      sizeConfig: { ...settings.sizeConfig, minSize: v },
                    })
                  }
                />
                <SliderControl
                  label="Max Size"
                  value={settings.sizeConfig.maxSize}
                  min={8}
                  max={24}
                  step={1}
                  onChange={(v) =>
                    update({
                      sizeConfig: { ...settings.sizeConfig, maxSize: v },
                    })
                  }
                />
                <SliderControl
                  label="Size Steps"
                  value={settings.sizeConfig.sizeSteps}
                  min={2}
                  max={8}
                  step={1}
                  onChange={(v) =>
                    update({
                      sizeConfig: { ...settings.sizeConfig, sizeSteps: v },
                    })
                  }
                />

                {settings.sizeVariationMode === "detail" && (
                  <>
                    <SliderControl
                      label="Edge Sensitivity"
                      value={settings.sizeDetailSettings.edgeSensitivity}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) =>
                        update({
                          sizeDetailSettings: {
                            ...settings.sizeDetailSettings,
                            edgeSensitivity: v,
                          },
                        })
                      }
                    />
                    <SliderControl
                      label="Brightness Bias"
                      value={settings.sizeDetailSettings.brightnessBias}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) =>
                        update({
                          sizeDetailSettings: {
                            ...settings.sizeDetailSettings,
                            brightnessBias: v,
                          },
                        })
                      }
                    />
                    <SliderControl
                      label="Detail Threshold"
                      value={settings.sizeDetailSettings.detailThreshold}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) =>
                        update({
                          sizeDetailSettings: {
                            ...settings.sizeDetailSettings,
                            detailThreshold: v,
                          },
                        })
                      }
                    />
                  </>
                )}

                {settings.sizeVariationMode === "texture" && (
                  <>
                    <SliderControl
                      label="Noise Scale"
                      value={settings.sizeTextureSettings.noiseScale}
                      min={0.01}
                      max={0.5}
                      step={0.01}
                      decimals={2}
                      onChange={(v) =>
                        update({
                          sizeTextureSettings: {
                            ...settings.sizeTextureSettings,
                            noiseScale: v,
                          },
                        })
                      }
                    />
                    <SliderControl
                      label="Noise Octaves"
                      value={settings.sizeTextureSettings.noiseOctaves}
                      min={1}
                      max={4}
                      step={1}
                      onChange={(v) =>
                        update({
                          sizeTextureSettings: {
                            ...settings.sizeTextureSettings,
                            noiseOctaves: v,
                          },
                        })
                      }
                    />
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() =>
                        update({
                          sizeTextureSettings: {
                            ...settings.sizeTextureSettings,
                            seed: Math.floor(Math.random() * 100000),
                          },
                        })
                      }
                    >
                      New Seed
                    </Button>
                  </>
                )}

                {settings.sizeVariationMode === "focus" && (
                  <>
                    <SliderControl
                      label="Focus X"
                      value={Math.round(settings.sizeFocusSettings.focusX * 100)}
                      min={0}
                      max={100}
                      step={1}
                      unit="%"
                      onChange={(v) =>
                        update({
                          sizeFocusSettings: {
                            ...settings.sizeFocusSettings,
                            focusX: v / 100,
                          },
                        })
                      }
                    />
                    <SliderControl
                      label="Focus Y"
                      value={Math.round(settings.sizeFocusSettings.focusY * 100)}
                      min={0}
                      max={100}
                      step={1}
                      unit="%"
                      onChange={(v) =>
                        update({
                          sizeFocusSettings: {
                            ...settings.sizeFocusSettings,
                            focusY: v / 100,
                          },
                        })
                      }
                    />
                    <SliderControl
                      label="Focus Radius"
                      value={Math.round(
                        settings.sizeFocusSettings.focusRadius * 100,
                      )}
                      min={10}
                      max={100}
                      step={1}
                      unit="%"
                      onChange={(v) =>
                        update({
                          sizeFocusSettings: {
                            ...settings.sizeFocusSettings,
                            focusRadius: v / 100,
                          },
                        })
                      }
                    />
                    <SelectControl
                      label="Falloff Curve"
                      value={settings.sizeFocusSettings.falloffCurve}
                      options={FALLOFF_OPTIONS}
                      onChange={(v) =>
                        update({
                          sizeFocusSettings: {
                            ...settings.sizeFocusSettings,
                            falloffCurve: v,
                          },
                        })
                      }
                    />
                    <SelectControl
                      label="Center Size"
                      value={settings.sizeFocusSettings.centerSize}
                      options={CENTER_SIZE_OPTIONS}
                      onChange={(v) =>
                        update({
                          sizeFocusSettings: {
                            ...settings.sizeFocusSettings,
                            centerSize: v,
                          },
                        })
                      }
                    />
                  </>
                )}
              </div>
            )}
          </Section>

          {/* Rendering */}
          <Section title="Rendering">
            <SliderControl
              label="Font Size"
              value={settings.fontSize}
              min={4}
              max={24}
              step={1}
              onChange={(v) => update({ fontSize: v })}
            />
            <SliderControl
              label="Letter Spacing"
              value={settings.letterSpacing}
              min={-2}
              max={5}
              step={0.1}
              decimals={1}
              onChange={(v) => update({ letterSpacing: v })}
            />
            <SliderControl
              label="Line Height"
              value={settings.lineHeight}
              min={0.5}
              max={2}
              step={0.1}
              decimals={1}
              onChange={(v) => update({ lineHeight: v })}
            />
          </Section>

          {/* Color */}
          <Section title="Color">
            <SwitchControl
              label="Match Image Colors"
              checked={settings.useColors}
              onChange={(v) => update({ useColors: v })}
            />
            {!settings.useColors && (
              <ColorControl
                label="Text Color"
                value={settings.textColor}
                onChange={(v) => update({ textColor: v })}
              />
            )}
            <SliderControl
              label="Saturation"
              value={settings.colorSaturation}
              min={0}
              max={200}
              step={1}
              onChange={(v) => update({ colorSaturation: v })}
            />
            <ColorControl
              label="Background"
              value={settings.bgColor}
              onChange={(v) => update({ bgColor: v })}
            />
          </Section>

          {/* Overlay */}
          <Section title="Overlay" defaultOpen={false}>
            <SwitchControl
              label="Show Original Image"
              checked={settings.showOriginal}
              onChange={(v) => update({ showOriginal: v })}
            />
            <SliderControl
              label="Image Opacity"
              value={settings.originalOpacity}
              min={0}
              max={100}
              step={1}
              onChange={(v) => update({ originalOpacity: v })}
            />
            <SliderControl
              label="ASCII Opacity"
              value={settings.asciiOpacity}
              min={0}
              max={100}
              step={1}
              onChange={(v) => update({ asciiOpacity: v })}
            />
          </Section>

          {/* Adjustments */}
          <Section title="Adjustments" defaultOpen={false}>
            <SliderControl
              label="Contrast"
              value={settings.contrast}
              min={50}
              max={200}
              step={1}
              onChange={(v) => update({ contrast: v })}
            />
            <SliderControl
              label="Brightness"
              value={settings.brightness}
              min={-100}
              max={100}
              step={1}
              onChange={(v) => update({ brightness: v })}
            />
            <SwitchControl
              label="Invert"
              checked={settings.invert}
              onChange={(v) => update({ invert: v })}
            />
          </Section>

          {/* Texture */}
          <Section title="Texture" defaultOpen={false}>
            <SliderControl
              label="Grain Amount"
              value={settings.grainAmount}
              min={0}
              max={100}
              step={1}
              onChange={(v) => update({ grainAmount: v })}
            />
            <SliderControl
              label="Texture Amount"
              value={settings.textureAmount}
              min={0}
              max={100}
              step={1}
              onChange={(v) => update({ textureAmount: v })}
            />
          </Section>

          {/* Sketch */}
          <Section title="Sketch" defaultOpen={false}>
            <SwitchControl
              label="Enable Sketch"
              checked={settings.sketchEnabled}
              onChange={(v) => update({ sketchEnabled: v })}
            />
            {settings.sketchEnabled && (
              <div className="flex flex-col gap-3">
                <SelectControl
                  label="Style"
                  value={settings.sketchStyle}
                  options={SKETCH_STYLE_OPTIONS}
                  onChange={(v) => update({ sketchStyle: v })}
                />
                {settings.sketchStyle !== "blocks" && (
                  <SliderControl
                    label="Density"
                    value={settings.sketchDensity}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(v) => update({ sketchDensity: v })}
                  />
                )}
                <SliderControl
                  label="Wobble"
                  value={settings.sketchWobble}
                  min={0}
                  max={20}
                  step={0.5}
                  decimals={1}
                  onChange={(v) => update({ sketchWobble: v })}
                />
                <SliderControl
                  label="Stroke Weight"
                  value={settings.sketchStrokeWeight}
                  min={0.5}
                  max={3}
                  step={0.1}
                  decimals={1}
                  onChange={(v) => update({ sketchStrokeWeight: v })}
                />
                <SliderControl
                  label="Opacity"
                  value={settings.sketchOpacity}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => update({ sketchOpacity: v })}
                />

                {/* Brightness Reactivity (hidden for contour/blocks) */}
                {settings.sketchStyle !== "contour" &&
                  settings.sketchStyle !== "blocks" && (
                    <>
                      <span className="text-2xs font-medium uppercase tracking-wider text-text-tertiary">
                        Brightness Reactivity
                      </span>
                      <SelectControl
                        label="React To"
                        value={settings.sketchReactTo}
                        options={REACT_TO_OPTIONS}
                        onChange={(v) => update({ sketchReactTo: v })}
                      />
                      <SliderControl
                        label="Min Threshold"
                        value={settings.sketchMinThreshold}
                        min={0}
                        max={100}
                        step={1}
                        onChange={(v) => update({ sketchMinThreshold: v })}
                      />
                      <SliderControl
                        label="Max Threshold"
                        value={settings.sketchMaxThreshold}
                        min={0}
                        max={100}
                        step={1}
                        onChange={(v) => update({ sketchMaxThreshold: v })}
                      />
                      <SwitchControl
                        label="Invert Threshold"
                        checked={settings.sketchInvert}
                        onChange={(v) => update({ sketchInvert: v })}
                      />
                    </>
                  )}

                {/* Color Settings */}
                <span className="text-2xs font-medium uppercase tracking-wider text-text-tertiary">
                  Color
                </span>
                <SwitchControl
                  label="Match Image Colors"
                  checked={settings.sketchColorMatch}
                  onChange={(v) => update({ sketchColorMatch: v })}
                />
                {!settings.sketchColorMatch && (
                  <ColorControl
                    label="Sketch Color"
                    value={settings.sketchColor}
                    onChange={(v) => update({ sketchColor: v })}
                  />
                )}
                <SliderControl
                  label="Color Variation"
                  value={settings.sketchColorVariation}
                  min={0}
                  max={50}
                  step={1}
                  onChange={(v) => update({ sketchColorVariation: v })}
                />
                <SliderControl
                  label="Saturation Boost"
                  value={settings.sketchSaturationBoost}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => update({ sketchSaturationBoost: v })}
                />

                {/* Hatching */}
                {(settings.sketchStyle === "hatching" ||
                  settings.sketchStyle === "mixed") && (
                  <>
                    <span className="text-2xs font-medium uppercase tracking-wider text-text-tertiary">
                      Hatching
                    </span>
                    <SliderControl
                      label="Hatch Angle"
                      value={settings.hatchAngle}
                      min={0}
                      max={180}
                      step={1}
                      unit="°"
                      onChange={(v) => update({ hatchAngle: v })}
                    />
                    <SliderControl
                      label="Angle Variation"
                      value={settings.hatchAngleVariation}
                      min={0}
                      max={45}
                      step={1}
                      unit="°"
                      onChange={(v) => update({ hatchAngleVariation: v })}
                    />
                    <SliderControl
                      label="Line Length"
                      value={settings.hatchLineLength}
                      min={5}
                      max={50}
                      step={1}
                      onChange={(v) => update({ hatchLineLength: v })}
                    />
                    <SwitchControl
                      label="Cross-Hatch"
                      checked={settings.hatchCrossHatch}
                      onChange={(v) => update({ hatchCrossHatch: v })}
                    />
                    {settings.hatchCrossHatch && (
                      <SliderControl
                        label="Cross-Hatch Opacity"
                        value={settings.hatchCrossOpacity}
                        min={0}
                        max={100}
                        step={1}
                        onChange={(v) => update({ hatchCrossOpacity: v })}
                      />
                    )}
                  </>
                )}

                {/* Contour */}
                {(settings.sketchStyle === "contour" ||
                  settings.sketchStyle === "mixed") && (
                  <>
                    <span className="text-2xs font-medium uppercase tracking-wider text-text-tertiary">
                      Contour
                    </span>
                    <SliderControl
                      label="Min Edge Strength"
                      value={settings.contourMinStrength}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) => update({ contourMinStrength: v })}
                    />
                    <SliderControl
                      label="Edge Detail"
                      value={settings.contourEdgeSensitivity}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) => update({ contourEdgeSensitivity: v })}
                    />
                    <SliderControl
                      label="Line Smoothness"
                      value={settings.contourSmoothness}
                      min={1}
                      max={10}
                      step={1}
                      onChange={(v) => update({ contourSmoothness: v })}
                    />
                    <SelectControl
                      label="Flow Direction"
                      value={settings.contourFlowDirection}
                      options={FLOW_DIRECTION_OPTIONS}
                      onChange={(v) => update({ contourFlowDirection: v })}
                    />
                  </>
                )}

                {/* Stipple */}
                {(settings.sketchStyle === "stipple" ||
                  settings.sketchStyle === "mixed") && (
                  <>
                    <span className="text-2xs font-medium uppercase tracking-wider text-text-tertiary">
                      Stipple
                    </span>
                    <SliderControl
                      label="Dot Size"
                      value={settings.stippleDotSize}
                      min={1}
                      max={10}
                      step={1}
                      onChange={(v) => update({ stippleDotSize: v })}
                    />
                    <SliderControl
                      label="Size Variation"
                      value={settings.stippleSizeVariation}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) => update({ stippleSizeVariation: v })}
                    />
                    <SliderControl
                      label="Clustering"
                      value={settings.stippleClustering}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) => update({ stippleClustering: v })}
                    />
                  </>
                )}

                {/* Blocks */}
                {settings.sketchStyle === "blocks" && (
                  <>
                    <span className="text-2xs font-medium uppercase tracking-wider text-text-tertiary">
                      Blocks
                    </span>
                    <SliderControl
                      label="Number of Levels"
                      value={settings.blocksLevels}
                      min={2}
                      max={12}
                      step={1}
                      onChange={(v) => update({ blocksLevels: v })}
                    />
                    <SliderControl
                      label="Simplification"
                      value={settings.blocksResolution}
                      min={1}
                      max={20}
                      step={1}
                      onChange={(v) => update({ blocksResolution: v })}
                    />
                    <SliderControl
                      label="Min Block Size"
                      value={settings.blocksMinSize}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) => update({ blocksMinSize: v })}
                    />
                    <SliderControl
                      label="Outline Smoothing"
                      value={settings.blocksSmoothing}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) => update({ blocksSmoothing: v })}
                    />
                    <SwitchControl
                      label="Fill Blocks"
                      checked={settings.blocksFill}
                      onChange={(v) => update({ blocksFill: v })}
                    />
                    {settings.blocksFill && (
                      <SliderControl
                        label="Fill Opacity"
                        value={settings.blocksFillOpacity}
                        min={0}
                        max={100}
                        step={1}
                        onChange={(v) => update({ blocksFillOpacity: v })}
                      />
                    )}
                  </>
                )}

                {/* Layer */}
                <span className="text-2xs font-medium uppercase tracking-wider text-text-tertiary">
                  Layer
                </span>
                <SelectControl
                  label="Draw Order"
                  value={settings.sketchDrawOrder}
                  options={DRAW_ORDER_OPTIONS}
                  onChange={(v) => update({ sketchDrawOrder: v })}
                />
                <SelectControl
                  label="Blend Mode"
                  value={settings.sketchBlendMode}
                  options={BLEND_MODE_OPTIONS}
                  onChange={(v) => update({ sketchBlendMode: v })}
                />
              </div>
            )}
          </Section>
        </div>
      </Sidebar>
      <CanvasArea
        ref={containerRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      />
    </>
  )
}
