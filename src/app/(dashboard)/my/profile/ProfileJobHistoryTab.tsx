'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Profile · Job/Assignment History Tab
// 본인 전체 발령 이력 (/api/v1/employees/[id]/history — EmployeeAssignment).
// 기존 career 탭은 employeeHistories(최근 10)로 잘려 있었음 → 전체 이력으로 분리.
// 프로토 "직무 발령 이력" 좌측 레일 타임라인 (이모지 금지 · Lucide).
// ═══════════════════════════════════════════════════════════

// ─── Imports ────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Briefcase, User } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'
import { CARD_STYLES } from '@/lib/styles'
import { formatDate } from '@/lib/format/date'

// ─── Types ──────────────────────────────────────────────────
interface Assignment {
  id: string
  effectiveDate: string
  endDate: string | null
  changeType: string
  status: string
  company: { id: string; name: string } | null
  department: { id: string; name: string } | null
  jobGrade: { id: string; name: string; code: string } | null
  position: { id: string; titleKo: string; titleEn: string } | null
}

interface HistoryResponse {
  assignments: Assignment[]
  hireDate: string | null
}

interface Props {
  employeeId: string
}

// ─── Constants ──────────────────────────────────────────────
// EmployeeAssignment.changeType → i18n 키 (profile.changeType.*). 미정의는 raw fallback.
const CHANGE_TYPE_KEYS: Record<string, string> = {
  HIRE: 'HIRE', PROMOTION: 'PROMOTION', TRANSFER: 'TRANSFER', DEMOTION: 'DEMOTION',
  REORGANIZATION: 'REORGANIZATION', STATUS_CHANGE: 'STATUS_CHANGE',
  CONTRACT_CHANGE: 'CONTRACT_CHANGE', COMPANY_TRANSFER: 'COMPANY_TRANSFER',
}

// ─── Component ──────────────────────────────────────────────
export function ProfileJobHistoryTab({ employeeId }: Props) {
  const t = useTranslations('mySpace')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const translateChangeType = useCallback((type: string) => {
    const key = CHANGE_TYPE_KEYS[type]
    return key ? t(`profile.changeType.${key}` as Parameters<typeof t>[0]) : type
  }, [t])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(false)
      const res = await apiClient.get<HistoryResponse>(`/api/v1/employees/${employeeId}/history`)
      setAssignments(res.data?.assignments ?? [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className={CARD_STYLES.padded}>
        <div className="space-y-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 w-4 rounded-full bg-border" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded bg-border" />
                <div className="h-4 w-40 rounded bg-border" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={CARD_STYLES.padded}>
        <EmptyState
          icon={Briefcase}
          title={t('profile.summary.loadError')}
          action={{ label: t('profile.summary.retry'), onClick: load }}
        />
      </div>
    )
  }

  if (assignments.length === 0) {
    return (
      <div className={CARD_STYLES.padded}>
        <EmptyState icon={Briefcase} title={t('profile.emptyCareerTitle')} description={t('profile.emptyCareerDesc')} />
      </div>
    )
  }

  return (
    <div className={CARD_STYLES.padded}>
      <h2 className="text-base font-semibold text-foreground mb-6">{t('profile.jobHistoryTitle')}</h2>
      <div role="list" className="relative pl-7">
        {/* rail */}
        <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-border" aria-hidden="true" />
        <div className="space-y-6">
          {assignments.map((a) => (
            <article key={a.id} role="listitem" className="relative">
              <div className="absolute -left-7 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-primary text-white">
                {a.changeType === 'HIRE'
                  ? <User className="h-2.5 w-2.5" aria-hidden="true" />
                  : <Briefcase className="h-2.5 w-2.5" aria-hidden="true" />}
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {translateChangeType(a.changeType)}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatDate(a.effectiveDate)}</span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-foreground">
                {a.department?.name ?? t('profile.noDept')}
                {a.jobGrade?.name ? ` · ${a.jobGrade.name}` : ''}
              </p>
              <p className={cn('text-xs text-muted-foreground', (a.position?.titleKo || a.company?.name) ? 'mt-0.5' : 'hidden')}>
                {[a.position?.titleKo, a.company?.name].filter(Boolean).join(' · ')}
              </p>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
