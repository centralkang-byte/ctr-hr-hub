'use client'

import { useTranslations } from 'next-intl'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Settings, ClipboardList, BarChart3 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { CARD_STYLES, BUTTON_VARIANTS, TABLE_STYLES } from '@/lib/styles'
import { STATUS_VARIANT } from '@/lib/styles/status'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import type { SessionUser } from '@/types'
import { EmployeeCell } from '@/components/common/EmployeeCell'

// ─── Types ───────────────────────────────────────────────

interface Cycle {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
}

interface MyReviewItem {
  nominationId: string
  employee: {
    id: string
    name: string
    employeeNo: string
    department: { name: string } | null
    jobGrade: { name: string } | null
  }
  evalStatus: string | null
}

interface TeamResult {
  cycleId: string
  totalEmployees: number
  totalNominations: number
  completionRate: number
  employees: {
    employee: { id: string; name: string; employeeNo: string; department: string }
    nominationCount: number
    completedCount: number
    avgScore: number | null
  }[]
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: '미작성', cls: STATUS_VARIANT.neutral },
  SUBMITTED: { label: '제출 완료', cls: STATUS_VARIANT.info },
  CONFIRMED: { label: '확정됨', cls: STATUS_VARIANT.success },
}

// ─── Component ───────────────────────────────────────────

export default function PeerReviewClient({ user: _user }: { user: SessionUser }) {
  // ✅ ALL hooks at top — before any conditions
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
  const router = useRouter()
  const [tab, setTab] = useState<'my-reviews' | 'setup' | 'results'>('my-reviews')
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string>('')
  const [myReviews, setMyReviews] = useState<MyReviewItem[]>([])
  const [teamResults, setTeamResults] = useState<TeamResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const TABS = [
    { key: 'my-reviews' as const, label: t('myReviews'), icon: ClipboardList },
    { key: 'setup' as const, label: t('setupNomination'), icon: Settings },
    { key: 'results' as const, label: t('teamResults'), icon: BarChart3 },
  ]

  const fetchCycles = useCallback(async () => {
    try {
      const res = await apiClient.get<{ items: Cycle[] }>('/api/v1/performance/cycles?size=10')
      const items = res.data.items ?? []
      setCycles(items)
      if (items.length > 0 && !selectedCycleId) {
        setSelectedCycleId(items[0].id)
      }
    } catch {
      toast({ title: tCommon('loadFailed'), variant: 'destructive' })
    }
  }, [selectedCycleId, tCommon])

  const fetchData = useCallback(async () => {
    if (!selectedCycleId) return
    setLoading(true)
    setError('')
    try {
      if (tab === 'my-reviews') {
        const res = await apiClient.get<MyReviewItem[]>(`/api/v1/peer-review/my-reviews?cycleId=${selectedCycleId}`)
        setMyReviews(res.data ?? [])
      } else if (tab === 'results') {
        const res = await apiClient.get<TeamResult>(`/api/v1/peer-review/results/team?cycleId=${selectedCycleId}`)
        setTeamResults(res.data)
      }
    } catch {
      setError(tCommon('loadFailed'))
    }
    setLoading(false)
  }, [selectedCycleId, tab, tCommon])

  useEffect(() => { fetchCycles() }, [fetchCycles])
  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">{t('peerReviewTitle')}</h1>
      </div>

      {/* Cycle Selector + Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex border-b border-border">
          {TABS.map((tab_) => (
            <button key={tab_.key} onClick={() => setTab(tab_.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 ${tab === tab_.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              <tab_.icon className="w-4 h-4" />
              {tab_.label}
            </button>
          ))}
        </div>
        <select value={selectedCycleId} onChange={(e) => setSelectedCycleId(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm">
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : error ? (
        <div className="text-center text-sm text-destructive py-8">{error} <button onClick={fetchData} className="underline ml-2">{tCommon('retry')}</button></div>
      ) : tab === 'my-reviews' ? (
        /* My Reviews Tab */
        <div className="space-y-4">
          {myReviews.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t('emptyPeerReviews')}
              description={t('emptyPeerReviewsDesc')}
            />
          ) : (
            myReviews.map((r) => (
              <div key={r.nominationId} className={`${CARD_STYLES.kpi} flex items-center justify-between`}>
                <EmployeeCell
                  size="sm"
                  employee={{
                    id: r.employee.id,
                    name: r.employee.name,
                    employeeNo: r.employee.employeeNo,
                    department: r.employee.department?.name,
                    jobGrade: r.employee.jobGrade?.name,
                  }}
                />
                <div className="flex items-center gap-3">
                  {r.evalStatus ? (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[r.evalStatus]?.cls ?? ''}`}>
                      {STATUS_BADGE[r.evalStatus]?.label ?? r.evalStatus}
                    </span>
                  ) : (
                    <button onClick={() => router.push(`/performance/peer-review/evaluate/${r.nominationId}`)}
                      className={`px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium`}>
                      {t('evaluate')}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : tab === 'setup' ? (
        /* Setup Tab */
        <div className="text-center py-10">
          <button onClick={() => router.push(`/performance/peer-review/${selectedCycleId}/setup`)}
            className={`px-6 py-3 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium`}>
            {t('openSetup')}
          </button>
        </div>
      ) : (
        /* Results Tab */
        teamResults && (
          <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <div className={CARD_STYLES.padded}>
                <p className="text-xs text-muted-foreground mb-1">{t('targetEmployees')}</p>
                <p className="text-3xl font-bold text-foreground">{teamResults.totalEmployees}{tCommon('unit.person')}</p>
              </div>
              <div className={CARD_STYLES.padded}>
                <p className="text-xs text-muted-foreground mb-1">{t('totalNominations')}</p>
                <p className="text-3xl font-bold text-foreground">{teamResults.totalNominations}{tCommon('unit.count')}</p>
              </div>
              <div className={CARD_STYLES.padded}>
                <p className="text-xs text-muted-foreground mb-1">{tCommon('completionRate')}</p>
                <p className="text-3xl font-bold text-primary">{teamResults.completionRate}%</p>
              </div>
            </div>

            <div className={TABLE_STYLES.wrapper}>
              <table className={TABLE_STYLES.table}>
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    <th className={TABLE_STYLES.headerCell}>{tCommon('employee')}</th>
                    <th className={TABLE_STYLES.headerCell}>{tCommon('department')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('nominationCount')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{tCommon('completed')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('avgScore')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{tCommon('detail')}</th>
                  </tr>
                </thead>
                <tbody>
                  {teamResults.employees.map((e) => (
                    <tr key={e.employee.id} className={TABLE_STYLES.row}>
                      <td className={cn(TABLE_STYLES.cell, "px-4")}>
                        <EmployeeCell
                          size="sm"
                          employee={{
                            id: e.employee.id,
                            name: e.employee.name,
                            department: e.employee.department,
                          }}
                        />
                      </td>
                      <td className={cn(TABLE_STYLES.cellMuted)}>{e.employee.department}</td>
                      <td className={cn(TABLE_STYLES.cellMuted, "text-center")}>{e.nominationCount}</td>
                      <td className={cn(TABLE_STYLES.cellMuted, "text-center")}>{e.completedCount}</td>
                      <td className={cn(TABLE_STYLES.cell, "text-center font-medium")}>
                        {e.avgScore != null ? `${e.avgScore}/5` : '-'}
                      </td>
                      <td className={cn(TABLE_STYLES.cell, "text-center")}>
                        <button onClick={() => router.push(`/performance/peer-review/results/${selectedCycleId}?employeeId=${e.employee.id}`)}
                          className="text-sm text-primary hover:text-primary/90 font-medium">{tCommon('view')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
