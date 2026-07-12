'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Fragment, useState, useEffect, useRef, useCallback } from 'react'
import { Calculator, Search, X, ChevronDown, ChevronRight, Download, Loader2, History, Save } from 'lucide-react'
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { TABLE_STYLES, CHART_THEME, TYPOGRAPHY, BUTTON_VARIANTS, BUTTON_SIZES } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import type {
  Company, Department, SimMode, BulkTargetType,
  SearchEmployee, SimResponse, EmployeeSimResult,
  SaveScenarioPayload, ScenarioDetail, SaveableMode,
} from './types'
import PayBandChart from '@/components/compensation/PayBandChart'
import DifferentialTab from './DifferentialTab'
import CompaRatioTab from './CompaRatioTab'
import HiringTab from './HiringTab'
import FxTab from './FxTab'
import SaveScenarioDialog from './SaveScenarioDialog'
import ScenarioListSheet from './ScenarioListSheet'
import ScenarioCompareView from './ScenarioCompareView'

import { fmtN, fmtKRW, fmtCompactKRW, signedKRW, pctStr, diffColor, diffArrow } from './formatters'

// ─── Constants ───────────────────────────────────────────

// Wave 1: 카드 = 1px solid border (Wave 0 표준 — CARD_STYLES.padded는 보더가 없어 직접 정의)
const PANEL_CARD = 'rounded-2xl border border-border bg-card p-6 shadow-sm'

// ─── KPI Card (proto .kpi: 1px 보더 + 12px label + tnum 대형 수치) ─

function KPICard({ label, value, diff, rate, variant }: {
  label: string; value: string; diff?: string; rate?: string
  variant?: 'neutral' | 'cost' | 'auto'
}) {
  const badgeColor = !rate ? '' :
    variant === 'cost' ? 'bg-destructive/10 text-destructive' :
      rate.startsWith('-') ? 'bg-tertiary/10 text-[#006b39]' : 'bg-primary/5 text-primary'

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {/* proto .kpi .val 28px/700 tnum은 compact 표기 전제 — 풀 정밀 KRW(9+자리)는 2xl 4-col에서도 넘쳐 22px 고정 (의도적 편차) */}
      <p className="text-[22px] font-bold leading-tight tracking-[-0.025em] tabular-nums text-foreground">{value}</p>
      {(rate || diff) && (
        <div className="flex flex-wrap items-center gap-2">
          {rate && (
            <span className={cn('inline-flex w-fit items-center rounded-[5px] px-1.5 py-px text-[11px] font-semibold', badgeColor)}>
              {rate}
            </span>
          )}
          {diff && <span className={cn('text-xs', diffColor(parseFloat(diff.replace(/[^-\d.]/g, ''))))}>{diff}</span>}
        </div>
      )}
    </div>
  )
}

// ─── BULK 비교 차트 데이터 (순수 헬퍼) ────────────────────
// Codex G1 교정: 적용월 입력이 없는 현 API에서 프로토의 12개월 추이는 가공
// 데이터가 됨 (bonusMonths 일시금이 월 반복처럼 보임) → '현재 월 vs 시뮬레이션 월'
// 2-막대 정직 비교로 축소 (프로토 12-bar 대비 의도적 편차).

function buildBulkCompareData(
  totals: { currentGross: number; simulatedGross: number },
  labels: { current: string; simulated: string },
) {
  return [
    { name: labels.current, amount: totals.currentGross },
    { name: labels.simulated, amount: totals.simulatedGross },
  ]
}

// ─── Expandable Row ──────────────────────────────────────

function DetailRow({ label, c, s, locale }: { label: string; c: number; s: number; locale: string }) {
  const d = s - c
  return (
    <tr className={TABLE_STYLES.row}>
      <td className={TABLE_STYLES.cell}>{label}</td>
      <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums")}>{fmtKRW(c, locale)}</td>
      <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums")}>{fmtKRW(s, locale)}</td>
      <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums", diffColor(d))}>{signedKRW(d, locale)}</td>
    </tr>
  )
}

