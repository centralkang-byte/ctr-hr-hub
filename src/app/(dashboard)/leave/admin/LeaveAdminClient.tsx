'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Admin Dashboard (F-3 Enhanced)
// 휴가 관리 (관리자): KPI, 부서별 사용률, 잔여 분포,
// 소진 예측, 마이너스 현황, 일괄 부여
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/PageHeader'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { TABLE_STYLES, CHART_THEME } from '@/lib/styles'
import { cn } from '@/lib/utils'
import type { SessionUser } from '@/types'
import {
  CalendarDays,
  TrendingUp,
  AlertTriangle,
  Clock,
  Users,
  BarChart3,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────

interface DepartmentUsage {
  department: string
  usageRate: number
  headcount: number
  totalGranted: number
  totalUsed: number
}

interface DistributionBucket {
  range: string
  count: number
}

interface ForecastPoint {
  month: string
  actual: number | null
  projected: number
}

interface NegativeEmployee {
  employeeId: string
  name: string
  department: string
  negativeDays: number
  limit: number
}

interface LeaveAdminStats {
  year: number
  kpi: {
    usageRate: number
    avgRemainingDays: number
    negativeCount: number
    negativeTotalDays: number
    pendingCount: number
    employeeCount: number
    totalGranted: number
    totalUsed: number
  }
  usageByDepartment: DepartmentUsage[]
  remainingDistribution: DistributionBucket[]
  burndownForecast: ForecastPoint[]
  yearEndProjection: {
    usageRate: number
    unusedRate: number
  }
  negativeBalanceEmployees: NegativeEmployee[]
}

interface LeavePolicyOption {
  id: string
  name: string
}

interface DepartmentOption {
  id: string
  name: string
}

// ─── Constants ──────────────────────────────────────────────

function getDeptColor(index: number): string {
  return CHART_THEME.colors[index % CHART_THEME.colors.length]
}

function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear()
  const years: number[] = []
  for (let y = 2024; y <= currentYear + 1; y++) years.push(y)
  return years
}

// ─── Component ──────────────────────────────────────────────

