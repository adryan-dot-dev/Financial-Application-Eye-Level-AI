import { useState, useEffect, useRef } from 'react'

/**
 * Animates a number from 0 to the target value using requestAnimationFrame.
 * Respects prefers-reduced-motion.
 */
export function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    // Respect reduced motion preference
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced || target === 0) {
      setValue(target)
      return
    }

    startTimeRef.current = null

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp
      }

      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(eased * target)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setValue(target)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration])

  return value
}
