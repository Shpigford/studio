# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Unified Design Studio — a single web app consolidating 9 standalone generative art/design tools into one cohesive experience. Tools share UI components, theming, and utilities but each has its own canvas renderer and settings.

Detailed specs live in `docs/PLAN.md`. Treat it as the source of truth for architecture decisions, tool specs, and implementation phases.

## Stack

- **Vite + React 19 + TypeScript** (strict mode)
- **Tailwind CSS v4 + shadcn/ui** for UI controls
- **react-router-dom v7** for path-based routing (`/blocks`, `/topo`, etc.)
- **p5.js** (instance mode) for 7 tools, **Three.js** for metalshader, **Canvas 2D** for dither
- **mp4-muxer** for video export, **react-colorful** for color pickers
- **vitest** for utility tests

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # Lint
npx tsc -b         # Type check (uses project references; `tsc --noEmit` checks nothing)
npx vitest run     # Run all tests
npx vitest run src/lib/color.test.ts  # Single test file
```

## Architecture

### Layout: Three-column shell
- **ToolSwitcher** (48px left rail) — vertical icon nav, stores last-used tool in localStorage
- **Canvas Area** (flex: 1 center) — mounts p5/Three.js/Canvas2D per tool
- **Sidebar** (280px right) — scrollable controls with pinned footer for action buttons, varies per tool

### Routing & Loading
- Each tool is a lazy-loaded route (`/topo`, `/blocks`, etc.)
- `/` redirects to last-used tool from localStorage
- Tool registry in `src/tools/registry.ts` maps tool IDs to lazy components

### Tool Structure
Each tool lives in `src/tools/<name>/` with:
- `index.tsx` — React component (sidebar controls + canvas mount)
- `sketch.ts` (or `engine.ts`, `renderer.ts`) — rendering logic
- `types.ts` — settings type (must use `type`, not `interface` — interfaces don't satisfy `useSettings`'s `Record<string, unknown>` constraint)

### Core Hooks
- **`useSettings(key, defaults)`** — localStorage persistence with 200ms debounced writes, merges with defaults on load
- **`useP5(containerRef, sketchFn, settings, options)`** — p5.js instance lifecycle, settingsRef stays in sync, calls `redraw()` unless `animated: true`
- **`useThree(containerRef, setupFn, settings)`** — Three.js renderer/scene/camera setup with resize observer (metalshader only)

### Shared Utilities (`src/lib/`)
- `color.ts` — hex/rgb conversion, lerp, gradient sampling
- `math.ts` — seeded random, mapRange, constrain
- `texture.ts` — grain and canvas texture overlays
- `export.ts` — PNG/SVG/MP4 export helpers

### Shared Controls (`src/components/controls/`)
Reusable control components: `slider-control`, `select-control`, `color-control`, `switch-control`, `section` (collapsible), `gradient-editor`, `palette-editor`, `button-row`.

**Sidebar footer pattern:** Action buttons (Randomize/Reset/Download) must always be visible. Pass them as `<Sidebar footer={<ButtonRow>...</ButtonRow>}>`. Settings scroll above; buttons stay pinned at the bottom.

## Design Rules

Dark theme. `bg-canvas: #000`, `bg-sidebar: #0a0a0a`, `text-primary: #ededed`.

- No shadows, no gradients on UI, no cards — hierarchy through font size and color only
- All borders: `1px solid`, `border-radius: 6px`
- All transitions: `150ms`
- Slider: 2px track `#333`, 14px white circular thumb
- Scrollbar: 4px wide, `#333` thumb, transparent track
- Numeric values: `tabular-nums`, mono font

## p5.js Instance Mode

All p5 tools use instance mode. Every p5 global must be prefixed with `p.` (e.g., `p.background()`, `p.createCanvas()`, `p.PI`). Do NOT use global mode. DOM helpers (`createDiv`, `createSlider`, etc.) are replaced by React — never use them.

**Ambiguous names:** Use `p.random()` for p5 random, `Math.random()` for JS random. Use `p.map()` for p5 mapping, `Array.prototype.map()` for array mapping. Prefer `Math.*` for non-p5 math.

**p5.js v2 gotchas:**
- `curveVertex()` was renamed to `splineVertex()`
- Type defs are incomplete — cast `p.drawingContext` to `CanvasRenderingContext2D`, access `p.canvas` via `(p as any).canvas`
- Constructor is async (uses `requestAnimationFrame`) — `useP5` handles StrictMode cleanup via `hitCriticalError`
- When using canvas 2D API directly (e.g. `getImageData`), multiply dimensions by `p.pixelDensity()`
- Cache expensive computations (elevation fields, contour extraction) and only recompute when the inputs that affect them change — visual-only settings should skip recomputation

## Testing

- TypeScript strict mode is the primary safety net
- vitest for `src/lib/` utilities only (~20-30 tests)
- No UI or E2E tests — visual tools are verified by inspection
- Per-tool verification checklist is in `docs/PLAN.md`

## Source Tools

Original implementations live in `~/Development/art/` (8 tools) and `~/Development/dither/` (1 tool). Reference these when porting. The 9 tools are: topo, blocks, organic, dither, gradients, plotter, metalshader, ascii, lines.