function EmployeeExpandedDetail({ emp, t, locale }: {
  emp: EmployeeSimResult
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string
  locale: string
}) {
  const c = emp.current
  const s = emp.simulated
  return (
    <tr>
      <td colSpan={7} className="p-0 border-b border-border bg-background">
        <div className="px-6 py-4">
          <div className={TABLE_STYLES.wrapper}>
            <table className={TABLE_STYLES.table}>
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell}>{t('sim.col.item')}</th>
                  <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('sim.col.currentSalary')}</th>
                  <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('sim.col.simulated')}</th>
                  <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('sim.col.diff')}</th>
                </tr>
              </thead>
              <tbody>
                <DetailRow label={t('basePay')} c={c.baseSalary} s={s.baseSalary} locale={locale} />
                <DetailRow label={t('overtimePay')} c={c.overtimePay} s={s.overtimePay} locale={locale} />
                <DetailRow label={t('nightPay')} c={c.nightPay} s={s.nightPay} locale={locale} />
                <DetailRow label={t('mealAllowance')} c={c.mealAllowance} s={s.mealAllowance} locale={locale} />
                <DetailRow label={t('transportAllowance')} c={c.transportAllowance} s={s.transportAllowance} locale={locale} />
                <tr className={cn(TABLE_STYLES.row, "bg-background font-semibold")}>
                  <td className={TABLE_STYLES.cell}>{t('grossPay')}</td>
                  <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums")}>{fmtKRW(c.grossPay, locale)}</td>
                  <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums")}>{fmtKRW(s.grossPay, locale)}</td>
                  <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums", diffColor(s.grossPay - c.grossPay))}>{signedKRW(s.grossPay - c.grossPay, locale)}</td>
                </tr>
                <DetailRow label={t('nationalPension')} c={c.nationalPension} s={s.nationalPension} locale={locale} />
                <DetailRow label={t('healthInsurance')} c={c.healthInsurance} s={s.healthInsurance} locale={locale} />
                <DetailRow label={t('longTermCare')} c={c.longTermCare} s={s.longTermCare} locale={locale} />
                <DetailRow label={t('employmentInsurance')} c={c.employmentInsurance} s={s.employmentInsurance} locale={locale} />
                <DetailRow label={t('incomeTax')} c={c.incomeTax} s={s.incomeTax} locale={locale} />
                <DetailRow label={t('localIncomeTax')} c={c.localIncomeTax} s={s.localIncomeTax} locale={locale} />
                <tr className={cn(TABLE_STYLES.row, "bg-background font-semibold")}>
                  <td className={TABLE_STYLES.cell}>{t('totalDeductions')}</td>
                  <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums")}>{fmtKRW(c.totalDeductions, locale)}</td>
                  <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums")}>{fmtKRW(s.totalDeductions, locale)}</td>
                  <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums", diffColor(s.totalDeductions - c.totalDeductions))}>{signedKRW(s.totalDeductions - c.totalDeductions, locale)}</td>
                </tr>
                <tr className={cn(TABLE_STYLES.row, "bg-primary/5 font-bold")}>
                  <td className={TABLE_STYLES.cell}>{t('netPay')}</td>
                  <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums text-primary")}>{fmtKRW(c.netPay, locale)}</td>
                  <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums text-primary")}>{fmtKRW(s.netPay, locale)}</td>
                  <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums", diffColor(s.netPay - c.netPay))}>{signedKRW(s.netPay - c.netPay, locale)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ─── Main Component ──────────────────────────────────────

