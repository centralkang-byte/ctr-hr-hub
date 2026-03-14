'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
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

const GROUP_BY_LABELS: Record<string, string> = {
  jobGrade: '직급별',
  jobCategory: '직무별',
  department: '부서별',
}

// ─── Component ──────────────────────────────────────────────

export function GenderPayGapClient({ user: _user }: { user: SessionUser }) {
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
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
    setExporting(false)
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount)

  const getGapColor = (gap: number) => {
    if (Math.abs(gap) <= 5) return 'text-[#059669]'
    if (Math.abs(gap) <= 15) return 'text-[#D97706]'
    return 'text-[#DC2626]'
  }

  const getGapBadge = (gap: number) => {
    if (Math.abs(gap) <= 5) return 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]'
    if (Math.abs(gap) <= 15) return 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]'
    return 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]'
  }

  // ─── Render ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#5E81F4]" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('genderPayGapTitle')}</h1>
          <p className="text-sm text-[#666] mt-1">직급·직무·부서별 성별 보상 비교 분석</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(GROUP_BY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year || 'ALL'} onValueChange={(v) => setYear(v === 'ALL' ? '' : v)}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder={tCommon('filterAllYears')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">전체</SelectItem>
              {[2024, 2025, 2026].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
            CSV 내보내기
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
                  <Users className="w-4 h-4 text-[#5E81F4]" />
                  <p className="text-xs text-[#666]">남성 인원</p>
                </div>
                <p className="text-3xl font-bold text-[#1A1A1A]">{data.summary.totalMale}명</p>
              </CardContent>
            </Card>
            <Card className="">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-[#F472B6]" />
                  <p className="text-xs text-[#666]">여성 인원</p>
                </div>
                <p className="text-3xl font-bold text-[#1A1A1A]">{data.summary.totalFemale}명</p>
              </CardContent>
            </Card>
            <Card className="">
              <CardContent className="p-5">
                <p className="text-xs text-[#666] mb-1">남성 평균 급여</p>
                <p className="text-2xl font-bold text-[#1A1A1A]">{formatCurrency(data.summary.overallMaleAvg)}</p>
              </CardContent>
            </Card>
            <Card className="">
              <CardContent className="p-5">
                <p className="text-xs text-[#666] mb-1">여성 평균 급여</p>
                <p className="text-2xl font-bold text-[#1A1A1A]">{formatCurrency(data.summary.overallFemaleAvg)}</p>
              </CardContent>
            </Card>
            <Card className="border-2" style={{ borderColor: Math.abs(data.summary.overallGapPercent) > 15 ? '#FCA5A5' : Math.abs(data.summary.overallGapPercent) > 5 ? '#FCD34D' : '#6EE7B7' }}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  {Math.abs(data.summary.overallGapPercent) > 15 ? (
                    <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                  ) : data.summary.overallGapPercent > 0 ? (
                    <TrendingDown className="w-4 h-4 text-[#F59E0B]" />
                  ) : (
                    <TrendingUp className="w-4 h-4 text-[#059669]" />
                  )}
                  <p className="text-xs text-[#666]">전체 격차</p>
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
                <BarChart3 className="w-5 h-5 text-[#5E81F4]" />
                {GROUP_BY_LABELS[groupBy]} 상세 분석
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.breakdown.length === 0 ? (
                <EmptyState title="데이터가 없습니다" description="조건을 변경하거나 새로운 데이터를 추가해보세요." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={TABLE_STYLES.header}>
                        <th className={TABLE_STYLES.headerCell}>그룹</th>
                        <th className={TABLE_STYLES.headerCellRight}>남성 (명)</th>
                        <th className={TABLE_STYLES.headerCellRight}>여성 (명)</th>
                        <th className={TABLE_STYLES.headerCellRight}>남성 평균</th>
                        <th className={TABLE_STYLES.headerCellRight}>여성 평균</th>
                        <th className={TABLE_STYLES.headerCell}>격차</th>
                        <th className={TABLE_STYLES.headerCell}>격차 시각화</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.breakdown.map((row) => {
                        const maxSalary = Math.max(row.maleAvgSalary, row.femaleAvgSalary, 1)
                        const maleWidth = (row.maleAvgSalary / maxSalary) * 100
                        const femaleWidth = (row.femaleAvgSalary / maxSalary) * 100
                        return (
                          <tr key={row.group} className={TABLE_STYLES.header}>
                            <td className="px-4 py-3 font-medium">{row.group}</td>
                            <td className="px-4 py-3 text-right">{row.maleCount}</td>
                            <td className="px-4 py-3 text-right">{row.femaleCount}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(row.maleAvgSalary)}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(row.femaleAvgSalary)}</td>
                            <td className="px-4 py-3 text-center">
                              <Badge className={getGapBadge(row.gapPercent)}>
                                {row.gapPercent > 0 ? '+' : ''}{row.gapPercent.toFixed(1)}%
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-[#5E81F4] w-4">M</span>
                                  <div className="flex-1 h-3 bg-[#F5F5F5] rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[#5E81F4] rounded-full"
                                      style={{ width: `${maleWidth}%` }}
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-[#EC4899] w-4">F</span>
                                  <div className="flex-1 h-3 bg-[#F5F5F5] rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[#F472B6] rounded-full"
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
                <CardTitle className="text-base font-semibold">Compa-Ratio 비교</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={TABLE_STYLES.header}>
                        <th className={TABLE_STYLES.headerCell}>그룹</th>
                        <th className={TABLE_STYLES.headerCellRight}>남성 Compa-Ratio</th>
                        <th className={TABLE_STYLES.headerCellRight}>여성 Compa-Ratio</th>
                        <th className={TABLE_STYLES.headerCell}>차이</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.breakdown
                        .filter((b) => b.maleAvgCompaRatio != null || b.femaleAvgCompaRatio != null)
                        .map((row) => {
                          const diff =
                            row.maleAvgCompaRatio != null && row.femaleAvgCompaRatio != null
                              ? ((row.maleAvgCompaRatio - row.femaleAvgCompaRatio) * 100).toFixed(1)
                              : '-'
                          return (
                            <tr key={row.group} className={TABLE_STYLES.header}>
                              <td className="px-4 py-3 font-medium">{row.group}</td>
                              <td className="px-4 py-3 text-right">
                                {row.maleAvgCompaRatio != null ? `${(row.maleAvgCompaRatio * 100).toFixed(1)}%` : '-'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {row.femaleAvgCompaRatio != null ? `${(row.femaleAvgCompaRatio * 100).toFixed(1)}%` : '-'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {diff !== '-' && (
                                  <span className={Number(diff) > 0 ? 'text-[#DC2626]' : 'text-[#059669]'}>
                                    {Number(diff) > 0 ? '+' : ''}{diff}%p
                                  </span>
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
