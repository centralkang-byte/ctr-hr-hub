'use client'

import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

export interface TimelineEvent {
  id: string
  date: string          // ISO date string
  type: string          // 'hire' | 'promotion' | 'transfer' | 'contract' | 'termination' | ...
  title: string         // "입사", "승진", "부서이동"
  description: string   // "개발팀 · 사원(S1)"
  details?: Record<string, unknown>   // 사이드패널 상세 데이터
  highlighted?: boolean // 시점조회 시 해당 시점 이벤트 강조
}

interface AssignmentTimelineProps {
  events: TimelineEvent[]
  onEventClick?: (event: TimelineEvent) => void
  loading?: boolean
  emptyMessage?: string
}

// ─── Event type → color/icon 매핑 ───────────────────────────

const EVENT_STYLES: Record<string, { color: string; bg: string; icon: string }> = {
  HIRE:             { color: '#059669', bg: '#D1FAE5', icon: '🟢' },
  PROMOTION:        { color: '#4338CA', bg: '#E0E7FF', icon: '⭐' },
  DEMOTION:         { color: '#B45309', bg: '#FEF3C7', icon: '⬇️' },
  TRANSFER:         { color: '#0891B2', bg: '#CFFAFE', icon: '🔄' },
  COMPANY_TRANSFER: { color: '#7C3AED', bg: '#EDE9FE', icon: '🌐' },
  CONTRACT_CHANGE:  { color: '#D97706', bg: '#FEF3C7', icon: '📋' },
  STATUS_CHANGE:    { color: '#6B7280', bg: '#F3F4F6', icon: '🔵' },
  REORGANIZATION:   { color: '#0284C7', bg: '#E0F2FE', icon: '🏢' },
  TERMINATION:      { color: '#DC2626', bg: '#FEE2E2', icon: '🔴' },
}

function getEventStyle(type: string) {
  return EVENT_STYLES[type] ?? { color: '#6B7280', bg: '#F3F4F6', icon: '📋' }
}

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// ─── Skeleton ────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 rounded-full bg-[#E8E8E8]" />
            {i < 3 && <div className="mt-1 w-px flex-1 bg-[#E8E8E8]" style={{ minHeight: 48 }} />}
          </div>
          <div className="flex-1 pb-6">
            <div className="h-3 w-24 rounded bg-[#E8E8E8] mb-2" />
            <div className="rounded-xl border border-[#E8E8E8] p-4">
              <div className="h-4 w-32 rounded bg-[#E8E8E8] mb-1" />
              <div className="h-3 w-48 rounded bg-[#E8E8E8]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────

export function AssignmentTimeline({
  events,
  onEventClick,
  loading = false,
  emptyMessage = '이력이 없습니다.',
}: AssignmentTimelineProps) {
  if (loading) return <TimelineSkeleton />

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#999]">
        <span className="text-3xl mb-2">📋</span>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {events.map((event, idx) => {
        const style = getEventStyle(event.type)
        const isLast = idx === events.length - 1

        return (
          <div key={event.id} className="flex gap-4">
            {/* Left: connector line + icon */}
            <div className="flex flex-col items-center" style={{ minWidth: 40 }}>
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm flex-shrink-0 shadow-sm"
                style={{ backgroundColor: style.bg, color: style.color, border: `2px solid ${style.color}` }}
              >
                <span role="img" aria-label={event.type}>{style.icon}</span>
              </div>
              {!isLast && (
                <div className="mt-1 w-px flex-1 bg-[#E8E8E8]" style={{ minHeight: 32 }} />
              )}
            </div>

            {/* Right: date + card */}
            <div className={cn('flex-1 pb-6', isLast && 'pb-0')}>
              <p className="mb-1.5 text-xs font-medium text-[#999]">
                {formatEventDate(event.date)}
              </p>
              <button
                onClick={() => onEventClick?.(event)}
                className={cn(
                  'w-full rounded-lg border p-4 text-left transition-all',
                  onEventClick && 'cursor-pointer hover:border-[#4F46E5] hover:shadow-sm',
                  !onEventClick && 'cursor-default',
                  event.highlighted
                    ? 'border-[#4F46E5] bg-[#EEF2FF] ring-1 ring-[#4F46E5]/20'
                    : 'border-[#E8E8E8] bg-white',
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: style.bg, color: style.color }}
                  >
                    {event.title}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#555]">{event.description}</p>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
