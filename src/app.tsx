import { Suspense } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { AppShell } from "@/components/app-shell"
import { tools } from "@/tools/registry"

function getDefaultTool(): string {
  const stored = localStorage.getItem("studio:last-tool")
  if (stored && tools.some((t) => t.id === stored)) {
    return stored
  }
  return tools[0].id
}

function ToolLoading() {
  return (
    <>
      <div className="flex w-sidebar shrink-0 flex-col border-r border-border-control bg-sidebar" />
      <div className="flex flex-1 items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-text-muted border-t-transparent" />
          <span className="text-xs text-text-muted">Loading</span>
        </div>
      </div>
    </>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        {tools.map((tool) => (
          <Route
            key={tool.id}
            path={tool.id}
            element={
              <Suspense fallback={<ToolLoading />}>
                <tool.component />
              </Suspense>
            }
          />
        ))}
        <Route path="*" element={<Navigate to={`/${getDefaultTool()}`} replace />} />
      </Route>
    </Routes>
  )
}
