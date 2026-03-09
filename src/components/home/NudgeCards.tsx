'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — NudgeCards (Stage 5-A)
// HR Admin / Manager 홈 상단 AI 주의 카드
// Notification 테이블의 nudge triggerType 알림을 카드로 노출
// ═══════════════════════════════════════════════════════════
//
// 설계 결정:
//   - Notification API를 triggerType 포함 처리 필터로 조회
//   - 미읽음(isRead=false) 우선 + 최근 5개 노출
//   - 카드 클릭 → actionUrl 이동 / X 클릭 → mark as read (dismiss)
//   - 알림이 없으면 섹션 전체 숨김
//   - MANAGER, HR_ADMIN, EXECUTIVE, SUPER_ADMIN 전용

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Clock,
  Target,
  ClipboardCheck,
  Bell,
  X,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ────────────────────────────────────────────────

interface NudgeNotification {
  id:          string
  triggerType: string
  title:       string
  body:        string
  isRead:      boolean
  link:        string | null
  createdAt:   string
}

interface NudgeCardsProps {
  user: SessionUser
}

// ─── triggerType → icon / color mapping ──────────────────

function getNudgeStyle(triggerType: string): {
  Icon: React.ElementType
  borderColor: string
  bgColor: string
  dotColor: string
} {
  if (triggerType.includes('leave')) {
    return {
      Icon: Clock,
      borderColor: 'border-[#EF4444]',
      bgColor:     'bg-[#FEF2F2]',
      dotColor:    'bg-[#EF4444]',
    }
  }
  if (triggerType.includes('payroll')) {
    return {
      Icon: AlertTriangle,
      borderColor: 'border-[#F59E0B]',
      bgColor:     'bg-[#FFFBEB]',
      dotColor:    'bg-[#F59E0B]',
    }
  }
  if (triggerType.includes('performance') || triggerType.includes('eval')) {
    return {
      Icon: Target,
      borderColor: 'border-[#A855F7]',
      bgColor:     'bg-[#FAF5FF]',
      dotColor:    'bg-[#A855F7]',
    }
  }
  if (triggerType.includes('onboarding')) {
    return {
      Icon: ClipboardCheck,
      borderColor: 'border-[#00C853]',
      bgColor:     'bg-[#F0FDF4]',
      dotColor:    'bg-[#00C853]',
    }
  }
  if (triggerType.includes('offboarding')) {
    return {
      Icon: Bell,
      borderColor: 'border-[#F59E0B]',
      bgColor:     'bg-[#FFFBEB]',
      dotColor:    'bg-[#F59E0B]',
    }
  }
  return {
    Icon: Bell,
    borderColor: 'border-[#5E81F4]',
    bgColor:     'bg-[#F0F4FF]',
    dotColor:    'bg-[#5E81F4]',
  }
}

// ─── Roles that can see nudge cards ──────────────────────

const NUDGE_ROLES = new Set(['MANAGER', 'EXECUTIVE', 'HR_ADMIN', 'SUPER_ADMIN'])

// ─── Component ────────────────────────────────────────────

export function NudgeCards({ user }: NudgeCardsProps) {
  const [nudges,   setNudges]   = useState<NudgeNotification[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(false)

  const canSee = NUDGE_ROLES.has(user.role)

  const fetchNudges = useCallback(async () => {
    if (!canSee) { setLoading(false); return }
    try {
      // Fetch unread notifications — backend filters by nudge triggerType prefix
      // We fetch recent notifications and filter client-side for nudge prefix
      const res = await fetch('/api/v1/notifications?limit=20&isRead=false')
      const json = await res.json()
      const all: NudgeNotification[] = json.data ?? []
      // Filter to nudge triggerTypes only
      const filtered = all.filter((n) => n.triggerType?.startsWith('nudge'))
      setNudges(filtered.slice(0, 8))
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [canSee])

  useEffect(() => {
    void fetchNudges()
  }, [fetchNudges])

  const dismiss = async (id: string) => {
    // Optimistic remove
    setNudges((prev) => prev.filter((n) => n.id !== id))
    try {
      await apiClient.put(`/api/v1/notifications/${id}/read`)
    } catch {
      // silent — nudge dismissed optimistically regardless
    }
  }

  // ── Don't render if no permission or no nudges ──────────
  if (!canSee || loading || nudges.length === 0) return null

  const VISIBLE_COUNT = 4
  const visible = expanded ? nudges : nudges.slice(0, VISIBLE_COUNT)
  const overflow = nudges.length - VISIBLE_COUNT

  return (
    <div className="rounded-xl border border-[#F0F0F3] bg-white p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
        <span className="text-sm font-semibold text-[#1C1D21]">주의가 필요합니다</span>
        <span className="ml-1 rounded-full bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-medium text-[#B45309]">
          {nudges.length}건
        </span>
      </div>

      {/* Cards — horizontal scroll on mobile, wrap on desktop */}
      <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:overflow-x-auto sm:pb-1">
        {visible.map((nudge) => {
          const { Icon, borderColor, bgColor, dotColor } = getNudgeStyle(nudge.triggerType)
          const href = nudge.link ?? '#'

          return (
            <div
              key={nudge.id}
              className={`relative flex min-w-[180px] max-w-[240px] flex-1 flex-col rounded-xl border-l-4 p-3 transition-shadow hover:shadow-sm ${bgColor} ${borderColor}`}
            >
              {/* Dismiss button */}
              <button
                type="button"
                className="absolute right-2 top-2 rounded p-0.5 text-[#8181A5] hover:bg-black/5"
                onClick={() => dismiss(nudge.id)}
                aria-label="닫기"
              >
                <X className="h-3 w-3" />
              </button>

              {/* Content */}
              <div className="mb-2 flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                <Icon className="h-3.5 w-3.5 text-[#8181A5]" />
              </div>
              <p className="text-xs font-semibold leading-snug text-[#1C1D21]">
                {nudge.title}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#8181A5]">
                {nudge.body}
              </p>
              {nudge.link && (
                <Link
                  href={href}
                  className="mt-2 inline-flex items-center text-[11px] font-medium text-[#5E81F4] hover:underline"
                >
                  조치하기 →
                </Link>
              )}
            </div>
          )
        })}

        {/* More overflow pill */}
        {!expanded && overflow > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex min-w-[80px] flex-col items-center justify-center rounded-xl border border-dashed border-[#D0D5DD] px-3 py-4 text-xs text-[#8181A5] hover:border-[#5E81F4] hover:text-[#5E81F4]"
          >
            <span className="text-base font-bold">+{overflow}</span>
            <span>더 보기</span>
          </button>
        )}
      </div>
    </div>
  )
}
