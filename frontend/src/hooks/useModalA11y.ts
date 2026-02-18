import { useEffect, useRef, useState, useCallback } from 'react'

const EXIT_DURATION = 150

/**
 * Custom hook for modal accessibility + exit animations.
 * - Traps focus within the modal when open
 * - Closes modal on Escape key press (with exit animation)
 * - Restores focus to the trigger element when closed
 * - Auto-focuses the first focusable element when opened
 * - Returns `closing` flag and `requestClose` for animated exit
 *
 * Usage:
 *   const { panelRef, closing, requestClose } = useModalA11y(isOpen, onClose)
 *   <div className={closing ? 'modal-closing' : ''}>
 *     <div className="modal-backdrop" onClick={requestClose} />
 *     <div ref={panelRef} className="modal-panel">...</div>
 *   </div>
 */
export function useModalA11y(isOpen: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [closing, setClosing] = useState(false)
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const requestClose = useCallback(() => {
    if (closing) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      onClose()
      return
    }
    setClosing(true)
    closingTimerRef.current = setTimeout(() => {
      setClosing(false)
      onClose()
    }, EXIT_DURATION)
  }, [onClose, closing])

  // Clean up timer and reset closing state when isOpen changes
  useEffect(() => {
    if (!isOpen) {
      setClosing(false)
      if (closingTimerRef.current) {
        clearTimeout(closingTimerRef.current)
        closingTimerRef.current = null
      }
    }
  }, [isOpen])

  // Save the currently focused element when modal opens
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null
    }
  }, [isOpen])

  // Handle Escape key — use requestClose for animated exit
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        requestClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, requestClose])

  // Focus management: auto-focus first focusable element and trap focus
  useEffect(() => {
    if (!isOpen || !panelRef.current) return

    const panel = panelRef.current
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

    // Auto-focus first focusable element
    const firstFocusable = panel.querySelector<HTMLElement>(focusableSelector)
    if (firstFocusable) {
      // Small delay to let animation start
      requestAnimationFrame(() => {
        firstFocusable.focus()
      })
    }

    // Focus trap
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = panel.querySelectorAll<HTMLElement>(focusableSelector)
      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener('keydown', handleTab)

    return () => {
      document.removeEventListener('keydown', handleTab)
      // Restore focus when modal closes
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen])

  return { panelRef, closing, requestClose }
}