export default function PayrollSimulationClient({ user: _user, companies, departments }: {
  user: SessionUser; companies: Company[]; departments: Department[]
}) {
  const tCommon = useTranslations('common')
  const t = useTranslations('payroll')
  const locale = useLocale()
  const { toast } = useToast()
  const [mode, setMode] = useState<SimMode>('SINGLE')
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [result, setResult] = useState<SimResponse | null>(null)
  const [error, setError] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // 시나리오 저장/비교 state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [savePending, setSavePending] = useState<SaveScenarioPayload | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [scenarioSheetOpen, setScenarioSheetOpen] = useState(false)
  const [compareData, setCompareData] = useState<{ left: ScenarioDetail; right: ScenarioDetail } | null>(null)

  // Single mode state — salary band for PayBandChart
  const [salaryBandData, setSalaryBandData] = useState<{
    min: number; mid: number; max: number
  } | null>(null)

  const [selectedEmployee, setSelectedEmployee] = useState<SearchEmployee | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchEmployee[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [salaryMode, setSalaryMode] = useState<'override' | 'rate'>('rate')
  const [baseSalaryOverride, setBaseSalaryOverride] = useState(0)
  const [adjustRate, setAdjustRate] = useState(5)
  const [overtimeHours, setOvertimeHours] = useState(0)
  const [nightHours, setNightHours] = useState(0)
  const [holidayHours, setHolidayHours] = useState(0)
  const [bonusAmount, setBonusAmount] = useState(0)

  // Bulk mode state
  const [bulkTarget, setBulkTarget] = useState<BulkTargetType>('COMPANY')
  const [selectedCompanyId, setSelectedCompanyId] = useState(companies[0]?.id ?? '')
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [selectedEmployees, setSelectedEmployees] = useState<SearchEmployee[]>([])
  const [bulkRate, setBulkRate] = useState(3)
  const [bonusMonths, setBonusMonths] = useState(0)

  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Click outside to close dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Fetch salary band when employee is selected
  useEffect(() => {
    if (!selectedEmployee) { setSalaryBandData(null); return }
    apiClient.get<{
      salaryBand: { minSalary: number; midSalary: number; maxSalary: number } | null
    }>(`/api/v1/employees/${selectedEmployee.id}/compensation`)
      .then((res) => {
        const band = res.data.salaryBand
        if (band) setSalaryBandData({ min: band.minSalary, mid: band.midSalary, max: band.maxSalary })
        else setSalaryBandData(null)
      })
      .catch(() => setSalaryBandData(null))
  }, [selectedEmployee])

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (!q || (!/[\uAC00-\uD7A3]/.test(q) && q.length < 2)) {
      setSearchResults([]); return
    }
    try {
      const res = await apiClient.get<{ employees: SearchEmployee[] }>('/api/employees/search', { q, limit: 10 })
      setSearchResults(res.data.employees)
      setShowDropdown(true)
    } catch { setSearchResults([]) }
  }, [])

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 300)
  }

  const selectEmployee = (emp: SearchEmployee) => {
    if (mode === 'SINGLE') {
      setSelectedEmployee(emp)
      setSearchQuery('')
      setShowDropdown(false)
    } else {
      if (!selectedEmployees.find(e => e.id === emp.id)) {
        setSelectedEmployees(prev => [...prev, emp])
      }
      setSearchQuery('')
      setShowDropdown(false)
    }
  }

  const filteredDepts = departments.filter(d => d.companyId === selectedCompanyId)

  // 모드 전환 — result·compareData·expandedRow·에러 일괄 정리 (Codex G1)
  const handleModeChange = (value: string) => {
    setMode(value as SimMode)
    setResult(null)
    setCompareData(null)
    setExpandedRow(null)
    setError('')
  }

  // Build request body
  const buildBody = () => {
    if (mode === 'SINGLE') {
      if (!selectedEmployee) return null
      const params: Record<string, unknown> = {}
      if (salaryMode === 'override') params.baseSalaryOverride = baseSalaryOverride
      else params.baseSalaryAdjustRate = adjustRate / 100
      if (overtimeHours > 0) params.overtimeHours = overtimeHours
      if (nightHours > 0) params.nightHours = nightHours
      if (holidayHours > 0) params.holidayHours = holidayHours
      if (bonusAmount > 0) params.bonusAmount = bonusAmount
      return { mode: 'SINGLE', employeeId: selectedEmployee.id, parameters: params }
    }
    const target: Record<string, unknown> = { type: bulkTarget }
    if (bulkTarget === 'COMPANY') target.companyId = selectedCompanyId
    if (bulkTarget === 'DEPARTMENT') { target.companyId = selectedCompanyId; target.departmentId = selectedDeptId }
    if (bulkTarget === 'SELECTED') target.employeeIds = selectedEmployees.map(e => e.id)
    return {
      mode: 'BULK', target,
      parameters: { baseSalaryAdjustRate: bulkRate / 100, ...(bonusMonths > 0 ? { bonusMonths } : {}) },
    }
  }

  const isValid = mode === 'SINGLE'
    ? !!selectedEmployee
    : bulkTarget === 'SELECTED' ? selectedEmployees.length > 0 : !!selectedCompanyId

  const handleCalculate = async () => {
    const body = buildBody()
    if (!body) return
    setIsLoading(true); setError('')
    try {
      const res = await apiClient.post<SimResponse>('/api/v1/payroll/simulation', body)
      setResult(res.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : tCommon('errorDesc'))
    } finally { setIsLoading(false) }
  }

  const handleExcelDownload = async () => {
    const body = buildBody()
    if (!body) return
    setIsExporting(true)
    try {
      const response = await fetch('/api/v1/payroll/simulation/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `CTR_PayrollSimulation_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast({ title: t('simExportFail'), variant: 'destructive' })
    } finally { setIsExporting(false) }
  }

  // ─── 시나리오 저장 ─────────────────────────────────────
  const handleRequestSave = (payload: SaveScenarioPayload) => {
    setSavePending(payload)
    setSaveDialogOpen(true)
  }

  const handleSaveScenario = async (title: string, description: string) => {
    if (!savePending) return
    setIsSaving(true)
    try {
      await apiClient.post('/api/v1/payroll/simulation/scenarios', {
        ...savePending, title, description: description || undefined,
      })
      toast({ title: t('sim.scenarioSaved') })
      setSaveDialogOpen(false)
      setSavePending(null)
    } catch {
      toast({ title: t('sim.saveFailed'), variant: 'destructive' })
    } finally { setIsSaving(false) }
  }

  // SINGLE/BULK 저장 트리거
  const handleSaveSingleBulk = () => {
    if (!result) return
    handleRequestSave({
      mode: mode as SaveableMode,
      companyId: mode === 'BULK' ? selectedCompanyId : null,
      parameters: buildBody() as Record<string, unknown>,
      results: result as unknown as Record<string, unknown>,
    })
  }

  // ─── 시나리오 로드 ─────────────────────────────────────
  const handleLoadScenario = (scenario: ScenarioDetail) => {
    // 모드 전환 + 결과 복원 (parameters 복원은 각 탭에서 처리)
    setMode(scenario.mode as SimMode)
    setCompareData(null)
    // SINGLE/BULK 모드는 results를 직접 설정
    if (scenario.mode === 'SINGLE' || scenario.mode === 'BULK') {
      setResult(scenario.results as unknown as SimResponse)
    }
    // DIFFERENTIAL/HIRING/FX는 각 탭의 initialData prop으로 처리
  }

  // ─── 시나리오 비교 ─────────────────────────────────────
  const handleCompare = (left: ScenarioDetail, right: ScenarioDetail) => {
    setCompareData({ left, right })
  }

  const sm = result?.summary
  const totals = sm?.totals

  // Chart data for single mode
  const chartData = result && mode === 'SINGLE' && result.employees[0] ? (() => {
    const c = result.employees[0].current
    const s = result.employees[0].simulated
    return [
      { name: t('current'), basePay: c.baseSalary, allowance: c.overtimePay + c.mealAllowance + c.transportAllowance, bonus: c.bonusAmount },
      { name: t('simulated'), basePay: s.baseSalary, allowance: s.overtimePay + s.mealAllowance + s.transportAllowance, bonus: s.bonusAmount },
    ]
  })() : null

  // Bulk compare chart data (현재 월 vs 시뮬레이션 월 — 순수 헬퍼 파생)
  const bulkCompareData = result && mode === 'BULK' && totals
    ? buildBulkCompareData(totals, { current: t('simCurrentLabel'), simulated: t('simulated') })
    : null

  // ─── SINGLE / BULK 공유 패널 (TabsContent 2곳에서 렌더) ──
  const singleBulkPanel = (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* ─── Left Panel: Input ──────────────────────── */}
      <div className="space-y-4">
        {/* ─ SINGLE: Employee Search ─ */}
        {mode === 'SINGLE' && (
          <div className={cn(PANEL_CARD, 'space-y-3')}>
            <h3 className="text-sm font-semibold text-foreground">{t('targetEmployee')}</h3>
            {selectedEmployee ? (
              <div className="bg-muted rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedEmployee.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedEmployee.department} · {selectedEmployee.position} · {t('simCurrentLabel')} ₩{fmtN(selectedEmployee.currentSalary, locale)}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedEmployee(null)} aria-label={tCommon('delete')} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div ref={searchRef} className="relative">
                <div className="flex items-center border border-border rounded-lg px-3">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <input value={searchQuery} onChange={e => handleSearchChange(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    className="flex-1 px-2 py-2 text-sm outline-none bg-transparent" />
                </div>
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                    {searchResults.map(emp => (
                      <button type="button" key={emp.id} onClick={() => selectEmployee(emp)}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted text-sm border-b border-border last:border-0">
                        <span className="font-medium text-foreground">{emp.name}</span>
                        <span className="text-muted-foreground"> · {emp.department} · {emp.position}</span>
                        <span className="text-muted-foreground text-xs ml-1">({emp.employeeNo})</span>
                      </button>
                    ))}
                  </div>
                )}
                {showDropdown && searchResults.length === 0 && searchQuery.length >= 1 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 p-4 text-center text-sm text-muted-foreground">
                    {tCommon('noResults')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─ SINGLE: Parameters ─ */}
        {mode === 'SINGLE' && (
          <div className={cn(PANEL_CARD, 'space-y-3')}>
            <h3 className="text-sm font-semibold text-foreground">{t('baseSalary')}</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="radio" name="salaryMode" checked={salaryMode === 'rate'} onChange={() => setSalaryMode('rate')} />
                {t('adjustRate')}
              </label>
              {salaryMode === 'rate' && (
                <div className="ml-6 flex items-center gap-1">
                  <input type="number" value={adjustRate} onChange={e => setAdjustRate(Number(e.target.value))}
                    className="w-20 px-2 py-1.5 border border-border rounded text-sm text-right" min={-50} max={50} step={0.5} />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="radio" name="salaryMode" checked={salaryMode === 'override'} onChange={() => setSalaryMode('override')} />
                {t('amountOverride')}
              </label>
              {salaryMode === 'override' && (
                <div className="ml-6 flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">₩</span>
                  <input type="number" value={baseSalaryOverride} onChange={e => setBaseSalaryOverride(Number(e.target.value))}
                    className="w-32 px-2 py-1.5 border border-border rounded text-sm text-right" min={0} />
                </div>
              )}
            </div>
            <h3 className="text-sm font-semibold text-foreground pt-2">{t('workHoursOptional')}</h3>
            <div className="grid grid-cols-3 gap-2">
              {([[t('simOvertimeLabel'), overtimeHours, setOvertimeHours], [t('simNightLabel'), nightHours, setNightHours], [t('simHolidayLabel'), holidayHours, setHolidayHours]] as [string, number, (v: number) => void][]).map(([l, v, fn]) => (
                <div key={l}>
                  <label className="text-xs text-muted-foreground">{l}</label>
                  <div className="flex items-center gap-1">
                    <input type="number" value={v} onChange={e => fn(Number(e.target.value))}
                      className="w-full px-2 py-1.5 border border-border rounded text-sm text-right" min={0} max={52} />
                    <span className="text-xs text-muted-foreground">h</span>
                  </div>
                </div>
              ))}
            </div>
            <h3 className="text-sm font-semibold text-foreground pt-2">{t('bonusOptional')}</h3>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">₩</span>
              <input type="number" value={bonusAmount} onChange={e => setBonusAmount(Number(e.target.value))}
                className="w-32 px-2 py-1.5 border border-border rounded text-sm text-right" min={0} />
            </div>
          </div>
        )}

        {/* ─ BULK: Target ─ */}
        {mode === 'BULK' && (
          <div className={cn(PANEL_CARD, 'space-y-3')}>
            <h3 className="text-sm font-semibold text-foreground">{t('selectTarget')}</h3>
            {(['COMPANY', 'DEPARTMENT', 'SELECTED'] as BulkTargetType[]).map(bKey => (
              <div key={bKey}>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="radio" name="bulkTarget" checked={bulkTarget === bKey} onChange={() => setBulkTarget(bKey)} />
                  {bKey === 'COMPANY' ? t('wholeCompany') : bKey === 'DEPARTMENT' ? t('byDept') : t('selectEmployees')}
                </label>
                {bulkTarget === 'COMPANY' && bKey === 'COMPANY' && (
                  <select value={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)}
                    className="mt-1 ml-6 w-48 px-2 py-1.5 border border-border rounded text-sm">
                    {companies.map(c => <option key={c.id} value={c.id}>{c.code} ({c.name})</option>)}
                  </select>
                )}
                {bulkTarget === 'DEPARTMENT' && bKey === 'DEPARTMENT' && (
                  <div className="mt-1 ml-6 space-y-1">
                    <select value={selectedCompanyId} onChange={e => { setSelectedCompanyId(e.target.value); setSelectedDeptId('') }}
                      className="w-48 px-2 py-1.5 border border-border rounded text-sm">
                      {companies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                    </select>
                    <select value={selectedDeptId} onChange={e => setSelectedDeptId(e.target.value)}
                      className="w-48 px-2 py-1.5 border border-border rounded text-sm">
                      <option value="">{t('department_kec84a0ed')}</option>
                      {filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
                {bulkTarget === 'SELECTED' && bKey === 'SELECTED' && (
                  <div className="mt-2 ml-6 space-y-2">
                    <div ref={searchRef} className="relative">
                      <div className="flex items-center border border-border rounded px-2">
                        <Search className="w-3.5 h-3.5 text-muted-foreground" />
                        <input value={searchQuery} onChange={e => handleSearchChange(e.target.value)}
                          placeholder={tCommon('searchEmployee')} className="flex-1 px-2 py-1.5 text-sm outline-none bg-transparent" />
                      </div>
                      {showDropdown && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded shadow-lg z-20 max-h-40 overflow-y-auto">
                          {searchResults.map(emp => (
                            <button type="button" key={emp.id} onClick={() => selectEmployee(emp)}
                              className="w-full text-left px-2 py-1.5 hover:bg-muted text-xs border-b border-border last:border-0">
                              {emp.name} · {emp.department} ({emp.employeeNo})
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedEmployees.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedEmployees.map(e => (
                          <span key={e.id} className="inline-flex items-center px-2 py-1 bg-muted rounded text-xs text-foreground">
                            {e.name}
                            <button type="button" onClick={() => setSelectedEmployees(prev => prev.filter(p => p.id !== e.id))}
                              aria-label={tCommon('delete')}
                              className="ml-1 text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                        <p className="text-xs text-muted-foreground w-full mt-1">{selectedEmployees.length}{tCommon('unit.person')} {tCommon('selected')}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─ BULK: Parameters ─ */}
        {mode === 'BULK' && (
          <div className={cn(PANEL_CARD, 'space-y-3')}>
            <h3 className="text-sm font-semibold text-foreground">{t('adjustConditions')}</h3>
            <div>
              <label className="text-xs text-muted-foreground">{t('baseSalaryRate')}</label>
              <div className="flex items-center gap-1 mt-1">
                <input type="number" value={bulkRate} onChange={e => setBulkRate(Number(e.target.value))}
                  className="w-20 px-2 py-1.5 border border-border rounded text-sm text-right" min={-50} max={50} step={0.5} />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('bonusMonths')}</label>
              <div className="flex items-center gap-1 mt-1">
                <input type="number" value={bonusMonths} onChange={e => setBonusMonths(Number(e.target.value))}
                  className="w-20 px-2 py-1.5 border border-border rounded text-sm text-right" min={0} max={12} step={0.5} />
                <span className="text-sm text-muted-foreground">{tCommon('unit.month')}</span>
              </div>
            </div>
          </div>
        )}

        {error && <div className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg">{error}</div>}

        <button type="button" onClick={handleCalculate} disabled={!isValid || isLoading}
          className={cn(BUTTON_VARIANTS.primary, 'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50')}>
          {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{tCommon('loading')}</> : t('calculate')}
        </button>
      </div>

      {/* ─── Right Panel: Results ───────────────────── */}
      <div className="min-w-0">
        {/* 빈 상태 (프로토 Card 내 .empty — EmptyState standalone) */}
        {!result && !isLoading && (
          <EmptyState icon={Calculator} title={t('simPrompt')} sub="" size="lg" standalone className="min-h-[400px]" />
        )}

        {/* 로딩 — EmptyState 금지 (Codex G1), 스피너 + aria-live 유지 */}
        {isLoading && (
          <div role="status" aria-live="polite"
            className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
            <Loader2 className="mb-3 h-10 w-10 animate-spin" aria-hidden="true" />
            <p className="text-sm">{t('simCalculating')}</p>
          </div>
        )}

        {result && totals && sm && (
          <div className="space-y-4">
            {/* 결과 카드 (proto Card + CardHead 'N명 대상' + kpi-grid) */}
            <section aria-labelledby="sim-result-title" className="rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-3 border-b border-border px-6 py-3.5">
                <h3 id="sim-result-title" className={TYPOGRAPHY.cardTitle}>{t('simResultTitle')}</h3>
                <span className="text-xs text-muted-foreground">{t('simResultTargets', { count: sm.employeeCount })}</span>
              </div>
              <div className="p-6">
                {/* 4번째 지표(공제 변동)는 기능 보존 차원 유지 — 프로토 cols-3 대비 의도적 편차.
                    4-col은 2xl부터 — xl(1280)에선 우측 패널이 ~590px라 풀 정밀 KRW(156px)가 4-col 카드(129px)를 넘침 */}
                <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
                  <KPICard label={t('kpiCurrentGross')} value={fmtKRW(totals.currentGross, locale)} />
                  <KPICard label={t('kpiSimGross')} value={fmtKRW(totals.simulatedGross, locale)}
                    diff={signedKRW(totals.grossDifference, locale)} rate={pctStr(totals.grossChangeRate)} variant="neutral" />
                  <KPICard label={t('kpiDeductionChange')} value={signedKRW(totals.simulatedTotalDeductions - totals.currentTotalDeductions, locale)}
                    rate={totals.currentTotalDeductions > 0
                      ? pctStr((totals.simulatedTotalDeductions - totals.currentTotalDeductions) / totals.currentTotalDeductions)
                      : undefined} variant="cost" />
                  <KPICard label={t('kpiNetChange')} value={signedKRW(totals.netDifference, locale)} rate={pctStr(totals.netChangeRate)} variant="neutral" />
                </div>

                {/* BULK: 현재 vs 시뮬레이션 월 인건비 2-막대 비교 (프로토 12-bar 추이 대비 의도적 편차) */}
                {bulkCompareData && (
                  <>
                    <div className="my-5 border-t border-border" aria-hidden="true" />
                    <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">{t('simBulkChartTitle')}</p>
                    <div
                      role="img"
                      aria-label={`${t('simBulkChartTitle')} — ${t('simCurrentLabel')} ${fmtKRW(totals.currentGross, locale)}, ${t('simulated')} ${fmtKRW(totals.simulatedGross, locale)}`}
                      className="min-w-0"
                    >
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={bulkCompareData} barCategoryGap="35%">
                          <CartesianGrid {...CHART_THEME.grid} />
                          <XAxis dataKey="name" {...CHART_THEME.axis} />
                          <YAxis {...CHART_THEME.axis} tickFormatter={v => fmtCompactKRW(Number(v), locale)} width={80} />
                          <Tooltip {...CHART_THEME.tooltip} formatter={(v) => v != null ? fmtKRW(Number(v), locale) : ''} />
                          {/* isAnimationActive=false: 2-막대 정적 차트 — headless 스냅샷(e2e·QA)에서 rAF 미발화 시에도 결정적 렌더 */}
                          <Bar dataKey="amount" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                            <Cell fill={CHART_THEME.colors[5]} />
                            <Cell fill={CHART_THEME.colors[0]} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Pay Band Position (single mode) */}
            {mode === 'SINGLE' && salaryBandData && selectedEmployee && (
              <div className={PANEL_CARD}>
                <h3 className="text-sm font-semibold text-foreground mb-3">{t('salaryBandPosition')}</h3>
                <PayBandChart
                  currentSalary={selectedEmployee.currentSalary}
                  minSalary={salaryBandData.min}
                  midSalary={salaryBandData.mid}
                  maxSalary={salaryBandData.max}
                  // simulated.baseSalary는 월 단위 — 밴드 축(연봉)에 맞춰 x12 (라우트 band violation 체크와 동일 규칙)
                  comparisonSalary={
                    result.employees[0]?.simulated
                      ? result.employees[0].simulated.baseSalary * 12
                      : undefined
                  }
                />
              </div>
            )}

            {/* Chart (single mode) */}
            {chartData && (
              <div className={PANEL_CARD}>
                <h3 className="text-sm font-semibold text-foreground mb-4">{t('currentVsSimulation')}</h3>
                <div className="min-w-0">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                      <XAxis type="number" tickFormatter={v => fmtCompactKRW(Number(v), locale)} />
                      <YAxis type="category" dataKey="name" width={40} />
                      <Tooltip formatter={(v) => v != null ? fmtKRW(Number(v), locale) : ''} />
                      <Legend />
                      <Bar dataKey="basePay" name={t('basePay')} fill={CHART_THEME.colors[0]} stackId="a" />
                      <Bar dataKey="allowance" name={t('sim.chart.allowance')} fill={CHART_THEME.colors[3]} stackId="a" />
                      <Bar dataKey="bonus" name={t('sim.chart.bonus')} fill={CHART_THEME.colors[2]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Department Table (bulk) */}
            {sm.byDepartment && sm.byDepartment.length > 0 && (
              <div className={PANEL_CARD}>
                <h3 className="text-sm font-semibold text-foreground mb-3">{t('deptSummary')}</h3>
                <div className={TABLE_STYLES.wrapper}>
                  <table className={TABLE_STYLES.table}>
                    <thead>
                      <tr className={TABLE_STYLES.header}>
                        <th className={TABLE_STYLES.headerCell}>{t('department')}</th>
                        <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('kr_kec9db8ec')}</th>
                        <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('kr_ked9884ec_ked95a9ea')}</th>
                        <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('kr_kec8b9ceb_ked95a9ea')}</th>
                        <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('kr_kecb0a8ec')}</th>
                        <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('kr_kebb380eb')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sm.byDepartment.map(dept => (
                        <tr key={dept.department} className={TABLE_STYLES.row}>
                          <td className={TABLE_STYLES.cell}>{dept.department}</td>
                          <td className={cn(TABLE_STYLES.cell, "text-right")}>{t('simPersonUnit', { count: dept.employeeCount })}</td>
                          <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums")}>{fmtKRW(dept.currentGross, locale)}</td>
                          <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums")}>{fmtKRW(dept.simulatedGross, locale)}</td>
                          <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums", diffColor(dept.difference))}>{signedKRW(dept.difference, locale)}</td>
                          <td className={cn(TABLE_STYLES.cell, "text-right", diffColor(dept.difference))}>
                            {dept.currentGross > 0 ? pctStr(dept.difference / dept.currentGross) : '—'}
                          </td>
                        </tr>
                      ))}
                      <tr className={cn(TABLE_STYLES.row, "bg-background font-semibold")}>
                        <td className={TABLE_STYLES.cell}>{tCommon('total')}</td>
                        <td className={cn(TABLE_STYLES.cell, "text-right")}>{sm.employeeCount}{tCommon('unit.person')}</td>
                        <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums")}>{fmtKRW(totals.currentGross, locale)}</td>
                        <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums")}>{fmtKRW(totals.simulatedGross, locale)}</td>
                        <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums", diffColor(totals.grossDifference))}>{signedKRW(totals.grossDifference, locale)}</td>
                        <td className={cn(TABLE_STYLES.cell, "text-right", diffColor(totals.grossDifference))}>{pctStr(totals.grossChangeRate)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Employee Detail Table */}
            <div className={PANEL_CARD}>
              <h3 className="text-sm font-semibold text-foreground mb-3">{t('sim.employeeDetail', { count: result.employees.length })}</h3>
              <div className={TABLE_STYLES.wrapper}>
                <table className={TABLE_STYLES.table}>
                  <thead>
                    <tr className={TABLE_STYLES.header}>
                      <th className={TABLE_STYLES.headerCell}>{t('kr_keca781ec')}</th>
                      <th className={TABLE_STYLES.headerCell}>{t('department')}</th>
                      <th className={TABLE_STYLES.headerCell}>{t('position')}</th>
                      <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('kr_ked9884ec_kec8ba4ec')}</th>
                      <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('kr_kec8b9ceb_kec8ba4ec')}</th>
                      <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('kr_kecb0a8ec')}</th>
                      <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('kr_kebb380eb')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.employees.map(emp => {
                      const isExp = expandedRow === emp.id
                      const netDiff = emp.difference.netPay
                      const netRate = emp.current.netPay > 0 ? netDiff / emp.current.netPay : 0
                      return (
                        <Fragment key={emp.id}>
                          <tr onClick={() => setExpandedRow(isExp ? null : emp.id)}
                            className={cn(TABLE_STYLES.row, isExp ? "bg-background" : "hover:bg-background", "cursor-pointer")}>
                            <td className={cn(TABLE_STYLES.cell, "flex items-center gap-1")}>
                              {isExp ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                              <span className="font-medium text-foreground">{emp.name}</span>
                            </td>
                            <td className={TABLE_STYLES.cell}>{emp.department}</td>
                            <td className={TABLE_STYLES.cell}>{emp.position}</td>
                            <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums")}>{fmtKRW(emp.current.netPay, locale)}</td>
                            <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums")}>{fmtKRW(emp.simulated.netPay, locale)}</td>
                            <td className={cn(TABLE_STYLES.cell, "text-right font-mono tabular-nums", diffColor(netDiff))}>
                              {diffArrow(netDiff)}{fmtKRW(Math.abs(netDiff), locale)}
                            </td>
                            <td className={cn(TABLE_STYLES.cell, "text-right", diffColor(netDiff))}>{pctStr(netRate)}</td>
                          </tr>
                          {isExp && <EmployeeExpandedDetail emp={emp} t={t} locale={locale} />}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      {/* ── Header (proto .page-h: 56px 아이콘 타일 + pageTitle + greet-sub) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-accent text-primary">
            <Calculator className="h-[26px] w-[26px]" aria-hidden="true" />
          </div>
          <div>
            <h1 className={TYPOGRAPHY.pageTitle}>{t('simulation')}</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{t('simulationDesc')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setScenarioSheetOpen(true)}
            className={cn(BUTTON_VARIANTS.secondary, BUTTON_SIZES.md, 'inline-flex items-center gap-1.5')}>
            <History className="h-4 w-4" aria-hidden="true" /> {t('simScenarioHistory')}
          </button>
          {result && (mode === 'SINGLE' || mode === 'BULK') && (
            <button type="button" onClick={handleSaveSingleBulk}
              className={cn(BUTTON_VARIANTS.secondary, BUTTON_SIZES.md, 'inline-flex items-center gap-1.5')}>
              <Save className="h-4 w-4" aria-hidden="true" /> {tCommon('save')}
            </button>
          )}
          {result && (
            <button type="button" onClick={handleExcelDownload} disabled={isExporting}
              className={cn(BUTTON_VARIANTS.secondary, BUTTON_SIZES.md, 'inline-flex items-center gap-1.5 disabled:pointer-events-none disabled:opacity-50')}>
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
              {t('excelDownload')}
            </button>
          )}
        </div>
      </div>

      {/* ─── Mode Tabs (Radix + TAB_STYLES 세그먼트 — 6모드 전부 TabsContent 연결) ─── */}
      <Tabs value={mode} onValueChange={handleModeChange} className="space-y-4">
        <TabsList aria-label={t('simModeTabsLabel')}>
          {([
            { key: 'SINGLE' as SimMode, label: t('simModeSingle') },
            { key: 'BULK' as SimMode, label: t('simModeBulk') },
            { key: 'DIFFERENTIAL' as SimMode, label: t('simModeDifferential') },
            { key: 'COMPA_RATIO' as SimMode, label: t('simModeCompa') },
            { key: 'HIRING' as SimMode, label: t('simModeHiring') },
            { key: 'FX' as SimMode, label: t('simModeFx') },
          ]).map(({ key, label }) => (
            <TabsTrigger key={key} value={key}>{label}</TabsTrigger>
          ))}
        </TabsList>

        {/* ─── 비교 뷰 (모드 공통 오버레이) ──────────── */}
        {compareData ? (
          <ScenarioCompareView
            left={compareData.left}
            right={compareData.right}
            onClose={() => setCompareData(null)}
          />
        ) : (
          <>
            {/* ─── SINGLE / BULK: 공유 패널 ─────────────── */}
            <TabsContent value="SINGLE">{singleBulkPanel}</TabsContent>
            <TabsContent value="BULK">{singleBulkPanel}</TabsContent>

            {/* ─── DIFFERENTIAL / COMPA_RATIO / HIRING / FX: 전용 탭 ─── */}
            <TabsContent value="DIFFERENTIAL"><DifferentialTab companies={companies} onSaveScenario={handleRequestSave} /></TabsContent>
            <TabsContent value="COMPA_RATIO"><CompaRatioTab companies={companies} /></TabsContent>
            <TabsContent value="HIRING"><HiringTab companies={companies} departments={departments} onSaveScenario={handleRequestSave} /></TabsContent>
            <TabsContent value="FX"><FxTab companies={companies} onSaveScenario={handleRequestSave} /></TabsContent>
          </>
        )}
      </Tabs>

      {/* ─── 시나리오 저장/목록 오버레이 ──────────── */}
      <SaveScenarioDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSaveScenario}
        isLoading={isSaving}
      />
      <ScenarioListSheet
        open={scenarioSheetOpen}
        onOpenChange={setScenarioSheetOpen}
        onLoad={handleLoadScenario}
        onCompare={handleCompare}
      />
    </div>
  )
}
