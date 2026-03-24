import { useState, useEffect, useRef } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { Bookmark } from "lucide-react"
import { tools, pages } from "@/tools/registry"
import { ToolIcon } from "@/components/icons"
import { useMobile } from "@/hooks/use-mobile"
import { SavedDesignsPanel } from "@/components/saved-designs-panel"

export function ToolSwitcher() {
  const isMobile = useMobile()
  const [open, setOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [bounce, setBounce] = useState(false)
  const savedBtnRef = useRef<HTMLButtonElement>(null)
  const currentToolId = useLocation().pathname.slice(1)
  const currentTool = [...tools, ...pages].find((t) => t.id === currentToolId) ?? tools[0]

  // Animate bookmark icon when a design is saved
  useEffect(() => {
    const handler = () => {
      setBounce(true)
      setTimeout(() => setBounce(false), 600)
    }
    window.addEventListener('studio:designs-changed', handler)
    return () => window.removeEventListener('studio:designs-changed', handler)
  }, [])

  if (isMobile) {
    return (
      <>
        {/* Floating tool button */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="fixed top-3 left-3 z-40 flex h-9 w-9 items-center justify-center rounded-lg border border-border-control bg-sidebar"
          aria-label="Switch tool"
        >
          <ToolIcon tool={currentTool.id} className="h-6 w-6" />
        </button>

        {/* Floating saved button */}
        <button
          type="button"
          onClick={() => setSavedOpen(true)}
          className={`fixed top-3 left-14 z-40 flex h-9 w-9 items-center justify-center rounded-lg border border-border-control bg-sidebar ${
            bounce ? "text-yellow-400 scale-150" : "text-text-muted"
          }`}
          style={bounce ? { transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)' } : undefined}
          aria-label="Saved designs"
        >
          <Bookmark className="size-4 shrink-0" fill={bounce ? 'currentColor' : 'none'} />
        </button>
        <SavedDesignsPanel open={savedOpen} onOpenChange={setSavedOpen} />

        {/* Tool picker overlay */}
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="fixed top-14 left-3 z-50 grid grid-cols-4 gap-2 rounded-lg border border-border-control bg-sidebar p-2">
              {[...tools, ...pages].map((tool) => (
                <NavLink
                  key={tool.id}
                  to={`/${tool.id}`}
                  onClick={() => {
                    if (tools.some((t) => t.id === tool.id)) {
                      localStorage.setItem("studio:last-tool", tool.id)
                    }
                    setOpen(false)
                  }}
                  className="flex flex-col items-center gap-0.5 rounded-md p-1.5"
                >
                  {({ isActive }) => (
                    <>
                      <div
                        className={`rounded-lg p-0.5 transition-[transform,opacity] duration-150 ${
                          isActive
                            ? "bg-white/10 ring-1 ring-white/20"
                            : "grayscale brightness-50"
                        }`}
                      >
                        <ToolIcon tool={tool.id} />
                      </div>
                      <span
                        className={`text-[8px] leading-none ${
                          isActive ? "text-white" : "text-text-muted"
                        }`}
                      >
                        {tool.name}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </>
        )}
      </>
    )
  }

  return (
    <nav className="scrollbar-thin flex w-toolbar shrink-0 flex-col items-center gap-3 overflow-y-auto border-r border-border-control bg-sidebar py-3">
      {tools.map((tool) => (
        <NavLink
          key={tool.id}
          to={`/${tool.id}`}
          onClick={() =>
            localStorage.setItem("studio:last-tool", tool.id)
          }
          className="relative flex flex-col items-center gap-1.5"
        >
          {({ isActive }) => (
            <>
              <div
                className={`rounded-lg p-0.5 transition-[transform,opacity] duration-150 ${
                  isActive
                    ? "bg-white/10 ring-1 ring-white/20"
                    : "grayscale brightness-50 hover:brightness-75 hover:grayscale-50"
                }`}
              >
                <ToolIcon tool={tool.id} />
              </div>
              <span
                className={`text-[9px] leading-none ${
                  isActive ? "text-white" : "text-text-muted"
                }`}
              >
                {tool.name}
              </span>
            </>
          )}
        </NavLink>
      ))}
      <div className="mt-auto" />
      <button
        type="button"
        ref={savedBtnRef}
        onClick={() => setSavedOpen(true)}
        className="flex flex-col items-center gap-1.5"
        aria-label="Saved designs"
      >
        <div
          className={`rounded-lg p-1 transition-[transform,opacity] duration-150 ${
            bounce ? "text-yellow-400 scale-150" : "text-text-muted hover:text-text-secondary"
          }`}
          style={bounce ? { transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)' } : undefined}
        >
          <Bookmark className="h-5 w-5" fill={bounce ? 'currentColor' : 'none'} />
        </div>
        <span className={`text-[9px] leading-none ${bounce ? "text-yellow-400" : "text-text-muted"}`}>Saved</span>
      </button>
      {pages.map((page) => (
        <NavLink
          key={page.id}
          to={`/${page.id}`}
          className="relative flex flex-col items-center gap-1.5"
        >
          {({ isActive }) => (
            <>
              <div
                className={`rounded-lg p-0.5 transition-[transform,opacity] duration-150 ${
                  isActive
                    ? "bg-white/10 ring-1 ring-white/20"
                    : "grayscale brightness-50 hover:brightness-75 hover:grayscale-50"
                }`}
              >
                <ToolIcon tool={page.id} />
              </div>
              <span
                className={`text-[9px] leading-none ${
                  isActive ? "text-white" : "text-text-muted"
                }`}
              >
                {page.name}
              </span>
            </>
          )}
        </NavLink>
      ))}
      <SavedDesignsPanel open={savedOpen} onOpenChange={setSavedOpen} />
    </nav>
  )
}
