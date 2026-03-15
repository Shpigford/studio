interface SidebarProps {
  children: React.ReactNode
}

export function Sidebar({ children }: SidebarProps) {
  return (
    <aside className="scrollbar-thin flex w-sidebar shrink-0 flex-col overflow-y-auto border-r border-border-control bg-sidebar p-4">
      {children}
    </aside>
  )
}
