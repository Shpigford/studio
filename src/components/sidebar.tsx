import React from 'react'

interface SidebarProps {
  children: React.ReactNode
  footer?: React.ReactNode
}

export function Sidebar({ children, footer }: SidebarProps) {
  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-border-control bg-sidebar">
      <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
        {children}
      </div>
      {footer && (
        <div className="shrink-0 border-t border-border-control p-4">
          {footer}
        </div>
      )}
    </aside>
  )
}
