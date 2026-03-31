'use client'

import { useEffect, useCallback, useRef } from 'react'

/**
 * Dirty State detection + leave warning.
 * Covers: browser refresh/close (beforeunload), SPA navigation (pushState/replaceState), back button (popstate).
 */
export function useUnsavedChanges(isDirty: boolean, message?: string) {
  const msg = message || '저장하지 않은 변경사항이 있습니다. 페이지를 떠나시겠습니까?'
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  useEffect(() => {
    // 1) Browser refresh / tab close
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return
      e.preventDefault()
    }

    // 2) SPA navigation — Next.js App Router uses history.pushState internally
    const origPush = window.history.pushState.bind(window.history)
    const origReplace = window.history.replaceState.bind(window.history)

    window.history.pushState = function (...args: Parameters<typeof origPush>) {
      if (isDirtyRef.current && !window.confirm(msg)) return
      return origPush(...args)
    }
    window.history.replaceState = function (...args: Parameters<typeof origReplace>) {
      if (isDirtyRef.current && !window.confirm(msg)) return
      return origReplace(...args)
    }

    // 3) Browser back/forward button
    const handlePopState = () => {
      if (!isDirtyRef.current) return
      if (!window.confirm(msg)) {
        // Cancel by pushing current URL back
        window.history.pushState(null, '', window.location.href)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.history.pushState = origPush
      window.history.replaceState = origReplace
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [msg])

  /** Call before programmatic navigation (router.push) */
  const confirmLeave = useCallback((): boolean => {
    if (!isDirtyRef.current) return true
    return window.confirm(msg)
  }, [msg])

  return { confirmLeave }
}
