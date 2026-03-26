# Studio

A unified design studio combining 9 generative art tools into a single web app.

**Live:** [studio.neato.fun](https://studio.neato.fun) — Made by [@Shpigford](https://x.com/Shpigford)

<img src="public/ui.png" alt="Studio UI — Plotter tool" width="100%" />

## Tools

<table>
  <tr>
    <td align="center"><img src="public/topo.png" width="180" /><br /><b>Topo</b></td>
    <td align="center"><img src="public/blocks.png" width="180" /><br /><b>Blocks</b></td>
    <td align="center"><img src="public/organic.jpg" width="180" /><br /><b>Organic</b></td>
    <td align="center"><img src="public/dither.png" width="180" /><br /><b>Dither</b></td>
  </tr>
  <tr>
    <td align="center"><img src="public/gradients.png" width="180" /><br /><b>Gradients</b></td>
    <td align="center"><img src="public/marble.png" width="180" /><br /><b>Marble</b></td>
    <td align="center"><img src="public/plotter.png" width="180" /><br /><b>Plotter</b></td>
    <td align="center"><img src="public/ascii.jpg" width="180" /><br /><b>ASCII</b></td>
  </tr>
  <tr>
    <td align="center"><img src="public/lines.png" width="180" /><br /><b>Lines</b></td>
  </tr>
</table>

### Topo
Topographic contour maps generated from Perlin noise elevation fields. Uses marching squares for contour extraction with spline-interpolated smoothing. Supports single color, elevation gradient, and palette-based coloring with 7 presets.

### Blocks
Abstract geometric compositions via recursive subdivision (mondrian), grid placement, horizontal stripes, or diagonal patterns. Includes a halftone post-processing effect with CMYK color separation and wobbled edges for an organic feel.

### Organic
Flowing line art from three path algorithms: Perlin noise flow fields, random walks with momentum, and harmonic wave synthesis. Uses direct Canvas 2D API in the rendering loop for performance. Supports 5 gradient modes and Hermite-smoothed color interpolation.

### Dither
Ordered dithering applied to gradients or uploaded images. Pure Canvas 2D (no p5.js). Implements Bayer matrix dithering (2x2, 4x4, 8x8) plus custom patterns (halftone, lines, crosses, dots, grid, scales). Exports to both SVG and PNG.

### Gradients
Animated liquid glass gradient surfaces rendered with WebGL shaders. Simplex noise generates height fields, surface normals drive lighting, and Fresnel reflectance adds specular highlights. Supports MP4 video recording via mp4-muxer.

### Marble
Marbled textures rendered with WebGL2 fragment shaders. Layered Perlin noise and FBM domain warping produce fluid, watercolor-like patterns. Features ridged-noise veins, watercolor displacement, adjustable grain, and optional animation. Pure GPU — no p5.js or Three.js.

### Plotter
Vector-art plots with 6 pattern types (dot grid, flow field, concentric rings, waves, hatching, geometric tessellations) and 5 brush styles (normal, stippled, multi-stroke, calligraphic, stamp). Paper texture overlays with fiber and scratch effects.

### ASCII
ASCII art from brightness/contour analysis of images or generated patterns. 6 character sets with a mixing mode to blend them. Supports mono, gradient, contour, and block color modes.

### Lines
Abstract linear compositions from 7 shape generators (horizontal/vertical lines, circles, dots, spiral, radial, Lissajous curves). Optional WebGL post-processing: blur, chromatic aberration, refraction, halftone, CRT scanlines, VHS distortion. Supports animation and MP4 export.

## Stack

- **Vite + React 19 + TypeScript** (strict mode)
- **Tailwind CSS v4 + shadcn/ui** for UI controls
- **p5.js v2** (instance mode) for 7 tools, **Canvas 2D** for Dither, **raw WebGL2** for Marble
- **WebGL/GLSL** shaders for Marble, Gradients, and Lines post-processing
- **mp4-muxer** for video export
- **react-colorful** for color pickers
- **react-router-dom v7** for path-based routing

## Local Development

**Prerequisites:** Node.js 18+

```bash
# Clone and install
git clone https://github.com/Shpigford/studio.git
cd studio
npm install

# Start dev server
npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173). Vite provides HMR — changes to tool code and styles reflect instantly.

```bash
# Type check (uses project references — tsc --noEmit won't work)
npx tsc -b

# Run tests (utility functions only)
npx vitest run

# Production build
npm run build

# Preview production build locally
npm run preview
```

### Project Structure

```
src/
├── components/       # Shared UI (shell, sidebar, controls)
│   └── controls/     # Reusable: slider, select, color, switch, section
├── hooks/            # useSettings, useP5, useFavicon, useMobile
├── lib/              # Utilities (color, math, texture, export)
└── tools/            # One directory per tool
    └── <name>/
        ├── index.tsx   # React component (sidebar controls + canvas mount)
        ├── sketch.ts   # Rendering logic (or engine.ts for Dither)
        └── types.ts    # Settings type definition
```

Each tool is a lazy-loaded route (`/topo`, `/blocks`, etc.) with its own canvas renderer and settings sidebar. Tools share UI components, theming, and utilities but are otherwise independent.

### Key Architecture

- **`useSettings(key, defaults)`** persists tool settings to localStorage with 200ms debounced writes and merges with defaults on load
- **`useP5(containerRef, sketchFn, settings)`** manages p5.js instance lifecycle, keeps a settingsRef in sync, and calls `redraw()` for static tools
- All p5 tools use **instance mode** — every p5 global is prefixed with `p.` (e.g., `p.background()`, `p.createCanvas()`)
- Hot rendering loops use direct Canvas 2D API (`ctx.beginPath/moveTo/lineTo/stroke`) instead of p5 methods for performance
- Expensive computations (elevation fields, contour extraction) are cached and only recomputed when relevant inputs change

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build (type check + Vite) |
| `npm run preview` | Preview production build |
| `npm run lint` | Lint |
| `npx tsc -b` | Type check |
| `npx vitest run` | Run utility tests |

## License

[MIT](LICENSE)
