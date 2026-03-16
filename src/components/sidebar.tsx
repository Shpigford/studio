import React, { useRef, useCallback, useEffect, useState } from 'react'
import { useMobile } from '@/hooks/use-mobile'

interface SidebarProps {
  children: React.ReactNode
  footer?: React.ReactNode
}

function SidebarInner({ children, footer }: SidebarProps) {
  return (
    <>
      <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
        {children}
      </div>
      {footer && (
        <div className="shrink-0 border-t border-border-control p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      )}
    </>
  )
}

function MobileDrawer({ children, footer }: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)
  const [, forceRender] = useState(0)

  // Set initial height on mount
  useEffect(() => {
    const sidebar = sidebarRef.current
    if (sidebar && !sidebar.style.height) {
      sidebar.style.height = '50vh'
    }
  }, [])

  const onStart = useCallback((clientY: number) => {
    const sidebar = sidebarRef.current
    if (!sidebar) return
    dragging.current = true
    startY.current = clientY
    startHeight.current = sidebar.offsetHeight
    sidebar.style.transition = 'none'
    document.body.style.userSelect = 'none'
  }, [])

  const onMove = useCallback((clientY: number) => {
    if (!dragging.current) return
    const sidebar = sidebarRef.current
    if (!sidebar) return
    const delta = startY.current - clientY
    const vh = window.innerHeight
    const newHeight = Math.min(Math.max(startHeight.current + delta, 80), vh * 0.85)
    sidebar.style.height = newHeight + 'px'
  }, [])

  const onEnd = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    const sidebar = sidebarRef.current
    if (sidebar) sidebar.style.transition = ''
    document.body.style.userSelect = ''
    forceRender((v) => v + 1)
  }, [])

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (dragging.current) onMove(e.touches[0].clientY)
    }
    const handleMouseMove = (e: MouseEvent) => onMove(e.clientY)
    const handleEnd = () => onEnd()

    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchend', handleEnd)
    window.addEventListener('mouseup', handleEnd)
    return () => {
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchend', handleEnd)
      window.removeEventListener('mouseup', handleEnd)
    }
  }, [onMove, onEnd])

  return (
    <aside
      ref={sidebarRef}
      className="order-2 flex w-full shrink-0 flex-col border-t border-border-control bg-sidebar md:order-none"
      style={{ minHeight: 80, maxHeight: '85vh' }}
    >
      {/* Drag handle */}
      <div
        className="flex cursor-grab touch-none items-center justify-center py-2.5 active:cursor-grabbing [&:active_.drag-bar]:bg-[#666]"
        onTouchStart={(e) => onStart(e.touches[0].clientY)}
        onMouseDown={(e) => onStart(e.clientY)}
      >
        <div className="drag-bar h-1 w-9 rounded-full bg-[#444] transition-colors" />
      </div>
      <SidebarInner footer={footer}>{children}</SidebarInner>
    </aside>
  )
}

export function Sidebar({ children, footer }: SidebarProps) {
  const isMobile = useMobile()

  if (!isMobile) {
    return (
      <aside className="flex w-sidebar shrink-0 flex-col border-r border-border-control bg-sidebar">
        <SidebarInner footer={footer}>{children}</SidebarInner>
      </aside>
    )
  }

  return <MobileDrawer footer={footer}>{children}</MobileDrawer>
}
