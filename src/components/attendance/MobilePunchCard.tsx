'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — MobilePunchCard
// One-touch GPS clock-in/out UI for deskless workers
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { MapPin, Loader2, CheckCircle2, Clock } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

type PunchStatus = 'idle' | 'locating' | 'success' | 'error'

interface PunchResult {
  type: 'IN' | 'OUT'
  lat: number
  lng: number
  timestamp: string
  method: 'MOBILE_GPS'
}

interface MobilePunchCardProps {
  /** Currently clocked in? Controls whether the button shows IN or OUT. */
  isClockedIn?: boolean
  onPunch?: (result: PunchResult) => void | Promise<void>
}

export function MobilePunchCard({ isClockedIn = false, onPunch }: MobilePunchCardProps) {
  const t = useTranslations('attendance')
  const locale = useLocale()
  const [status, setStatus] = useState<PunchStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<PunchResult | null>(null)

  const handlePunch = () => {
    if (status === 'locating') return

    if (!navigator.geolocation) {
      setErrorMsg(t('geoNotSupported'))
      setStatus('error')
      return
    }

    setStatus('locating')
    setErrorMsg(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const result: PunchResult = {
          type: isClockedIn ? 'OUT' : 'IN',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: new Date().toISOString(),
          method: 'MOBILE_GPS',
        }

        try {
          await onPunch?.(result)
          setLastResult(result)
          setStatus('success')
        } catch {
          setErrorMsg(t('punchError'))
          setStatus('error')
        }

        // Reset to idle after 3 seconds
        setTimeout(() => setStatus('idle'), 3000)
      },
      (err) => {
        const messages: Record<number, string> = {
          1: t('geoPermissionDenied'),
          2: t('geoUnavailable'),
          3: t('geoTimeout'),
        }
        setErrorMsg(messages[err.code] ?? t('geoFailed'))
        setStatus('error')
        setTimeout(() => setStatus('idle'), 3000)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  const isClockingIn = !isClockedIn
  const buttonLabel = isClockingIn ? t('clockInAction') : t('clockOutAction')

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Timestamp display */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Clock size={14} />
        <span>{new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date())}</span>
      </div>

      {/* One-touch punch button */}
      <button
        onClick={handlePunch}
        disabled={status === 'locating'}
        aria-label={buttonLabel}
        className={`
          relative w-40 h-40 rounded-full flex flex-col items-center justify-center gap-2
          text-white font-bold text-lg shadow-lg
          transition-all duration-200 active:scale-95
          disabled:opacity-70 disabled:cursor-not-allowed
          ${isClockingIn
            ? 'bg-primary hover:bg-primary/90'
            : 'bg-red-400 hover:bg-red-400'
          }
        `}
      >
        {status === 'locating' && (
          <Loader2 size={32} className="animate-spin" />
        )}
        {status === 'success' && (
          <CheckCircle2 size={32} />
        )}
        {(status === 'idle' || status === 'error') && (
          <MapPin size={32} strokeWidth={1.5} />
        )}
        <span className="text-base font-semibold">
          {status === 'locating' ? t('locating') : buttonLabel}
        </span>
      </button>

      {/* Status messages */}
      {status === 'success' && lastResult && (
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-primary">
            {lastResult.type === 'IN' ? t('clockInComplete') : t('clockOutComplete')}
          </p>
          <p className="text-xs text-muted-foreground">
            GPS ({lastResult.lat.toFixed(4)}, {lastResult.lng.toFixed(4)})
          </p>
        </div>
      )}
      {status === 'error' && errorMsg && (
        <p className="text-sm text-red-400 text-center px-4">{errorMsg}</p>
      )}
    </div>
  )
}
