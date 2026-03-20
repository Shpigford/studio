import { tools } from '@/tools/registry'
import { getSourceImage } from '@/lib/source-image'

export type SavedDesign = {
  id: string
  toolId: string
  name: string
  settings: Record<string, unknown>
  thumbnail: string
  sourceImage?: string  // data URL of uploaded source image (ASCII, Dither)
  createdAt: number
}

const DB_NAME = 'studio-saved-designs'
const STORE_NAME = 'designs'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const store = db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
        const req = fn(store)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export async function getSavedDesigns(): Promise<SavedDesign[]> {
  const all = await tx<SavedDesign[]>('readonly', (s) => s.getAll())
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

function generateThumbnail(canvas: HTMLCanvasElement): string {
  const size = 120
  const offscreen = document.createElement('canvas')
  offscreen.width = size
  offscreen.height = size
  const ctx = offscreen.getContext('2d')!
  ctx.drawImage(canvas, 0, 0, size, size)
  return offscreen.toDataURL('image/jpeg', 0.6)
}

export async function saveDesign(
  toolId: string,
  settings: Record<string, unknown>,
  canvas: HTMLCanvasElement,
): Promise<SavedDesign | null> {
  const all = await getSavedDesigns()
  const sourceImage = getSourceImage(toolId)

  // Source image is part of the design identity for image-based tools.
  const settingsJSON = JSON.stringify(settings)
  const duplicate = all.find(
    (d) =>
      d.toolId === toolId &&
      JSON.stringify(d.settings) === settingsJSON &&
      (d.sourceImage ?? null) === sourceImage,
  )
  if (duplicate) return null

  const count = all.filter((d) => d.toolId === toolId).length
  const toolName = tools.find((t) => t.id === toolId)?.name ?? toolId

  const design: SavedDesign = {
    id: crypto.randomUUID(),
    toolId,
    name: `${toolName} #${count + 1}`,
    settings: { ...settings },
    thumbnail: generateThumbnail(canvas),
    ...(sourceImage ? { sourceImage } : {}),
    createdAt: Date.now(),
  }

  await tx('readwrite', (s) => s.put(design))
  return design
}

export async function deleteDesign(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id))
}

export async function renameDesign(id: string, name: string): Promise<void> {
  const design = await tx<SavedDesign>('readonly', (s) => s.get(id))
  if (!design) return
  design.name = name
  await tx('readwrite', (s) => s.put(design))
}
