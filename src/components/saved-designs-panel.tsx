import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Bookmark } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ToolIcon } from '@/components/icons'
import { tools } from '@/tools/registry'
import {
  getSavedDesigns,
  deleteDesign,
  renameDesign,
  type SavedDesign,
} from '@/lib/saved-designs'
import { setSourceImage } from '@/lib/source-image'

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function DesignName({ design, onRename }: { design: SavedDesign; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  if (editing) {
    return (
      <input
        ref={inputRef}
        defaultValue={design.name}
        aria-label="Rename design"
        className="w-full bg-transparent text-xs text-text-primary outline-none"
        onBlur={(e) => {
          const val = e.target.value.trim()
          if (val && val !== design.name) onRename(val)
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setEditing(false)
        }}
        autoFocus
      />
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
      className="truncate text-left text-xs text-text-primary hover:text-white"
    >
      {design.name}
    </button>
  )
}

interface SavedDesignsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SavedDesignsPanel({ open, onOpenChange }: SavedDesignsPanelProps) {
  const [designs, setDesigns] = useState<SavedDesign[]>([])
  const [filter, setFilter] = useState<string | null>(null)
  const navigate = useNavigate()

  const loadDesigns = () => {
    getSavedDesigns().then(setDesigns)
  }

  useEffect(() => {
    if (open) loadDesigns()
  }, [open])

  // Refresh when a new design is saved
  useEffect(() => {
    const handler = () => {
      if (open) loadDesigns()
    }
    window.addEventListener('studio:designs-changed', handler)
    return () => window.removeEventListener('studio:designs-changed', handler)
  }, [open])

  const filtered = filter ? designs.filter((d) => d.toolId === filter) : designs

  // Get unique tool IDs that have saved designs
  const toolIds = [...new Set(designs.map((d) => d.toolId))]

  const handleLoad = (design: SavedDesign) => {
    localStorage.setItem(`studio:${design.toolId}`, JSON.stringify(design.settings))
    setSourceImage(design.toolId, design.sourceImage ?? null)
    window.dispatchEvent(
      new CustomEvent('studio:settings-loaded', { detail: { key: `studio:${design.toolId}` } }),
    )
    navigate(`/${design.toolId}`)
    onOpenChange(false)
  }

  const handleDelete = async (id: string) => {
    await deleteDesign(id)
    setDesigns((prev) => prev.filter((d) => d.id !== id))
  }

  const handleRename = async (id: string, name: string) => {
    await renameDesign(id, name)
    setDesigns((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="bg-sidebar p-0">
        <SheetHeader className="border-b border-border-control px-4 py-3">
          <SheetTitle className="text-sm text-text-primary">Saved Designs</SheetTitle>
        </SheetHeader>

        {/* Filter pills */}
        {toolIds.length > 1 && (
          <div className="scrollbar-thin flex gap-1.5 overflow-x-auto border-b border-border-control px-4 py-2">
            <button
              type="button"
              onClick={() => setFilter(null)}
              className={`shrink-0 rounded-md px-2 py-1 text-[11px] ${
                filter === null
                  ? 'bg-white/10 text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              All
            </button>
            {toolIds.map((id) => {
              const tool = tools.find((t) => t.id === id)
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => setFilter(filter === id ? null : id)}
                  className={`shrink-0 rounded-md px-2 py-1 text-[11px] ${
                    filter === id
                      ? 'bg-white/10 text-text-primary'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {tool?.name ?? id}
                </button>
              )
            })}
          </div>
        )}

        {/* Grid */}
        <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Bookmark className="size-5 text-text-muted" />
              <span className="text-xs text-text-muted">
                {designs.length === 0
                  ? 'No saved designs yet.'
                  : 'No designs for this filter.'}
              </span>
              {designs.length === 0 && (
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded-md bg-white/10 px-3 py-1.5 text-xs text-text-primary hover:bg-white/15"
                >
                  Press S to save current design
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filtered.map((design) => {
                const tool = tools.find((t) => t.id === design.toolId)
                return (
                  <div
                    key={design.id}
                    className="group cursor-pointer"
                    onClick={() => handleLoad(design)}
                  >
                    {/* Thumbnail */}
                    <div className="relative overflow-hidden rounded-md border border-border-control group-hover:border-border-hover">
                      <img
                        src={design.thumbnail}
                        alt={design.name}
                        className="aspect-square w-full object-cover"
                        draggable={false}
                      />
                      <button
                        type="button"
                        aria-label="Delete design"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(design.id)
                        }}
                        className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-md bg-black/60 text-text-muted opacity-0 transition-opacity duration-150 hover:text-text-primary group-hover:opacity-100"
                      >
                        <X className="size-4 shrink-0" />
                      </button>
                    </div>
                    {/* Info */}
                    <div className="mt-1.5">
                      <div className="flex items-center gap-1">
                        <ToolIcon tool={design.toolId} className="size-4 shrink-0" />
                        <DesignName
                          design={design}
                          onRename={(name) => handleRename(design.id, name)}
                        />
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {tool?.name ?? design.toolId} &middot; {timeAgo(design.createdAt)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
