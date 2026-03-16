import { useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { tools, pages } from "@/tools/registry"
import { ToolIcon } from "@/components/icons"
import { useMobile } from "@/hooks/use-mobile"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { Kbd } from "@/components/ui/kbd"

export function ToolSwitcher() {
  const isMobile = useMobile()
  const [open, setOpen] = useState(false)
  const currentToolId = useLocation().pathname.slice(1)
  const currentTool = [...tools, ...pages].find((t) => t.id === currentToolId) ?? tools[0]

  if (isMobile) {
    return (
      <>
        {/* Floating tool button */}
        <button
          onClick={() => setOpen(!open)}
          className="fixed top-3 left-3 z-40 flex h-9 w-9 items-center justify-center rounded-lg border border-border-control bg-sidebar"
          aria-label="Switch tool"
        >
          <ToolIcon tool={currentTool.id} className="h-6 w-6" />
        </button>

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
                        className={`rounded-lg p-0.5 transition-all duration-150 ${
                          isActive
                            ? "bg-white/10 ring-1 ring-white/20"
                            : "grayscale brightness-50"
                        }`}
                      >
                        <ToolIcon tool={tool.id} />
                      </div>
                      <span
                        className={`text-[8px] leading-none transition-colors duration-150 ${
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
      {tools.map((tool, index) => (
        <Tooltip key={tool.id}>
          <TooltipTrigger asChild>
            <NavLink
              to={`/${tool.id}`}
              onClick={() =>
                localStorage.setItem("studio:last-tool", tool.id)
              }
              className="relative flex flex-col items-center gap-1.5"
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`rounded-lg p-0.5 transition-all duration-150 ${
                      isActive
                        ? "bg-white/10 ring-1 ring-white/20"
                        : "grayscale brightness-50 hover:brightness-75 hover:grayscale-50"
                    }`}
                  >
                    <ToolIcon tool={tool.id} />
                  </div>
                  <span
                    className={`text-[9px] leading-none transition-colors duration-150 ${
                      isActive ? "text-white" : "text-text-muted"
                    }`}
                  >
                    {tool.name}
                  </span>
                </>
              )}
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-1.5">
            {tool.name} <Kbd>{index + 1}</Kbd>
          </TooltipContent>
        </Tooltip>
      ))}
      <div className="mt-auto" />
      {pages.map((page) => (
        <Tooltip key={page.id}>
          <TooltipTrigger asChild>
            <NavLink
              to={`/${page.id}`}
              className="relative flex flex-col items-center gap-1.5"
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`rounded-lg p-0.5 transition-all duration-150 ${
                      isActive
                        ? "bg-white/10 ring-1 ring-white/20"
                        : "grayscale brightness-50 hover:brightness-75 hover:grayscale-50"
                    }`}
                  >
                    <ToolIcon tool={page.id} />
                  </div>
                  <span
                    className={`text-[9px] leading-none transition-colors duration-150 ${
                      isActive ? "text-white" : "text-text-muted"
                    }`}
                  >
                    {page.name}
                  </span>
                </>
              )}
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right">
            {page.name}
          </TooltipContent>
        </Tooltip>
      ))}
    </nav>
  )
}
