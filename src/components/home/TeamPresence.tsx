'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Team Presence Widget
// directReports > 0일 때만 사이드바에 표시.
// 팀원 목록 + 출근 상태 + 인라인 승인.
// /api/v1/manager-hub/summary 재사용.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardErrorBanner } from './DashboardErrorBanner'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  user: SessionUser
  className?: string
}

interface TeamMember {
  id: string
  name: string
  position: string
  status: 'PRESENT' | 'LEAVE' | 'HALF_DAY' | 'VACATION' | 'ABSENT'
}

interface PendingApproval {
  id: string
  employeeName: string
  type: string
  summary: string
  sourceId: string
}

interface TeamSummaryData {
  teamCount: number
  teamName?: string
  attendanceRate: number
  members: TeamMember[]
  pendingApprovals: PendingApproval[]
}

// ─── Constants ──────────────────────────────────────────────

const STATUS_TAG: Record<string, { label: string; class: string }> = {
  PRESENT: { label: 'Present', class: 'bg-tertiary-container/30 text-tertiary' },
  LEAVE: { label: 'Leave', class: 'bg-[#FEF3C7] text-[#B45309]' },
  HALF_DAY: { label: 'Half-day', class: 'bg-[#FEF3C7] text-[#B45309]' },
  VACATION: { label: 'Vacation', class: 'bg-primary-container/20 text-primary' },
  ABSENT: { label: 'Absent', class: 'bg-error-container/20 text-error' },
}

// ─── Component ──────────────────────────────────────────────

export function TeamPresence({ user, className }: Props) {
  const t = useTranslations('home')
  const [data, setData] = useState<TeamSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchTeam = useCallback(async () => {
    setError(false)
    setLoading(true)
    try {
      const res = await apiClient.get<TeamSummaryData>(
        '/api/v1/manager-hub/summary?includeMembers=true',
      )
      setData(res.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchTeam()
  }, [fetchTeam])

  const handleApprove = useCallback(
    async (approval: PendingApproval) => {
      setProcessing(approval.id)
      try {
        await apiClient.put(`/api/v1/leave/requests/${approval.sourceId}/approve`, {})
        await fetchTeam()
      } catch {
        toast({ title: '승인 실패', variant: 'destructive' })
      } finally {
        setProcessing(null)
      }
    },
    [fetchTeam],
  )

  // directReports = 0 → null
  if (!loading && !error && (!data || data.teamCount === 0)) return null

  if (loading) {
    return (
      <div className={cn('rounded-2xl bg-primary-container/10 p-4', className)}>
        <Skeleton className="h-4 w-32" />
        <div className="mt-3 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('rounded-2xl bg-primary-container/10 p-4', className)}>
        <DashboardErrorBanner
          message={t('manager.teamLoadError')}
          onRetry={() => void fetchTeam()}
        />
      </div>
    )
  }

  if (!data) return null

  const isEmployee = user.role === 'EMPLOYEE'

  return (
    <div
      className={cn(
        'rounded-2xl border border-primary-container/30 bg-primary-container/10 p-4',
        className,
      )}
    >
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold text-primary">
            👥 {data.teamName ?? t('manager.teamStatus')} · {data.teamCount}명
          </p>
        </div>
        <span className="text-[11px] font-bold text-tertiary">
          {data.attendanceRate}% Attendance
        </span>
      </div>

      {/* Team Members */}
      {data.members.slice(0, 4).map((member) => {
        const tag = STATUS_TAG[member.status] ?? STATUS_TAG.PRESENT
        const initials = member.name.slice(0, 2)
        return (
          <div
            key={member.id}
            className="flex items-center justify-between border-b border-outline-variant/15 py-1.5 last:border-b-0"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container text-[10px] font-bold text-muted-foreground">
                {initials}
              </div>
              <div>
                <p className="text-[11px] font-semibold text-foreground">{member.name}</p>
                <p className="text-[9px] text-muted-foreground">{member.position}</p>
              </div>
            </div>
            <span
              className={cn(
                'rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                tag.class,
              )}
            >
              {tag.label}
            </span>
          </div>
        )
      })}

      {/* Pending Approvals — EMPLOYEE는 승인 권한 없음 */}
      {!isEmployee && data.pendingApprovals.length > 0 && (
        <div className="mt-3 border-t border-primary-container/30 pt-2.5">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            ⚡ {t('manager.pendingApproval')}
          </p>
          {data.pendingApprovals.slice(0, 3).map((approval) => (
            <div
              key={approval.id}
              className="flex items-center justify-between py-1.5"
            >
              <div className="text-[10px]">
                <span className="font-semibold">{approval.employeeName}</span>{' '}
                <span className="text-muted-foreground">{approval.summary}</span>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  className="h-5 rounded-md bg-tertiary px-2 text-[9px] font-bold text-white hover:bg-tertiary-dim"
                  disabled={processing === approval.id}
                  onClick={() => handleApprove(approval)}
                >
                  {processing === approval.id ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    t('taskHub.approve')
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 rounded-md px-2 text-[9px] font-semibold text-muted-foreground"
                >
                  {t('taskHub.reject')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link — /manager-hub 페이지는 MANAGER 이상만 접근 가능 */}
      {!isEmployee && (
        <Link
          href="/manager-hub"
          className="mt-2 block text-center text-[10px] font-semibold text-primary"
        >
          {t('manager.teamOverview')} →
        </Link>
      )}
    </div>
  )
}
