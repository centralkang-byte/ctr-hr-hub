'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Session Timeout Warning
// 세션 만료 3분 전 경고 → 연장 또는 로그아웃
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Clock } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// 만료 3분 전 경고
const WARNING_BEFORE_MS = 3 * 60 * 1000

export function SessionTimeoutWarning() {
  const { data: session, update } = useSession()
  const [showWarning, setShowWarning] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(180)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const t = useTranslations('auth')

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  const scheduleWarning = useCallback(() => {
    clearTimers()
    if (!session?.expires) return

    const expiresAt = new Date(session.expires).getTime()
    const now = Date.now()
    const timeUntilWarning = expiresAt - now - WARNING_BEFORE_MS

    if (timeUntilWarning <= 0) {
      // 이미 경고 시점 지남
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000))
      if (remaining > 0) {
        setRemainingSeconds(remaining)
        setShowWarning(true)
      }
      return
    }

    timerRef.current = setTimeout(() => {
      setRemainingSeconds(180)
      setShowWarning(true)

      // 카운트다운
      countdownRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearTimers()
            void signOut({ callbackUrl: '/login' })
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }, timeUntilWarning)
  }, [session?.expires, clearTimers])

  useEffect(() => {
    scheduleWarning()
    return clearTimers
  }, [scheduleWarning, clearTimers])

  const handleExtend = useCallback(async () => {
    setShowWarning(false)
    clearTimers()
    // NextAuth session update triggers token refresh
    await update()
    // 새 세션으로 타이머 재설정
    scheduleWarning()
  }, [update, clearTimers, scheduleWarning])

  const handleLogout = useCallback(() => {
    clearTimers()
    void signOut({ callbackUrl: '/login' })
  }, [clearTimers])

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60

  return (
    <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            {t('sessionExpiring')}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span>{t('sessionExpiringDesc')}</span>
            <span className="block text-center text-2xl font-bold text-foreground tabular-nums">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleLogout}>
            {t('logout')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleExtend}>
            {t('extendSession')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
