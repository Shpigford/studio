// 9x9 dither pattern — diagonal gradient from dark (top-left) to light (bottom-right)
// Values 0-3: 0=darkest, 1=dark-mid, 2=light-mid, 3=lightest
const PATTERN = [
  [0, 0, 0, 0, 1, 0, 1, 1, 2],
  [0, 0, 0, 1, 0, 1, 1, 2, 1],
  [0, 0, 1, 0, 1, 1, 2, 1, 2],
  [0, 1, 0, 1, 1, 2, 1, 2, 2],
  [1, 0, 1, 1, 2, 1, 2, 2, 3],
  [0, 1, 1, 2, 1, 2, 2, 3, 2],
  [1, 1, 2, 1, 2, 2, 3, 2, 3],
  [1, 2, 1, 2, 2, 3, 2, 3, 3],
  [2, 1, 2, 2, 3, 2, 3, 3, 3],
]

interface DitherIconProps {
  className?: string
  palette: [string, string, string, string] // darkest to lightest
}

function DitherIcon({ className, palette }: DitherIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="30"
      height="30"
      viewBox="0 0 27 27"
      className={className}
      shapeRendering="crispEdges"
    >
      <defs>
        <clipPath id={`sq-${palette[0]}`}>
          <path d="M0 8C0 2.4 2.4 0 8 0h11c5.6 0 8 2.4 8 8v11c0 5.6-2.4 8-8 8H8c-5.6 0-8-2.4-8-8z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#sq-${palette[0]})`}>
        {PATTERN.flatMap((row, y) =>
          row.map((v, x) => (
            <rect
              key={`${x}-${y}`}
              x={x * 3}
              y={y * 3}
              width="3"
              height="3"
              fill={palette[v]}
            />
          ))
        )}
      </g>
    </svg>
  )
}

// Tool palettes: [darkest, dark-mid, light-mid, lightest]
const palettes = {
  topo:        ["#1a4028", "#2d6b42", "#5a9e6f", "#8fd4a4"],
  blocks:      ["#1a2740", "#2d4a7a", "#5a7db5", "#8fb4e0"],
  organic:     ["#402a1a", "#7a4a2d", "#b57a4a", "#e0ac7a"],
  dither:      ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
  gradients:   ["#2d1a40", "#5a2d7a", "#8b5ab5", "#bc8fe0"],
  plotter:     ["#1a1a33", "#2d2d66", "#5a5a99", "#8b8bcc"],
  ascii:       ["#1a2e1a", "#2d5a1a", "#5a8c2d", "#8bbd5a"],
  lines:       ["#1a3340", "#2d5c6b", "#5a8f9e", "#8fc2d1"],
  about:       ["#262626", "#404040", "#666666", "#8c8c8c"],
} as const

type ToolId = keyof typeof palettes

export function ToolIcon({ tool, className }: { tool: string; className?: string }) {
  const palette = palettes[tool as ToolId] ?? palettes.dither
  return <DitherIcon className={className} palette={palette as [string, string, string, string]} />
}
