import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * Adds the 'in-view' class to `.scroll-reveal` children when they enter the viewport.
 * Uses IntersectionObserver. Respects prefers-reduced-motion.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(): RefObject<T | null> {
  const containerRef = useRef<T | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Respect reduced motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      container.querySelectorAll('.scroll-reveal').forEach((el) => {
        el.classList.add('in-view')
      })
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    )

    const elements = container.querySelectorAll('.scroll-reveal')
    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return containerRef
}
