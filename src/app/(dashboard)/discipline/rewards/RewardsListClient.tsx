'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 포상관리 목록 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, Plus, ChevronLeft, ChevronRight, Award, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { BUTTON_SIZES, BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'

// ─── Badge Styles ────────────────────────────────────────

const REWARD_TYPE_BADGE_STYLES: Record<string, string> = {
  COMMENDATION: 'bg-primary/10 text-tertiary',
  BONUS_AWARD: 'bg-primary/5 text-blue-800',
  CTR_VALUE_AWARD: 'bg-purple-500/10 text-purple-800',
  LONG_SERVICE: 'bg-orange-500/10 text-orange-800',
  INNOVATION: 'bg-primary/10 text-primary',
  SAFETY_AWARD: 'bg-primary/5 text-blue-500',
  PROMOTION_RECOMMENDATION: 'bg-primary/10 text-tertiary',
  OTHER: 'bg-muted text-muted-foreground',
}

const CTR_VALUE_BADGE_STYLES: Record<string, string> = {
  CHALLENGE: 'bg-destructive/5 text-destructive',
  TRUST: 'bg-primary/5 text-blue-800',
  RESPONSIBILITY: 'bg-orange-500/10 text-orange-800',
  RESPECT: 'bg-purple-500/10 text-purple-800',
}

// ─── Types ───────────────────────────────────────────────

interface RewardRecord {
  id: string
  rewardType: string
  title: string
  amount: number | null
  awardedDate: string
  ctrValue: string | null
  serviceYears: number | null
  employee: {
    id: string
    name: string
    employeeNo: string
  }
  issuer: { id: string; name: string } | null
}

interface Props {
  user: SessionUser
}

const LIMIT = 20

const REWARD_TYPE_KEYS = ['COMMENDATION', 'BONUS_AWARD', 'PROMOTION_RECOMMENDATION', 'LONG_SERVICE', 'INNOVATION', 'SAFETY_AWARD', 'CTR_VALUE_AWARD', 'OTHER'] as const

// ─── Component ───────────────────────────────────────────

export default function RewardsListClient({ user }: Props) {
  const router = useRouter()
  const t = useTranslations('rewardsPage')
  const tCommon = useTranslations('common')

  const [data, setData] = useState<RewardRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<RewardRecord>('/api/v1/rewards', {
        page,
        limit: LIMIT,
        search: search || undefined,
        rewardType: typeFilter || undefined,
      })
      setData(res.data)
      setTotal(res.pagination.total)
    } catch (err) {
      toast({ title: '포상 목록 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, search, typeFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const totalPages = Math.ceil(total / LIMIT)

  void user

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Award className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-[-0.02em]">
              {t('title')}
            </h1>
            <p className="text-sm text-muted-foreground">{tCommon('total')} {total}{tCommon('items')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/discipline')}
            className="px-4 py-2 text-sm font-medium border border-border text-foreground hover:bg-background rounded-lg transition-colors duration-150"
          >
            {t('disciplineManagement')}
          </button>
          <button
            onClick={() => router.push('/discipline/rewards/new')}
            className={`inline-flex items-center gap-2 ${BUTTON_SIZES.md} ${BUTTON_VARIANTS.primary}`}
          >
            <Plus className="w-4 h-4" />
            {t('registerReward')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-card"
            >
              <option value="">{t('typeAll')}</option>
              {REWARD_TYPE_KEYS.map((key) => (
                <option key={key} value={key}>{t(`rewardTypeLabels.${key}`)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={TABLE_STYLES.wrapper}>
        <table className={TABLE_STYLES.table}>
          <thead>
            <tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>{t('employeeName')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('employeeNo')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('rewardType')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('rewardName')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('awardedDate')}</th>
              <th className={TABLE_STYLES.headerCellRight}>{tCommon('amount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
                    {t('loadingData')}
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {t('emptyMessage')}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/discipline/rewards/${row.id}`)}
                  className={TABLE_STYLES.rowClickable}
                >
                  <td className="px-4 py-3 text-sm text-foreground font-medium">
                    {row.employee.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {row.employee.employeeNo}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${REWARD_TYPE_BADGE_STYLES[row.rewardType] ?? 'bg-muted text-muted-foreground'}`}>
                        {t(`rewardTypeLabels.${row.rewardType}`, { defaultValue: row.rewardType })}
                      </span>
                      {row.rewardType === 'CTR_VALUE_AWARD' && row.ctrValue && (
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${CTR_VALUE_BADGE_STYLES[row.ctrValue] ?? 'bg-muted text-muted-foreground'}`}>
                          {t(`ctrValueLabels.${row.ctrValue}`, { defaultValue: row.ctrValue })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {row.title}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {format(new Date(row.awardedDate), 'yyyy-MM-dd')}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground text-right">
                    {row.amount !== null && row.amount !== undefined
                      ? t('amountValue', { amount: Number(row.amount).toLocaleString() })
                      : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {t('paginationInfo', { total, start: (page - 1) * LIMIT + 1, end: Math.min(page * LIMIT, total) })}
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-border hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <span className="px-3 text-sm text-foreground">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-border hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
