import { useCallback, useEffect, useRef, useState } from "react"
import { useSettings } from "@/hooks/use-settings"
import { CanvasArea } from "@/components/canvas-area"
import { Sidebar } from "@/components/sidebar"
import { Section } from "@/components/controls/section"
import { SliderControl } from "@/components/controls/slider-control"
import { SelectControl } from "@/components/controls/select-control"
import { PaletteEditor } from "@/components/controls/palette-editor"
import { ButtonRow } from "@/components/controls/button-row"
import { Button } from "@/components/ui/button"
import { useShortcutActions } from '@/hooks/use-shortcut-actions'
import { Kbd } from '@/components/ui/kbd'
import { exportPNG, exportSVG, generateFilename } from "@/lib/export"
import type { DitherSettings } from "./types"
import {
  generateGradientGrid,
  ditherImage,
  processImageToGrid,
  renderDither,
} from "./engine"
import { generateDitherSvg } from "./svg"
import {
  ASPECT_OPTIONS,
  DEFAULTS,
  PALETTE_PRESETS,
  PATTERN_OPTIONS,
} from "./config"
import {
  createRandomPalette,
  createRandomSettingsPatch,
} from "./randomize"

function getGradientHeight(
  width: number,
  aspectRatio: string,
  customHeight: number,
): number {
  if (aspectRatio === "custom") return customHeight
  const [rw, rh] = aspectRatio.split(":").map(Number)
  return Math.round((width * rh) / rw)
}

