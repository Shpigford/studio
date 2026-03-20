type SourceImageState = {
  toolId: string
  dataUrl: string
}

let state: SourceImageState | null = null

export function setSourceImage(toolId: string, dataUrl: string | null) {
  state = dataUrl ? { toolId, dataUrl } : null
}

export function getSourceImage(toolId: string): string | null {
  return state?.toolId === toolId ? state.dataUrl : null
}
