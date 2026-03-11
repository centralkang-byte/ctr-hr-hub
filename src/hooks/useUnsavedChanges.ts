'use client'

import { useEffect, useCallback, useRef } from 'react'

/**
 * Art.19: Dirty State detection + leave warning.
 * Prevents accidental navigation away from unsaved form changes.
 */
export function useUnsavedChanges(isDirty: boolean, message?: string) {
  const msg = message || '저장하지 않은 변경사항이 있습니다. 페이지를 떠나시겠습니까?'
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [msg])

  /** Call before programmatic navigation (router.push) */
  const confirmLeave = useCallback((): boolean => {
    if (!isDirtyRef.current) return true
    return window.confirm(msg)
  }, [msg])

  return { confirmLeave }
}
