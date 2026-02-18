import { useCallback, useRef } from 'react'
import type { RefObject, MouseEvent } from 'react'

export function useCursorGlow<T extends HTMLElement = HTMLDivElement>(): {
  ref: RefObject<T | null>
  onMouseMove: (e: MouseEvent) => void
} {
  const ref = useRef<T | null>(null)

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    ref.current.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
    ref.current.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
  }, [])

  return { ref, onMouseMove }
}
