import { useEffect, useRef } from 'react'
import { shortcutActions } from '@/lib/shortcut-actions'

interface Actions {
  randomize?: () => void
  reset?: () => void
  download?: () => void
}

export function useShortcutActions(actions: Actions) {
  const ref = useRef(actions)
  ref.current = actions

  useEffect(() => {
    shortcutActions.randomize = () => ref.current.randomize?.()
    shortcutActions.reset = () => ref.current.reset?.()
    shortcutActions.download = () => ref.current.download?.()
    return () => {
      shortcutActions.randomize = null
      shortcutActions.reset = null
      shortcutActions.download = null
    }
  }, [])
}
