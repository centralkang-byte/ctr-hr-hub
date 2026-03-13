'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — MobilePunchCard
// One-touch GPS clock-in/out UI for deskless workers
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { MapPin, Loader2, CheckCircle2, Clock } from 'lucide-react'

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
  const [status, setStatus] = useState<PunchStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<PunchResult | null>(null)

  const handlePunch = () => {
    if (status === 'locating') return

    if (!navigator.geolocation) {
      setErrorMsg('이 기기는 위치 서비스를 지원하지 않습니다.')
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
          setErrorMsg('출퇴근 기록 중 오류가 발생했습니다.')
          setStatus('error')
        }

        // Reset to idle after 3 seconds
        setTimeout(() => setStatus('idle'), 3000)
      },
      (err) => {
        const messages: Record<number, string> = {
          1: '위치 접근 권한이 거부되었습니다.',
          2: '현재 위치를 확인할 수 없습니다.',
          3: '위치 확인 시간이 초과되었습니다.',
        }
        setErrorMsg(messages[err.code] ?? '위치 정보를 가져오지 못했습니다.')
        setStatus('error')
        setTimeout(() => setStatus('idle'), 3000)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  const isClockingIn = !isClockedIn
  const buttonLabel = isClockingIn ? '출근하기' : '퇴근하기'

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Timestamp display */}
      <div className="flex items-center gap-1.5 text-sm text-[#8181A5]">
        <Clock size={14} />
        <span>{new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
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
            ? 'bg-[#4F46E5] hover:bg-[#4B6EE4]'
            : 'bg-[#FF808B] hover:bg-[#F06070]'
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
          {status === 'locating' ? '위치 확인 중...' : buttonLabel}
        </span>
      </button>

      {/* Status messages */}
      {status === 'success' && lastResult && (
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-[#4F46E5]">
            {lastResult.type === 'IN' ? '출근 완료!' : '퇴근 완료!'}
          </p>
          <p className="text-xs text-[#8181A5]">
            GPS ({lastResult.lat.toFixed(4)}, {lastResult.lng.toFixed(4)})
          </p>
        </div>
      )}
      {status === 'error' && errorMsg && (
        <p className="text-sm text-[#FF808B] text-center px-4">{errorMsg}</p>
      )}
    </div>
  )
}
