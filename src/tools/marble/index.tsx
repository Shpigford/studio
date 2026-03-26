import { useEffect, useRef } from "react"
import { useSettings } from "@/hooks/use-settings"
import { CanvasArea } from "@/components/canvas-area"
import { Sidebar } from "@/components/sidebar"
import { Section } from "@/components/controls/section"
import { SliderControl } from "@/components/controls/slider-control"
import { SwitchControl } from "@/components/controls/switch-control"
import { ColorControl } from "@/components/controls/color-control"
import { ButtonRow } from "@/components/controls/button-row"
import { Button } from "@/components/ui/button"
import { useShortcutActions } from "@/hooks/use-shortcut-actions"
import { Kbd } from "@/components/ui/kbd"
import { exportPNG, generateFilename } from "@/lib/export"
import { CanvasSizeControl } from "@/components/controls/canvas-size-control"
import type { CanvasPreset } from "@/lib/canvas-size"
import { resolveCanvasSize } from "@/lib/canvas-size"
import type { MarbleSettings } from "./types"
import { DEFAULTS, randomizeColors } from "./types"
import { createMarbleEngine } from "./engine"
import type { MarbleEngine } from "./engine"

export default function Marble() {
  const [settings, update, reset] = useSettings<MarbleSettings>("marble", DEFAULTS)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<MarbleEngine | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  // Init engine on mount
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const [w, h] = resolveCanvasSize(settings.canvasPreset, settings.customWidth, settings.customHeight)
    canvas.width = w
    canvas.height = h
    engineRef.current = createMarbleEngine(canvas, settingsRef)
    return () => {
      engineRef.current?.destroy()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Resize canvas when size settings change
  useEffect(() => {
    const [w, h] = resolveCanvasSize(settings.canvasPreset, settings.customWidth, settings.customHeight)
    if (engineRef.current) {
      engineRef.current.resize(w, h)
    }
  }, [settings.canvasPreset, settings.customWidth, settings.customHeight])

  function randomize() {
    update({
      ...randomizeColors(),
      noiseScale: 0.5 + Math.random() * 2.5,
      windSpeed: 0.01 + Math.random() * 0.49,
      warpPower: Math.random(),
      fbmStrength: 0.1 + Math.random() * 2.9,
      fbmDamping: 0.1 + Math.random() * 0.9,
      watercolorDetail: 1 + Math.random() * 29,
      watercolorWarp: Math.random() * 0.1,
      blurRadius: 0.1 + Math.random() * 2.9,
      veinIntensity: Math.random() > 0.5 ? Math.random() * 0.8 : 0,
      veinScale: 1 + Math.random() * 9,
      veinColor: randomizeColors().colorLow,
    })
  }

  function download() {
    const canvas = canvasRef.current
    if (canvas) exportPNG(canvas, generateFilename("marble", "png"))
  }

  useShortcutActions({ randomize, reset, download })

  return (
    <>
      <Sidebar
        footer={
          <ButtonRow>
            <Button variant="secondary" onClick={randomize}>
              Randomize <Kbd>R</Kbd>
            </Button>
            <Button variant="secondary" onClick={reset}>
              Reset <Kbd>⌫</Kbd>
            </Button>
            <Button variant="primary" className="w-full" onClick={download}>
              Export PNG <Kbd>⌘S</Kbd>
            </Button>
          </ButtonRow>
        }
      >
        <h2 className="mb-3 text-base font-medium text-text-primary">Marble</h2>
        <div className="flex flex-col gap-4">
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

          <Section title="Colors" defaultOpen>
            <ColorControl
              label="Main"
              value={settings.colorMain}
              onChange={(v) => update({ colorMain: v })}
            />
            <ColorControl
              label="Low"
              value={settings.colorLow}
              onChange={(v) => update({ colorLow: v })}
            />
            <ColorControl
              label="Mid"
              value={settings.colorMid}
              onChange={(v) => update({ colorMid: v })}
            />
            <ColorControl
              label="High"
              value={settings.colorHigh}
              onChange={(v) => update({ colorHigh: v })}
            />
          </Section>

          <Section title="Fluid">
            <SliderControl
              label="Noise Scale"
              value={settings.noiseScale}
              min={0.5}
              max={3}
              step={0.05}
              onChange={(v) => update({ noiseScale: v })}
            />
            <SliderControl
              label="Wind Speed"
              value={settings.windSpeed}
              min={0.01}
              max={0.5}
              step={0.01}
              onChange={(v) => update({ windSpeed: v })}
            />
            <SliderControl
              label="Warp"
              value={settings.warpPower}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => update({ warpPower: v })}
            />
          </Section>

          <Section title="FBM">
            <SliderControl
              label="Strength"
              value={settings.fbmStrength}
              min={0.1}
              max={3}
              step={0.05}
              onChange={(v) => update({ fbmStrength: v })}
            />
            <SliderControl
              label="Damping"
              value={settings.fbmDamping}
              min={0.1}
              max={1}
              step={0.01}
              onChange={(v) => update({ fbmDamping: v })}
            />
          </Section>

          <Section title="Watercolor">
            <SliderControl
              label="Detail"
              value={settings.watercolorDetail}
              min={1}
              max={30}
              step={0.5}
              onChange={(v) => update({ watercolorDetail: v })}
            />
            <SliderControl
              label="Warp"
              value={settings.watercolorWarp}
              min={0}
              max={0.1}
              step={0.001}
              decimals={3}
              onChange={(v) => update({ watercolorWarp: v })}
            />
            <SliderControl
              label="Blur"
              value={settings.blurRadius}
              min={0.1}
              max={3}
              step={0.05}
              onChange={(v) => update({ blurRadius: v })}
            />
          </Section>

          <Section title="Veins">
            <SliderControl
              label="Intensity"
              value={settings.veinIntensity}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => update({ veinIntensity: v })}
            />
            {settings.veinIntensity > 0 && (
              <>
                <SliderControl
                  label="Scale"
                  value={settings.veinScale}
                  min={1}
                  max={10}
                  step={0.1}
                  onChange={(v) => update({ veinScale: v })}
                />
                <ColorControl
                  label="Color"
                  value={settings.veinColor}
                  onChange={(v) => update({ veinColor: v })}
                />
              </>
            )}
          </Section>

          <Section title="Texture">
            <SliderControl
              label="Grain"
              value={settings.grain}
              min={0}
              max={100}
              step={1}
              onChange={(v) => update({ grain: v })}
            />
          </Section>

          <Section title="Animation">
            <SwitchControl
              label="Animate"
              checked={settings.animated}
              onChange={(v) => update({ animated: v })}
            />
            {settings.animated && (
              <SliderControl
                label="Speed"
                value={settings.speed}
                min={0.1}
                max={3}
                step={0.05}
                onChange={(v) => update({ speed: v })}
              />
            )}
          </Section>
        </div>
      </Sidebar>
      <CanvasArea>
        <canvas
          ref={canvasRef}
          style={{ maxWidth: "100%", maxHeight: "100%" }}
        />
      </CanvasArea>
    </>
  )
}
