'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Gender Pay Gap Analytics Client
// 성별 급여 격차 분석: 그룹별 비교 + CSV 내보내기
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import {
  BarChart3,
  Loader2,
  Download,
  Users,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { TABLE_STYLES } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

interface GapBreakdown {
  group: string
  maleCount: number
  femaleCount: number
  maleAvgSalary: number
  femaleAvgSalary: number
  gapPercent: number
  maleAvgCompaRatio?: number | null
  femaleAvgCompaRatio?: number | null
}

interface GapSummary {
  totalMale: number
  totalFemale: number
  overallMaleAvg: number
  overallFemaleAvg: number
  overallGapPercent: number
}

interface GapData {
  summary: GapSummary
  breakdown: GapBreakdown[]
}

// ─── Constants ──────────────────────────────────────────────

const GROUP_BY_KEYS: Record<string, string> = {
  jobGrade: 'byJobGrade',
  jobCategory: 'byJobCategory',
  department: 'byDepartment',
}

// ─── Component ──────────────────────────────────────────────

export function GenderPayGapClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('analytics.genderPayGap')
  const tAnalytics = useTranslations('analytics.compensationPage')
  const [loading, setLoading] = useState(true)
  const [groupBy, setGroupBy] = useState<string>('jobGrade')
  const [year, setYear] = useState<string>('')
  const [data, setData] = useState<GapData | null>(null)
  const [exporting, setExporting] = useState(false)

  // ─── Fetch ─────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = { groupBy }
      if (year) params.year = year
      const res = await apiClient.get<GapData>('/api/v1/analytics/gender-pay-gap', params)
      setData(res.data)
    } catch (err) {
      toast({ title: t('loadError'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
    setLoading(false)
  }, [groupBy, year])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Export CSV ────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({ groupBy })
      if (year) params.set('year', year)
      const res = await fetch(`/api/v1/analytics/gender-pay-gap/export?${params}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gender-pay-gap-${groupBy}${year ? `-${year}` : ''}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast({ title: t('exportError'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
    setExporting(false)
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount)

  const getGapColor = (gap: number) => {
    if (Math.abs(gap) <= 5) return 'text-emerald-600'
    if (Math.abs(gap) <= 15) return 'text-amber-600'
    return 'text-destructive'
  }

  const getGapBadge = (gap: number) => {
    if (Math.abs(gap) <= 5) return 'bg-emerald-500/15 text-emerald-700 border-emerald-200'
    if (Math.abs(gap) <= 15) return 'bg-amber-500/15 text-amber-700 border-amber-300'
    return 'bg-destructive/10 text-destructive border-destructive/20'
  }

  // ─── Render ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(GROUP_BY_KEYS).map(([k, labelKey]) => (
                <SelectItem key={k} value={k}>{t(labelKey)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year || 'ALL'} onValueChange={(v) => setYear(v === 'ALL' ? '' : v)}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder={t('allYears')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('allYears')}</SelectItem>
              {[2024, 2025, 2026].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}{t('yearSuffix')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
            {t('csvExport')}
          </Button>
        </div>
      </div>

      {data && (
        <>
          {/* Summary KPI */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card className="">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-primary" />
                  <p className="text-xs text-muted-foreground">{t('maleCount')}</p>
                </div>
                <p className="text-3xl font-bold text-foreground">{data.summary.totalMale}</p>
              </CardContent>
            </Card>
            <Card className="">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-pink-400" />
                  <p className="text-xs text-muted-foreground">{t('femaleCount')}</p>
                </div>
                <p className="text-3xl font-bold text-foreground">{data.summary.totalFemale}</p>
              </CardContent>
            </Card>
            <Card className="">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground mb-1">{t('maleAvgSalary')}</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(data.summary.overallMaleAvg)}</p>
              </CardContent>
            </Card>
            <Card className="">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground mb-1">{t('femaleAvgSalary')}</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(data.summary.overallFemaleAvg)}</p>
              </CardContent>
            </Card>
            <Card className={Math.abs(data.summary.overallGapPercent) > 15 ? 'bg-destructive/5' : Math.abs(data.summary.overallGapPercent) > 5 ? 'bg-amber-500/5' : 'bg-emerald-500/5'}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  {Math.abs(data.summary.overallGapPercent) > 15 ? (
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  ) : data.summary.overallGapPercent > 0 ? (
                    <TrendingDown className="w-4 h-4 text-amber-500" />
                  ) : (
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  )}
                  <p className="text-xs text-muted-foreground">{t('overallGap')}</p>
                </div>
                <p className={`text-3xl font-bold ${getGapColor(data.summary.overallGapPercent)}`}>
                  {data.summary.overallGapPercent.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown Table */}
          <Card className="">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                {t('detailAnalysis', { group: t(GROUP_BY_KEYS[groupBy]) })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.breakdown.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="overflow-x-auto">
                  <table className={TABLE_STYLES.table}>
                    <thead className={TABLE_STYLES.header}>
                      <tr>
                        <th className={TABLE_STYLES.headerCell}>{t('group')}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{t('malePersons')}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{t('femalePersons')}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{t('maleAvg')}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{t('femaleAvg')}</th>
                        <th className={TABLE_STYLES.headerCell}>{t('gap')}</th>
                        <th className={TABLE_STYLES.headerCell}>{t('gapVisualization')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.breakdown.map((row) => {
                        const maxSalary = Math.max(row.maleAvgSalary, row.femaleAvgSalary, 1)
                        const maleWidth = (row.maleAvgSalary / maxSalary) * 100
                        const femaleWidth = (row.femaleAvgSalary / maxSalary) * 100
                        return (
                          <tr key={row.group} className={TABLE_STYLES.row}>
                            <td className={TABLE_STYLES.cell}>{row.group}</td>
                            <td className={TABLE_STYLES.cellRight}>{row.maleCount}</td>
                            <td className={TABLE_STYLES.cellRight}>{row.femaleCount}</td>
                            <td className={TABLE_STYLES.cellRight}>{formatCurrency(row.maleAvgSalary)}</td>
                            <td className={TABLE_STYLES.cellRight}>{formatCurrency(row.femaleAvgSalary)}</td>
                            <td className={TABLE_STYLES.cell}>
                              <Badge className={getGapBadge(row.gapPercent)}>
                                {row.gapPercent > 0 ? '+' : ''}{row.gapPercent.toFixed(1)}%
                              </Badge>
                            </td>
                            <td className={TABLE_STYLES.cell}>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-primary w-4">M</span>
                                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary rounded-full"
                                      style={{ width: `${maleWidth}%` }}
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-pink-500 w-4">F</span>
                                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-pink-400 rounded-full"
                                      style={{ width: `${femaleWidth}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Compa-Ratio Comparison (if available) */}
          {data.breakdown.some((b) => b.maleAvgCompaRatio != null || b.femaleAvgCompaRatio != null) && (
            <Card className="">
              <CardHeader>
                <CardTitle className="text-base font-semibold">{tAnalytics('compaRatioComparison')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className={TABLE_STYLES.table}>
                    <thead className={TABLE_STYLES.header}>
                      <tr>
                        <th className={TABLE_STYLES.headerCell}>{t('group')}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{t('maleCompaRatio')}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{t('femaleCompaRatio')}</th>
                        <th className={TABLE_STYLES.headerCell}>{t('difference')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.breakdown
                        .filter((b) => b.maleAvgCompaRatio != null || b.femaleAvgCompaRatio != null)
                        .map((row) => {
                          const diff =
                            row.maleAvgCompaRatio != null && row.femaleAvgCompaRatio != null
                              ? ((row.maleAvgCompaRatio - row.femaleAvgCompaRatio) * 100).toFixed(1)
                              : '-'
                          return (
                            <tr key={row.group} className={TABLE_STYLES.row}>
                              <td className={TABLE_STYLES.cell}>{row.group}</td>
                              <td className={TABLE_STYLES.cellRight}>
                                {row.maleAvgCompaRatio != null ? `${(row.maleAvgCompaRatio * 100).toFixed(1)}%` : '-'}
                              </td>
                              <td className={TABLE_STYLES.cellRight}>
                                {row.femaleAvgCompaRatio != null ? `${(row.femaleAvgCompaRatio * 100).toFixed(1)}%` : '-'}
                              </td>
                              <td className={TABLE_STYLES.cell}>
                                {diff !== '-' && (
                                  <div className="flex justify-center">
                                    <span className={Number(diff) > 0 ? 'text-destructive' : 'text-emerald-600'}>
                                      {Number(diff) > 0 ? '+' : ''}{diff}%p
                                    </span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
