import { CanvasArea } from "@/components/canvas-area"
import { Sidebar } from "@/components/sidebar"

export default function Blocks() {
  return (
    <>
      <Sidebar>
        <h2 className="text-sm font-medium text-text-primary">Blocks</h2>
        <p className="mt-2 text-xs text-text-muted">Controls coming soon</p>
      </Sidebar>
      <CanvasArea />
    </>
  )
}
