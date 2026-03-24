import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { tools } from "@/tools/registry"
import { ToolIcon } from "@/components/icons"
import { useFavicon } from "@/hooks/use-favicon"

/** Animated dot grid background */
function DotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animId: number
    const spacing = 28
    const baseRadius = 1.2
    const mouse = { x: -1000, y: -1000 }

    function resize() {
      const dpr = window.devicePixelRatio || 1
      canvas!.width = window.innerWidth * dpr
      canvas!.height = window.innerHeight * dpr
      canvas!.style.width = `${window.innerWidth}px`
      canvas!.style.height = `${window.innerHeight}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function draw() {
      ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight)

      const cols = Math.ceil(window.innerWidth / spacing) + 1
      const rows = Math.ceil(window.innerHeight / spacing) + 1

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * spacing
          const y = r * spacing
          const dx = mouse.x - x
          const dy = mouse.y - y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const influence = Math.max(0, 1 - dist / 150)
          const radius = baseRadius + influence * 2.5
          const alpha = 0.12 + influence * 0.5

          ctx!.beginPath()
          ctx!.arc(x, y, radius, 0, Math.PI * 2)
          ctx!.fillStyle = `rgba(255, 255, 255, ${alpha})`
          ctx!.fill()
        }
      }

      animId = requestAnimationFrame(draw)
    }

    function onMouseMove(e: MouseEvent) {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }

    resize()
    window.addEventListener("resize", resize)
    window.addEventListener("mousemove", onMouseMove)
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", onMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
    />
  )
}

export default function Home() {
  const navigate = useNavigate()
  useFavicon("home")

  useEffect(() => {
    document.title = "Studio — Generative Design Tools"
  }, [])

  return (
    <div
      className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-canvas"
    >
      <DotGrid />

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo / Title */}
        <div className="flex flex-col items-center">
          <h1 className="text-[2.5rem] font-semibold tracking-tight text-text-primary">
            Studio
          </h1>
          <p className="text-sm text-text-secondary">
            Generative design tools
          </p>
        </div>

        {/* Tool grid */}
        <div className="grid grid-cols-4 gap-4 px-6 lg:flex lg:gap-6 lg:px-0">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={(e) => {
                e.stopPropagation()
                localStorage.setItem("studio:last-tool", tool.id)
                navigate(`/${tool.id}`)
              }}
              className="group flex cursor-pointer flex-col items-center gap-2 rounded-lg p-2 transition-all duration-150 hover:bg-white/15 lg:gap-3 lg:p-3"
            >
              <div className="transition-transform duration-150 group-hover:scale-110">
                <ToolIcon tool={tool.id} className="h-10 w-10 lg:h-14 lg:w-14" />
              </div>
              <span className="text-[10px] text-text-muted group-hover:text-text-secondary lg:text-xs">
                {tool.name}
              </span>
            </button>
          ))}
        </div>      </div>
    </div>
  )
}
