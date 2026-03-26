import { lazy } from "react"
import type { ToolDefinition } from "@/types/tools"

export const tools: ToolDefinition[] = [
  {
    id: "ascii",
    name: "ASCII",
    icon: "ascii",
    component: lazy(() => import("@/tools/ascii")),
  },
  {
    id: "blocks",
    name: "Blocks",
    icon: "blocks",
    component: lazy(() => import("@/tools/blocks")),
  },
  {
    id: "dither",
    name: "Dither",
    icon: "dither",
    component: lazy(() => import("@/tools/dither")),
  },
  {
    id: "gradients",
    name: "Gradients",
    icon: "gradients",
    component: lazy(() => import("@/tools/gradients")),
  },
  {
    id: "marble",
    name: "Marble",
    icon: "marble",
    component: lazy(() => import("@/tools/marble")),
  },
  {
    id: "lines",
    name: "Lines",
    icon: "lines",
    component: lazy(() => import("@/tools/lines")),
  },
  {
    id: "organic",
    name: "Organic",
    icon: "organic",
    component: lazy(() => import("@/tools/organic")),
  },
  {
    id: "plotter",
    name: "Plotter",
    icon: "plotter",
    component: lazy(() => import("@/tools/plotter")),
  },
  {
    id: "topo",
    name: "Topo",
    icon: "topo",
    component: lazy(() => import("@/tools/topo")),
  },
]

export const pages: ToolDefinition[] = [
  {
    id: "about",
    name: "About",
    icon: "about",
    component: lazy(() => import("@/tools/about")),
  },
]
