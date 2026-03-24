import React, { useRef, useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMobile } from '@/hooks/use-mobile'
import { shortcutActions } from '@/lib/shortcut-actions'
import { saveDesign } from '@/lib/saved-designs'
import { copyImageToClipboard, nativeShare, canNativeShare } from '@/lib/share'
import { Kbd } from '@/components/ui/kbd'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Image, Link, Share2 } from 'lucide-react'

interface SidebarProps {
  children: React.ReactNode
  footer?: React.ReactNode
}

function SaveDesignButton() {
  const [status, setStatus] = useState<'idle' | 'saved' | 'duplicate'>('idle')
  const toolId = useLocation().pathname.slice(1)

  useEffect(() => {
    shortcutActions.save = () => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
      if (!canvas || !toolId) return
      const settings = shortcutActions.getSettings?.()
      if (!settings) return
      saveDesign(toolId, settings, canvas).then((result) => {
        setStatus(result ? 'saved' : 'duplicate')
        setTimeout(() => setStatus('idle'), 1500)
        if (result) {
          window.dispatchEvent(new CustomEvent('studio:designs-changed'))
        }
      })
    }
    return () => {
      shortcutActions.save = null
    }
  }, [toolId])

  const label =
    status === 'saved' ? 'Saved!' : status === 'duplicate' ? 'Already saved' : null

  return (
    <button
      onClick={() => shortcutActions.save?.()}
      className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md text-xs text-text-muted transition-colors duration-150 hover:text-text-primary"
    >
      {label ?? <>Save Design <Kbd>S</Kbd></>}
    </button>
  )
}

function ShareButton() {
  const [status, setStatus] = useState<'idle' | 'copied-image' | 'copied-link' | 'shared' | 'failed'>('idle')
  const [open, setOpen] = useState(false)
  const toolId = useLocation().pathname.slice(1)

  useEffect(() => {
    function onLinkCopied() {
      setStatus('copied-link')
      setTimeout(() => setStatus('idle'), 1500)
    }
    window.addEventListener('studio:link-copied', onLinkCopied)
    return () => window.removeEventListener('studio:link-copied', onLinkCopied)
  }, [])

  useEffect(() => {
    shortcutActions.copyImage = () => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
      if (!canvas) return
      copyImageToClipboard(canvas).then((ok) => {
        setStatus(ok ? 'copied-image' : 'failed')
        setTimeout(() => setStatus('idle'), 1500)
      })
    }
    return () => { shortcutActions.copyImage = null }
  }, [])

  const handleCopyImage = () => {
    shortcutActions.copyImage?.()
    setTimeout(() => setOpen(false), 800)
  }

  const handleCopyLink = () => {
    shortcutActions.copyLink?.()
    setTimeout(() => setOpen(false), 800)
  }

  const handleNativeShare = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
    if (!canvas) return
    nativeShare(canvas, toolId || 'design').then((ok) => {
      if (ok) {
        setStatus('shared')
        setTimeout(() => setStatus('idle'), 1500)
      }
    })
    setOpen(false)
  }

  const itemClass = "flex h-7 w-full items-center gap-2 rounded px-2 text-xs text-text-muted transition-colors duration-150 hover:bg-white/5 hover:text-text-primary"

  const label =
    status === 'copied-image' ? 'Image Copied!' :
    status === 'copied-link' ? 'Link Copied!' :
    status === 'shared' ? 'Shared!' :
    status === 'failed' ? 'Failed' : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md text-xs text-text-muted transition-colors duration-150 hover:text-text-primary">
          {label ?? 'Share'}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-44 p-1">
        <button onClick={handleCopyImage} className={itemClass}>
          <Image className="h-3.5 w-3.5" /> Copy Image
        </button>
        <button onClick={handleCopyLink} className={itemClass}>
          <Link className="h-3.5 w-3.5" /> Copy Link <Kbd>C</Kbd>
        </button>
        {canNativeShare() && (
          <button onClick={handleNativeShare} className={itemClass}>
            <Share2 className="h-3.5 w-3.5" /> Share…
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}

function SidebarInner({ children, footer }: SidebarProps) {
  return (
    <>
      <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
        {children}
      </div>
      {footer && (
        <div className="shrink-0 border-t border-border-control p-4 pb-0">
          {footer}
        </div>
      )}
      <div className="shrink-0 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-1">
          <SaveDesignButton />
          <ShareButton />
        </div>
      </div>
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
