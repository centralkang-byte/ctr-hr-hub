'use client'

import { useTranslations } from 'next-intl'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import {
  CalendarDays, Plus, Loader2, AlertTriangle, Clock,
  CheckCircle2, XCircle, ChevronLeft, ChevronRight,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { TABLE_STYLES } from '@/lib/styles'
import { cn } from '@/lib/utils'

// ─── 타입 ─────────────────────────────────────────────────

interface LeaveTypeDef {
  id: string
  code: string
  name: string
  isPaid: boolean
  allowHalfDay: boolean
}

interface YearBalance {
  id: string
  leaveTypeDefId: string
  year: number
  entitled: number
  used: number
  carriedOver: number
  adjusted: number
  pending: number
  remaining: number
  expiresAt: string | null
  leaveTypeDef: LeaveTypeDef
}

interface LeaveRequest {
  id: string
  startDate: string
  endDate: string
  days: number
  status: string
  reason: string | null
  createdAt: string
  policy: { name: string; leaveType: string } | null
}

// STATUS_LABELS defined inside component for translation access

// ─── 메인 컴포넌트 ─────────────────────────────────────────

export function MyLeaveClient({ user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('mySpace')

  const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    PENDING: { label: t('status.pending'), color: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]', icon: <Clock className="w-3 h-3" /> },
    APPROVED: { label: t('status.approved'), color: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]', icon: <CheckCircle2 className="w-3 h-3" /> },
    REJECTED: { label: t('status.rejected'), color: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]', icon: <XCircle className="w-3 h-3" /> },
    CANCELLED: { label: t('status.cancelled'), color: 'bg-[#FAFAFA] text-[#555] border-[#E8E8E8]', icon: null },
  }

  const [year, setYear] = useState(new Date().getFullYear())
  const [balances, setBalances] = useState<YearBalance[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loadingBalances, setLoadingBalances] = useState(true)
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBalances = useCallback(async () => {
    setLoadingBalances(true)
    try {
      const res = await apiClient.get<YearBalance[]>('/api/v1/leave/year-balances', { year: String(year) })
      setBalances(res.data ?? [])
    } catch {
      toast({ title: tCommon('loadFailed'), variant: 'destructive' })
      setError(tCommon('loadFailed'))
    } finally {
      setLoadingBalances(false)
    }
  }, [year])

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true)
    try {
      const res = await apiClient.getList<LeaveRequest>('/api/v1/leave/requests', { limit: '50' })
      setRequests(res.data ?? [])
    } catch {
      // silent — old system may not have data
      setRequests([])
    } finally {
      setLoadingRequests(false)
    }
  }, [])

  useEffect(() => { loadBalances() }, [loadBalances])
  useEffect(() => { loadRequests() }, [loadRequests])

  const totalEntitled = balances.reduce((sum, b) => sum + b.entitled + b.carriedOver + b.adjusted, 0)
  const totalUsed = balances.reduce((sum, b) => sum + b.used, 0)
  const totalPending = balances.reduce((sum, b) => sum + b.pending, 0)
  const totalRemaining = balances.reduce((sum, b) => sum + b.remaining, 0)

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-6 h-6 text-[#5E81F4]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('myLeave')}</h1>
            <p className="text-sm text-[#666] mt-0.5">{t('myLeaveDesc')}</p>
          </div>
        </div>
        {/* 연도 선택기 */}
        <div className="flex items-center gap-2">
          <button onClick={() => setYear((y) => y - 1)} className="p-1.5 hover:bg-[#F5F5F5] rounded-lg">
            <ChevronLeft className="w-4 h-4 text-[#555]" />
          </button>
          <span className="text-lg font-bold text-[#1A1A1A] min-w-16 text-center">{year}{tCommon('unit.year')}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            disabled={year >= new Date().getFullYear()}
            className="p-1.5 hover:bg-[#F5F5F5] rounded-lg disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4 text-[#555]" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[#B91C1C] text-sm">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* KPI 카드 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: t('totalEntitled'), value: totalEntitled, unit: tCommon('unit.day'), color: 'text-[#1A1A1A]' },
          { label: tCommon('used'), value: totalUsed, unit: tCommon('unit.day'), color: 'text-[#059669]' },
          { label: tCommon('pending'), value: totalPending, unit: tCommon('unit.day'), color: 'text-[#B45309]' },
          { label: tCommon('remaining'), value: totalRemaining, unit: tCommon('unit.day'), color: 'text-[#5E81F4]' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <p className="text-xs text-[#666] mb-1">{kpi.label}</p>
            <p className={`text-3xl font-bold ${kpi.color}`}>
              {kpi.value}
              <span className="text-sm font-normal ml-1 text-[#999]">{kpi.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* 유형별 잔여 현황 */}
      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        <div className="px-5 py-4 border-b border-[#F5F5F5] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1A1A1A]">{t('leaveByType')}</h2>
          {loadingBalances && <Loader2 className="w-4 h-4 animate-spin text-[#5E81F4]" />}
        </div>

        {!loadingBalances && balances.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={t('emptyLeaveBalance')}
              description={t('emptyLeaveBalanceDesc')}
            />
        ) : (
          <div className="p-5 space-y-4">
            {balances.map((b) => {
              const total = b.entitled + b.carriedOver + b.adjusted
              const usedPct = total > 0 ? Math.min(100, (b.used / total) * 100) : 0
              const pendingPct = total > 0 ? Math.min(100 - usedPct, (b.pending / total) * 100) : 0

              return (
                <div key={b.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#1A1A1A]">{b.leaveTypeDef.name}</span>
                      {b.leaveTypeDef.isPaid
                        ? <span className="text-xs text-[#047857] bg-[#D1FAE5] px-1.5 py-0.5 rounded-full">{t('paid')}</span>
                        : <span className="text-xs text-[#B45309] bg-[#FEF3C7] px-1.5 py-0.5 rounded-full">{t('unpaid')}</span>
                      }
                      {b.carriedOver > 0 && (
                        <span className="text-xs text-[#4B6DE0] bg-[#E0E7FF] px-1.5 py-0.5 rounded-full">{t('carriedOver', { days: b.carriedOver })}</span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-[#5E81F4]">{b.remaining}</span>
                      <span className="text-xs text-[#999]">/ {total}{tCommon('unitDay')}</span>
                    </div>
                  </div>

                  {/* 사용률 바 */}
                  <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                    <div className="h-full flex">
                      <div
                        className="bg-[#059669] rounded-full transition-all"
                        style={{ width: `${usedPct}%` }}
                      />
                      {pendingPct > 0 && (
                        <div
                          className="bg-[#FCD34D] rounded-full transition-all"
                          style={{ width: `${pendingPct}%` }}
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[#999]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-[#059669] rounded-full inline-block" />
                      {t('usedDays', { days: b.used })}
                    </span>
                    {b.pending > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-[#FCD34D] rounded-full inline-block" />
                        {t('pendingDays', { days: b.pending })}
                      </span>
                    )}
                    {b.expiresAt && (
                      <span className="text-[#DC2626]">
                        {t('expiresOn', { date: format(new Date(b.expiresAt), 'M/d', { locale: ko }) })}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 사용 내역 */}
      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        <div className="px-5 py-4 border-b border-[#F5F5F5] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1A1A1A]">{t('leaveHistory')}</h2>
          {loadingRequests && <Loader2 className="w-4 h-4 animate-spin text-[#5E81F4]" />}
        </div>

        {!loadingRequests && requests.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={t('emptyLeaveHistory')}
            description={t('emptyLeaveHistoryDesc')}
          />
        ) : (
          <div className={TABLE_STYLES.wrapper}>
            <table className={TABLE_STYLES.table}>
              <thead>
                <tr className={TABLE_STYLES.header}>
                  {[
                    t('col.leaveType'), t('col.period'), t('col.days'),
                    t('col.status'), t('col.requestedAt')
                  ].map((h) => (
                    <th key={h} className={TABLE_STYLES.headerCell}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.slice(0, 20).map((r) => {
                  const st = STATUS_LABELS[r.status] ?? STATUS_LABELS.PENDING
                  return (
                    <tr key={r.id} className={TABLE_STYLES.row}>
                      <td className={cn(TABLE_STYLES.cell, "text-[#1A1A1A]")}>
                        {r.policy?.name ?? r.policy?.leaveType ?? '—'}
                      </td>
                      <td className={cn(TABLE_STYLES.cell, "text-[#555]")}>
                        {format(new Date(r.startDate), 'yy.M.d')} ~ {format(new Date(r.endDate), 'yy.M.d')}
                      </td>
                      <td className={cn(TABLE_STYLES.cell, "text-[#555]")}>{r.days}{tCommon('unitDay')}</td>
                      <td className={TABLE_STYLES.cell}>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${st.color}`}>
                          {st.icon}
                          {st.label}
                        </span>
                      </td>
                      <td className={cn(TABLE_STYLES.cell, "text-[#999]")}>
                        {format(new Date(r.createdAt), 'yy.M.d')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
