import { useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { ToolSwitcher } from "@/components/tool-switcher"
import { useFavicon } from "@/hooks/use-favicon"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useMobile } from "@/hooks/use-mobile"
import { tools, pages } from "@/tools/registry"

export function AppShell() {
  const toolId = useLocation().pathname.slice(1)
  useFavicon(toolId)
  useKeyboardShortcuts()
  const isMobile = useMobile()

  useEffect(() => {
    const tool = [...tools, ...pages].find((t) => t.id === toolId)
    document.title = tool ? `${tool.name} - Studio` : "Studio"
  }, [toolId])

  return (
    <div className={`flex h-svh overflow-hidden ${isMobile ? 'flex-col' : ''}`}>
      <ToolSwitcher />
      <Outlet />
    </div>
  )
}
