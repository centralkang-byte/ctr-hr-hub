'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { DataTable } from '@/components/shared/DataTable'
import type { DataTableColumn } from '@/components/shared/DataTable'
import { COMPA_RATIO_CONFIG, formatCurrency } from '@/lib/compensation'
import type { CompaRatioBand } from '@/lib/compensation'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { PaginationInfo } from '@/types'

// ─── Types ───────────────────────────────────────────────

type HistoryRow = {
  id: string
  employeeName: string
  departmentName: string
  jobGradeName: string
  changeType: string
  previousBaseSalary: number
  newBaseSalary: number
  changePct: number
  compaRatio: number | null
  effectiveDate: string
  approverName: string | null
}

interface DistributionItem {
  band: CompaRatioBand
  count: number
  percentage: number
}

// ─── Change Type Labels ──────────────────────────────────

const CHANGE_TYPE_KEYS: Record<string, string> = {
  HIRE: 'changeTypes.HIRE',
  ANNUAL_INCREASE: 'changeTypes.ANNUAL_INCREASE',
  PROMOTION: 'changeTypes.PROMOTION',
  MARKET_ADJUSTMENT: 'changeTypes.MARKET_ADJUSTMENT',
  DEMOTION_COMP: 'changeTypes.DEMOTION_COMP',
  TRANSFER_COMP: 'changeTypes.TRANSFER_COMP',
  OTHER: 'changeTypes.OTHER',
}

// ─── Component ───────────────────────────────────────────

export default function HistoryTab() {
  const t = useTranslations('compensation')
  const { toast } = useToast()
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [distribution, setDistribution] = useState<DistributionItem[]>([])

  const fetchHistory = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const res = await apiClient.getList<HistoryRow>('/api/v1/compensation/history', {
        page: String(page),
        limit: '20',
      })
      setHistory(res.data)
      setPagination(res.pagination)
    } catch {
      toast({ title: t('historyLoadError'), description: t('historyLoadErrorDesc'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchAnalysis = useCallback(async () => {
    try {
      const res = await apiClient.get<{ distribution: DistributionItem[] }>(
        '/api/v1/compensation/analysis',
      )
      setDistribution(res.data.distribution ?? [])
    } catch {
      toast({ title: t('analysisLoadError'), description: t('analysisLoadErrorDesc'), variant: 'destructive' })
    }
  }, [toast])

  useEffect(() => {
    fetchHistory()
    fetchAnalysis()
  }, [fetchHistory, fetchAnalysis])

  // ─── Table Columns ───────────────────────────────────

  const columns: DataTableColumn<HistoryRow>[] = [
    { key: 'employeeName', header: t('employeeName') },
    { key: 'departmentName', header: t('department') },
    {
      key: 'changeType',
      header: t('changeType'),
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary/90 border border-primary/20">
          {CHANGE_TYPE_KEYS[row.changeType] ? t(CHANGE_TYPE_KEYS[row.changeType]) : row.changeType}
        </span>
      ),
    },
    {
      key: 'previousBaseSalary',
      header: t('previousSalary'),
      render: (row) => (
        <span className="text-sm text-muted-foreground">{formatCurrency(row.previousBaseSalary)}</span>
      ),
    },
    {
      key: 'newBaseSalary',
      header: t('changedSalary'),
      render: (row) => (
        <span className="text-sm font-medium">{formatCurrency(row.newBaseSalary)}</span>
      ),
    },
    {
      key: 'changePct',
      header: t('increaseRate'),
      render: (row) => {
        const pct = Number(row.changePct)
        const color = pct > 0 ? 'text-emerald-600' : pct < 0 ? 'text-destructive' : 'text-muted-foreground'
        return (
          <span className={`text-sm font-medium ${color}`}>
            {pct > 0 ? '+' : ''}
            {pct.toFixed(1)}%
          </span>
        )
      },
    },
    {
      key: 'effectiveDate',
      header: t('effectiveDate'),
      render: (row) =>
        new Date(row.effectiveDate).toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }),
    },
  ]

  // ─── Chart Data ──────────────────────────────────────

  const chartData = distribution.map((d) => ({
    ...d,
    label: COMPA_RATIO_CONFIG[d.band].label,
    color: COMPA_RATIO_CONFIG[d.band].color,
  }))

  return (
    <div className="space-y-6">
      {/* ─── Compa-Ratio 분포 차트 ─── */}
      {chartData.length > 0 && (
        <div className="bg-card rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">{t('compaRatioDistribution')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as (typeof chartData)[0]
                  return (
                    <div className="rounded-md border bg-card p-3 shadow-lg">
                      <p className="font-medium text-sm">{d.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.count}명 ({d.percentage.toFixed(1)}%)
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── 이력 테이블 ─── */}
      <div className="bg-card rounded-2xl shadow-sm">
        <div className="p-4">
          <h3 className="text-lg font-semibold text-foreground">{t('historyTitle')}</h3>
        </div>
        <DataTable<HistoryRow>
          columns={columns}
          data={history}
          pagination={pagination ?? undefined}
          onPageChange={fetchHistory}
          loading={loading}
          emptyMessage={t('noHistory')}
          rowKey={(row) => row.id}
        />
      </div>
    </div>
  )
}
