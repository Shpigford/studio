import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { tools } from '@/tools/registry'
import { shortcutActions } from '@/lib/shortcut-actions'

export function useKeyboardShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const tag = target.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable

      // Cmd/Ctrl+S always fires (never want browser save)
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        shortcutActions.download?.()
        return
      }

      // Suppress other shortcuts when typing in inputs
      if (isInput) return

      // Tool switching: 1-8
      const num = parseInt(e.key)
      if (num >= 1 && num <= 8 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tool = tools[num - 1]
        if (tool) {
          localStorage.setItem('studio:last-tool', tool.id)
          navigate(`/${tool.id}`)
        }
        return
      }

      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        shortcutActions.copyLink?.()
        return
      }

      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        shortcutActions.randomize?.()
        return
      }

      if (e.key === 'Backspace' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        shortcutActions.reset?.()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])
}