export function LeaveAdminClient({ user }: { user: SessionUser }) {
  void user

  const t = useTranslations('leave')
  const tc = useTranslations('common')
  const currentYear = new Date().getFullYear()

  const [year, setYear] = useState(String(currentYear))
  const [data, setData] = useState<LeaveAdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Bulk grant dialog
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [policies, setPolicies] = useState<LeavePolicyOption[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [bulkForm, setBulkForm] = useState({
    policyId: '',
    year: String(currentYear),
    days: '',
    departmentId: '',
  })
  const [bulkLoading, setBulkLoading] = useState(false)

  // ─── Fetch Stats ───

  const fetchStats = useCallback(async (y: string) => {
    setLoading(true)
    try {
      const res = await apiClient.get<LeaveAdminStats>('/api/v1/leave/admin/stats', {
        year: y,
      })
      setData(res.data)
    } catch (err) {
      toast({ title: t('admin.loadError'), description: err instanceof Error ? err.message : tc('retry'), variant: 'destructive' })
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [t, tc])

  useEffect(() => {
    void fetchStats(year)
  }, [year, fetchStats])

  // ─── Bulk Grant ───

  const fetchBulkOptions = useCallback(async () => {
    try {
      const [pRes, dRes] = await Promise.all([
        apiClient.get<LeavePolicyOption[]>('/api/v1/leave/policies'),
        apiClient.get<DepartmentOption[]>('/api/v1/org/departments'),
      ])
      setPolicies(pRes.data ?? [])
      setDepartments(dRes.data ?? [])
    } catch (err) {
      toast({ title: t('admin.loadError'), description: err instanceof Error ? err.message : tc('retry'), variant: 'destructive' })
      setPolicies([])
      setDepartments([])
    }
  }, [])

  const openBulkDialog = useCallback(() => {
    setBulkForm({ policyId: '', year, days: '', departmentId: '' })
    setBulkDialogOpen(true)
    void fetchBulkOptions()
  }, [year, fetchBulkOptions])

  const handleBulkGrant = useCallback(async () => {
    if (!bulkForm.policyId || !bulkForm.departmentId || !bulkForm.days) return
    setBulkLoading(true)
    try {
      const empRes = await apiClient.get<{ id: string }[]>('/api/v1/employees', {
        departmentId: bulkForm.departmentId,
        limit: 500,
      })
      const employeeIds = (empRes.data ?? []).map((e) => e.id)
      if (employeeIds.length === 0) { setBulkLoading(false); return }

      await apiClient.post('/api/v1/leave/bulk-grant', {
        policyId: bulkForm.policyId,
        year: Number(bulkForm.year),
        employeeIds,
        days: Number(bulkForm.days),
      })

      setBulkDialogOpen(false)
      void fetchStats(year)
      toast({ title: tc('success'), description: t('admin.bulk.success', { count: employeeIds.length }) })
    } catch (error) {
      console.error('[LeaveAdmin] Bulk grant failed:', error)
      toast({ title: tc('error'), description: t('admin.loadError'), variant: 'destructive' })
    } finally {
      setBulkLoading(false)
    }
  }, [bulkForm, year, fetchStats, t, tc])

  // ─── Loading ───

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Skeleton className="h-28" /><Skeleton className="h-28" />
          <Skeleton className="h-28" /><Skeleton className="h-28" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" /><Skeleton className="h-80" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const kpi = data?.kpi ?? {
    usageRate: 0, avgRemainingDays: 0, negativeCount: 0,
    negativeTotalDays: 0, pendingCount: 0, employeeCount: 0,
    totalGranted: 0, totalUsed: 0,
  }
  const deptUsage = data?.usageByDepartment ?? []
  const distribution = data?.remainingDistribution ?? []
  const forecast = data?.burndownForecast ?? []
  const negativeEmps = data?.negativeBalanceEmployees ?? []
  const yearEndProjection = data?.yearEndProjection

  // Determine if there is any meaningful data to display
  const hasData = data !== null && (
    kpi.employeeCount > 0 ||
    deptUsage.length > 0 ||
    distribution.length > 0 ||
    forecast.length > 0 ||
    negativeEmps.length > 0
  )

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={t('admin.title')}
        description={t('admin.description')}
        actions={
          <div className="flex items-center gap-3">
            {/* Year Selector */}
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-28 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getYearOptions().map((y) => (
                  <SelectItem key={y} value={String(y)}>{t('admin.yearSuffix', { year: y })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openBulkDialog} className="bg-primary hover:bg-primary/90 text-white">
              {t('admin.bulkGrant')}
            </Button>
          </div>
        }
      />

      {/* ═══ Empty state — only show when no data at all ═══ */}
      {!hasData && (
        <Card className="bg-card">
          <CardContent className="py-16 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">{t('admin.emptyTitle')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('admin.emptyDescription')}</p>
          </CardContent>
        </Card>
      )}

      {/* ═══ KPI Cards ═══ */}
      {hasData && <><div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {/* Usage Rate */}
        <Card className="border-l-4 border-l-[#5E81F4] bg-card">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground font-medium">{t('admin.usageRate')}</p>
            </div>
            <p className="text-3xl font-bold text-foreground tracking-tight">{kpi.usageRate}%</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {kpi.totalUsed.toFixed(1)} / {t('admin.daysSuffix', { days: kpi.totalGranted.toFixed(1) })}
            </p>
          </CardContent>
        </Card>

        {/* Avg Remaining */}
        <Card className="border-l-4 border-l-[#10B981] bg-card">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="h-4 w-4 text-emerald-500" />
              <p className="text-xs text-muted-foreground font-medium">{t('admin.avgRemaining')}</p>
            </div>
            <p className="text-3xl font-bold text-foreground tracking-tight">{t('admin.daysSuffix', { days: kpi.avgRemainingDays })}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {t('admin.employeeBasis', { count: kpi.employeeCount })}
            </p>
          </CardContent>
        </Card>

        {/* Negative Balance */}
        <Card className={`border-l-4 bg-card ${kpi.negativeCount > 0 ? 'border-l-[#EF4444]' : 'border-l-[#E8E8E8]'}`}>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`h-4 w-4 ${kpi.negativeCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
              <p className="text-xs text-muted-foreground font-medium">{t('admin.negativeStatus')}</p>
            </div>
            <p className={`text-3xl font-bold tracking-tight ${kpi.negativeCount > 0 ? 'text-red-500' : 'text-foreground'}`}>
              {t('admin.personSuffix', { count: kpi.negativeCount })}
            </p>
            {kpi.negativeCount > 0 && (
              <p className="text-[10px] text-red-500 font-medium mt-1">
                {t('admin.excessUsage', { days: Math.abs(kpi.negativeTotalDays) })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pending */}
        <Card className={`border-l-4 bg-card ${kpi.pendingCount > 0 ? 'border-l-[#F59E0B]' : 'border-l-[#E8E8E8]'}`}>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className={`h-4 w-4 ${kpi.pendingCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
              <p className="text-xs text-muted-foreground font-medium">{t('admin.pendingApproval')}</p>
            </div>
            <p className={`text-3xl font-bold tracking-tight ${kpi.pendingCount > 0 ? 'text-amber-500' : 'text-foreground'}`}>
              {t('admin.caseSuffix', { count: kpi.pendingCount })}
            </p>
            {kpi.pendingCount > 0 && (
              <p className="text-[10px] text-orange-800 font-medium mt-1">{t('admin.actionRequired')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Charts Row 1: Department + Distribution ═══ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Department Usage Bar Chart */}
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold text-foreground">{t('admin.deptUsageRate')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {deptUsage.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('admin.noData')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, deptUsage.length * 40)}>
                <BarChart layout="vertical" data={deptUsage} margin={{ left: 8, right: 24 }}>
                  <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} fontSize={11} />
                  <YAxis type="category" dataKey="department" width={100} fontSize={11} tick={{ fill: '#1C1D21' }} />
                  <Tooltip
                    formatter={(value) => [`${value ?? 0}%`, t('admin.usageRateLabel')]}
                    contentStyle={{ borderRadius: 8, border: '1px solid #E8EBFF', fontSize: 12 }}
                  />
                  <Bar dataKey="usageRate" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {deptUsage.map((_, i) => (
                      <Cell key={i} fill={getDeptColor(i)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Remaining Days Distribution */}
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-500" />
              <CardTitle className="text-sm font-bold text-foreground">{t('admin.remainingDist')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {distribution.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('admin.noData')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={distribution} margin={{ bottom: 8 }}>
                  <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                  <XAxis dataKey="range" fontSize={11} tick={{ fill: '#1C1D21' }} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip
                    formatter={(value) => [`${value ?? 0}`, t('admin.headcountLabel')]}
                    contentStyle={{ borderRadius: 8, border: '1px solid #E8EBFF', fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill={CHART_THEME.colors[1]} radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Charts Row 2: Burn-down Forecast ═══ */}
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <CardTitle className="text-sm font-bold text-foreground">{t('admin.burndownForecast')}</CardTitle>
            </div>
            {yearEndProjection && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  yearEndProjection.unusedRate > 30
                    ? 'border-red-500 text-red-500 bg-destructive/5'
                    : 'border-emerald-500 text-emerald-500 bg-tertiary-container/10'
                }`}
              >
                {t('admin.yearEndUnused', { rate: yearEndProjection.unusedRate.toFixed(1) })}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {forecast.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('admin.noData')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={forecast}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis
                  dataKey="month"
                  fontSize={11}
                  tickFormatter={(v: string) => t('admin.monthSuffix', { month: v.split('-')[1] })}
                />
                <YAxis fontSize={11} />
                <Tooltip
                  labelFormatter={(v) => t('admin.monthSuffix', { month: String(v).split('-')[1] })}
                  contentStyle={{ borderRadius: 8, border: '1px solid #E8EBFF', fontSize: 12 }}
                />
                <Legend iconType="circle" iconSize={8} />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke={CHART_THEME.colors[0]}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#5E81F4' }}
                  name={t('admin.actualUsage')}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="projected"
                  stroke="#8181A5"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  name={t('admin.projected')}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ═══ Negative Balance Table ═══ */}
      {negativeEmps.length > 0 && (
        <Card className="bg-card border-destructive/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <CardTitle className="text-sm font-bold text-red-500">
                {t('admin.negativeTable')} ({t('admin.personSuffix', { count: negativeEmps.length })})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className={TABLE_STYLES.wrapper}>
              <table className={TABLE_STYLES.table}>
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    <th className={TABLE_STYLES.headerCell}>{t('admin.employeeName')}</th>
                    <th className={TABLE_STYLES.headerCell}>{t('admin.department')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('admin.negativeDays')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('admin.limit')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('admin.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {negativeEmps.map((emp) => {
                    const atLimit = Math.abs(emp.negativeDays) >= Math.abs(emp.limit)
                    return (
                      <tr key={emp.employeeId} className={TABLE_STYLES.row}>
                        <td className={cn(TABLE_STYLES.cell, "font-medium text-foreground")}>{emp.name}</td>
                        <td className={cn(TABLE_STYLES.cell, "text-muted-foreground")}>{emp.department}</td>
                        <td className={cn(TABLE_STYLES.cell, "text-right font-semibold text-red-500")}>
                          {t('admin.daysSuffix', { days: emp.negativeDays.toFixed(1) })}
                        </td>
                        <td className={cn(TABLE_STYLES.cell, "text-right text-muted-foreground")}>
                          {t('admin.daysSuffix', { days: emp.limit.toFixed(1) })}
                        </td>
                        <td className={cn(TABLE_STYLES.cell, "text-center")}>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              atLimit
                                ? 'border-red-500 text-red-500 bg-destructive/5'
                                : 'border-amber-500 text-amber-500 bg-amber-500/10'
                            }`}
                          >
                            {atLimit ? t('admin.limitReached') : t('admin.withinLimit')}
                          </Badge>
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
      </>}

      {/* ═══ Bulk Grant Dialog ═══ */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('admin.bulk.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('admin.bulk.policy')}</Label>
              <Select value={bulkForm.policyId} onValueChange={(v) => setBulkForm((f) => ({ ...f, policyId: v }))}>
                <SelectTrigger><SelectValue placeholder={tc('selectPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {policies.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('admin.bulk.department')}</Label>
              <Select value={bulkForm.departmentId} onValueChange={(v) => setBulkForm((f) => ({ ...f, departmentId: v }))}>
                <SelectTrigger><SelectValue placeholder={tc('selectPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('admin.bulk.year')}</Label>
                <Input type="number" value={bulkForm.year} onChange={(e) => setBulkForm((f) => ({ ...f, year: e.target.value }))} min={2024} max={currentYear + 1} />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.bulk.days')}</Label>
                <Input type="number" value={bulkForm.days} onChange={(e) => setBulkForm((f) => ({ ...f, days: e.target.value }))} min={0} step={0.5} placeholder={t('admin.bulk.daysPlaceholder')} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>{tc('cancel')}</Button>
            <Button
              onClick={handleBulkGrant}
              disabled={bulkLoading || !bulkForm.policyId || !bulkForm.departmentId || !bulkForm.days}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {bulkLoading ? t('admin.bulk.processing') : t('admin.bulkGrant')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
