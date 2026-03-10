'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — useSidebarCounts Hook
// 사이드바 뱃지 카운트 폴링 (60초 간격)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react'

export interface SidebarCounts {
  approvals: number
  notifications: number
  pendingLeave: number
  todayAbsent: number
}

const POLL_INTERVAL = 60_000 // 60 seconds

export function useSidebarCounts() {
  const [counts, setCounts] = useState<SidebarCounts>({
    approvals: 0,
    notifications: 0,
    pendingLeave: 0,
    todayAbsent: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCounts = useCallback(async () => {
    // Skip if tab not visible
    if (typeof document !== 'undefined' && document.hidden) return
    try {
      const res = await fetch('/api/v1/sidebar/counts', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      if (json?.data) setCounts(json.data as SidebarCounts)
    } catch {
      // network error — keep previous counts
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCounts()
    timerRef.current = setInterval(fetchCounts, POLL_INTERVAL)

    // Pause polling when tab hidden, resume on visible
    const handleVisibility = () => {
      if (!document.hidden) fetchCounts()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchCounts])

  return { counts, isLoading }
}
