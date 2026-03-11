'use client'

import { useState, useCallback, useRef } from 'react'

/**
 * Art.28: Double-click prevention.
 * Wraps an async submit function with loading state + disabled guard.
 */
export function useSubmitGuard<T extends (...args: never[]) => Promise<unknown>>(
  submitFn: T,
) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const abortRef = useRef(false)

  const guardedSubmit = useCallback(
    async (...args: Parameters<T>) => {
      if (isSubmitting || abortRef.current) return
      setIsSubmitting(true)
      try {
        const result = await submitFn(...args)
        return result
      } finally {
        if (!abortRef.current) {
          setIsSubmitting(false)
        }
      }
    },
    [submitFn, isSubmitting],
  )

  const cleanup = useCallback(() => { abortRef.current = true }, [])

  return { guardedSubmit, isSubmitting, cleanup } as const
}
