import { useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { ToolSwitcher } from "@/components/tool-switcher"
import { useFavicon } from "@/hooks/use-favicon"
import { tools } from "@/tools/registry"

export function AppShell() {
  const toolId = useLocation().pathname.slice(1)
  useFavicon(toolId)

  useEffect(() => {
    const tool = tools.find((t) => t.id === toolId)
    document.title = tool ? `${tool.name} - Studio` : "Studio"
  }, [toolId])

  return (
    <div className="flex h-screen overflow-hidden">
      <ToolSwitcher />
      <Outlet />
    </div>
  )
}
