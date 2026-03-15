import { useEffect } from "react"

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

const palettes: Record<string, [string, string, string, string]> = {
  topo:        ["#1a4028", "#2d6b42", "#5a9e6f", "#8fd4a4"],
  blocks:      ["#1a2740", "#2d4a7a", "#5a7db5", "#8fb4e0"],
  organic:     ["#402a1a", "#7a4a2d", "#b57a4a", "#e0ac7a"],
  dither:      ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
  gradients:   ["#2d1a40", "#5a2d7a", "#8b5ab5", "#bc8fe0"],
  plotter:     ["#1a1a33", "#2d2d66", "#5a5a99", "#8b8bcc"],
  metalshader: ["#1a1a1a", "#444444", "#777777", "#aaaaaa"],
  ascii:       ["#1a2e1a", "#2d5a1a", "#5a8c2d", "#8bbd5a"],
  lines:       ["#1a3340", "#2d5c6b", "#5a8f9e", "#8fc2d1"],
}

function buildSvg(palette: [string, string, string, string]): string {
  const rects = PATTERN.flatMap((row, y) =>
    row.map((v, x) =>
      `<rect x="${x * 3}" y="${y * 3}" width="3" height="3" fill="${palette[v]}"/>`
    )
  ).join("")

  return `<svg xmlns="http://www.w3.org/2000/svg" width="27" height="27" viewBox="0 0 27 27" shape-rendering="crispEdges"><defs><clipPath id="c"><rect width="27" height="27" rx="5"/></clipPath></defs><g clip-path="url(#c)">${rects}</g></svg>`
}

export function useFavicon(toolId: string) {
  useEffect(() => {
    const palette = palettes[toolId]
    if (!palette) return

    const svg = buildSvg(palette)
    const url = `data:image/svg+xml,${encodeURIComponent(svg)}`

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement("link")
      link.rel = "icon"
      document.head.appendChild(link)
    }
    link.type = "image/svg+xml"
    link.href = url
  }, [toolId])
}