export default function Dither() {
  const [settings, update, reset] = useSettings<DitherSettings>("dither", DEFAULTS)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sourceImageRef = useRef<HTMLImageElement | null>(null)
  const gridRef = useRef<{
    grid: number[][]
    cols: number
    rows: number
  } | null>(null)
  // Counter to force re-render after grid changes (refs don't trigger renders)
  const [gridVersion, setGridVersion] = useState(0)

  const buildEngineSettings = useCallback((s: DitherSettings) => {
    const totalWeight = s.colors.reduce((sum, c) => sum + c.weight, 0)
    const percentages = s.colors.map((c) => (c.weight / totalWeight) * 100)
    const palette = s.colors.map((c) => c.color)
    return {
      pattern: s.pattern,
      mode: s.ditherMode,
      style: s.ditherStyle,
      shape: s.shapeType,
      cellSize: s.cellSize,
      angle: s.angle,
      scale: s.scale,
      offsetX: s.offsetX,
      offsetY: s.offsetY,
      palette,
      percentages,
    }
  }, [])

  // Render dithered result to canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current
    const g = gridRef.current
    if (!canvas || !g) return

    const engineSettings = buildEngineSettings(settings)
    const dithered = ditherImage(g.grid, g.cols, g.rows, engineSettings)

    const width = g.cols * settings.cellSize
    const height = g.rows * settings.cellSize
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")!
    renderDither(ctx, dithered, g.cols, g.rows, engineSettings)
  }, [settings, buildEngineSettings])

  // Generate gradient grid and trigger re-render
  const generateGrid = useCallback(() => {
    const h = getGradientHeight(
      settings.gradientWidth,
      settings.aspectRatio,
      settings.gradientHeight,
    )
    gridRef.current = generateGradientGrid(
      settings.gradientType,
      settings.gradientWidth,
      settings.cellSize,
      h,
      settings.gradientAngle,
    )
    sourceImageRef.current = null
    setGridVersion((v) => v + 1)
  }, [
    settings.gradientType,
    settings.gradientWidth,
    settings.gradientHeight,
    settings.aspectRatio,
    settings.gradientAngle,
    settings.cellSize,
  ])

  // Re-generate source when source params change
  useEffect(() => {
    if (settings.sourceType === "gradient") {
      generateGrid()
    } else if (sourceImageRef.current) {
      gridRef.current = processImageToGrid(
        sourceImageRef.current,
        settings.cellSize,
      )
      setGridVersion((v) => v + 1)
    }
  }, [
    settings.sourceType,
    settings.gradientType,
    settings.gradientWidth,
    settings.gradientHeight,
    settings.aspectRatio,
    settings.gradientAngle,
    settings.cellSize,
    generateGrid,
  ])

  // Re-render when settings or grid version changes
  useEffect(() => {
    render()
  }, [render, gridVersion])

  // Image upload handler
  const handleImageFile = useCallback(
    (file: File) => {
      const img = new Image()
      img.onload = () => {
        sourceImageRef.current = img
        gridRef.current = processImageToGrid(img, settings.cellSize)
        update({ sourceType: "image" })
        setGridVersion((v) => v + 1)
      }
      img.src = URL.createObjectURL(file)
    },
    [update, settings.cellSize],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith("image/")) {
        handleImageFile(file)
      }
    },
    [handleImageFile],
  )

  const handleExportPNG = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !canvas.width) return
    exportPNG(canvas, generateFilename("dither", "png"))
  }, [])

  const handleExportSVG = useCallback(() => {
    const g = gridRef.current
    if (!g) return
    const engineSettings = buildEngineSettings(settings)
    const svg = generateDitherSvg(g.grid, g.cols, g.rows, engineSettings)
    if (svg) exportSVG(svg, generateFilename("dither", "svg"))
  }, [settings, buildEngineSettings])

  const randomizeColors = useCallback(() => {
    update({ colors: createRandomPalette() })
  }, [update])

  const randomize = useCallback(() => {
    update(createRandomSettingsPatch())
  }, [update])

  useShortcutActions({ randomize, reset, download: handleExportSVG })

  return (
    <>
      <Sidebar
        footer={
          <ButtonRow>
            <Button variant="secondary" onClick={randomize}>Randomize <Kbd>R</Kbd></Button>
            <Button variant="secondary" onClick={reset}>Reset <Kbd>⌫</Kbd></Button>
            <Button
              variant="primary"
              className="w-full"
              onClick={handleExportSVG}
            >
              Export SVG <Kbd>⌘S</Kbd>
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleExportPNG}
            >
              Export PNG
            </Button>
          </ButtonRow>
        }
      >
        <h2 className="mb-3 text-base font-medium text-text-primary">Dither</h2>
        <div className="flex flex-col gap-4">
          <Section title="Source">
            <SelectControl
              label="Source"
              value={settings.sourceType}
              options={[
                { value: "image", label: "Image" },
                { value: "gradient", label: "Gradient" },
              ]}
              onChange={(v) =>
                update({ sourceType: v as "image" | "gradient" })
              }
            />
            {settings.sourceType === "image" && (
              <>
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
              </>
            )}
            {settings.sourceType === "gradient" && (
              <>
                <SelectControl
                  label="Type"
                  value={settings.gradientType}
                  options={[
                    { value: "linear", label: "Linear" },
                    { value: "radial", label: "Radial" },
                    { value: "conic", label: "Conic" },
                    { value: "noise", label: "Noise" },
                  ]}
                  onChange={(v) =>
                    update({
                      gradientType: v as DitherSettings["gradientType"],
                    })
                  }
                />
                {settings.gradientType !== "radial" &&
                  settings.gradientType !== "noise" && (
                    <SliderControl
                      label="Angle"
                      value={settings.gradientAngle}
                      min={0}
                      max={360}
                      step={1}
                      unit="°"
                      onChange={(v) => update({ gradientAngle: v })}
                    />
                  )}
                <SelectControl
                  label="Aspect Ratio"
                  value={settings.aspectRatio}
                  options={ASPECT_OPTIONS}
                  onChange={(v) => update({ aspectRatio: v })}
                />
                <SliderControl
                  label="Width"
                  value={settings.gradientWidth}
                  min={256}
                  max={2048}
                  step={64}
                  unit="px"
                  onChange={(v) => update({ gradientWidth: v })}
                />
                {settings.aspectRatio === "custom" && (
                  <SliderControl
                    label="Height"
                    value={settings.gradientHeight}
                    min={256}
                    max={2048}
                    step={64}
                    unit="px"
                    onChange={(v) => update({ gradientHeight: v })}
                  />
                )}
              </>
            )}
          </Section>

          <Section title="Pattern">
            <SelectControl
              label="Pattern"
              value={settings.pattern}
              options={PATTERN_OPTIONS}
              onChange={(v) =>
                update({ pattern: v as DitherSettings["pattern"] })
              }
            />
            <SelectControl
              label="Dither Mode"
              value={settings.ditherMode}
              options={[
                { value: "image", label: "Image" },
                { value: "linear", label: "Linear" },
                { value: "radial", label: "Radial" },
              ]}
              onChange={(v) =>
                update({ ditherMode: v as DitherSettings["ditherMode"] })
              }
            />
            <SelectControl
              label="Dither Style"
              value={settings.ditherStyle}
              options={[
                { value: "threshold", label: "Threshold" },
                { value: "scaled", label: "Scaled" },
              ]}
              onChange={(v) =>
                update({ ditherStyle: v as DitherSettings["ditherStyle"] })
              }
            />
            <SelectControl
              label="Shape"
              value={settings.shapeType}
              options={[
                { value: "circle", label: "Circle" },
                { value: "square", label: "Square" },
                { value: "diamond", label: "Diamond" },
              ]}
              onChange={(v) =>
                update({ shapeType: v as DitherSettings["shapeType"] })
              }
            />
          </Section>

          <Section title="Parameters">
            <SliderControl
              label="Cell Size"
              value={settings.cellSize}
              min={2}
              max={32}
              step={1}
              unit="px"
              onChange={(v) => update({ cellSize: v })}
            />
            {settings.ditherMode === "linear" && (
              <SliderControl
                label="Angle"
                value={settings.angle}
                min={0}
                max={360}
                step={1}
                unit="°"
                onChange={(v) => update({ angle: v })}
              />
            )}
            {settings.ditherMode === "radial" && (
              <>
                <SliderControl
                  label="Scale"
                  value={settings.scale}
                  min={10}
                  max={200}
                  step={1}
                  unit="%"
                  onChange={(v) => update({ scale: v })}
                />
                <SliderControl
                  label="Offset X"
                  value={settings.offsetX}
                  min={-100}
                  max={100}
                  step={1}
                  onChange={(v) => update({ offsetX: v })}
                />
                <SliderControl
                  label="Offset Y"
                  value={settings.offsetY}
                  min={-100}
                  max={100}
                  step={1}
                  onChange={(v) => update({ offsetY: v })}
                />
              </>
            )}
          </Section>

          <Section title="Palette">
            <PaletteEditor
              colors={settings.colors}
              onChange={(colors) => update({ colors })}
              presets={PALETTE_PRESETS}
              onRandomize={randomizeColors}
            />
          </Section>
        </div>
      </Sidebar>
      <CanvasArea onDragOver={handleDragOver} onDrop={handleDrop}>
        <canvas
          ref={canvasRef}
          style={{ maxWidth: "100%", maxHeight: "100%" }}
        />
      </CanvasArea>
    </>
  )
}
