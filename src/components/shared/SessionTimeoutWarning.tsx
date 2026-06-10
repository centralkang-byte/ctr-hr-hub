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

// setTimeout delay 상한 — 2^31-1ms(~24.8일) 초과 delay는 브라우저가 0으로 오버플로해
// 즉시 발화함. 클라이언트 시계가 만료보다 한참 과거이면(시계 skew, 테스트 clock freeze)
// 경고가 무조건 떠버리는 버그의 근본 원인. 상한으로 클램프하면 그 시점에 재평가될 뿐.
const MAX_TIMEOUT_MS = 2 ** 31 - 1

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

    // 만료까지 24.8일 이상 남으면 경고 자체가 불필요 — 오버플로 즉시발화 방지 겸 스킵
    if (timeUntilWarning >= MAX_TIMEOUT_MS) return

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
