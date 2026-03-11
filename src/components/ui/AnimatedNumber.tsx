'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  duration?: number
  formatter?: (n: number) => string
  className?: string
}

export function AnimatedNumber({ value, duration = 600, formatter, className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0)
  const prevRef = useRef(0)
  const rafRef = useRef<number>()

  useEffect(() => {
    const start = prevRef.current
    const diff = value - start
    const startTime = performance.now()

    const animate = (time: number) => {
      const elapsed = time - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = start + diff * eased
      setDisplay(current)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        prevRef.current = value
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, duration])

  const text = formatter ? formatter(Math.round(display)) : Math.round(display).toLocaleString('ko-KR')
  return <span className={className}>{text}</span>
}
