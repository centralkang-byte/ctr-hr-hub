'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Calculator, Search, X, ChevronDown, ChevronRight, Download, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { CARD_STYLES, TABLE_STYLES, CHART_THEME } from '@/lib/styles'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'
import type {
  Company, Department, SimMode, BulkTargetType,
  SearchEmployee, SimResponse, EmployeeSimResult, PayDetail
} from './types'

// ─── Formatters ──────────────────────────────────────────

const fmtN = (n: number) => n.toLocaleString('ko-KR')
const fmtKRW = (n: number) => `₩${Math.abs(n).toLocaleString('ko-KR')}`
const signedKRW = (n: number) => n === 0 ? '₩0' : `${n > 0 ? '+' : '-'}${fmtKRW(n)}`
const pctStr = (r: number) => `${r >= 0 ? '+' : ''}${(r * 100).toFixed(1)}%`

function diffColor(n: number) {
  if (n > 0) return 'text-primary'
  if (n < 0) return 'text-red-600'
  return 'text-[#8181A5]'
}

function diffArrow(n: number) {
  if (n > 0) return '▲'
  if (n < 0) return '▼'
  return ''
}

// ─── KPI Card ────────────────────────────────────────────

function KPICard({ label, value, diff, rate, variant }: {
  label: string; value: string; diff?: string; rate?: string
  variant?: 'neutral' | 'cost' | 'auto'
}) {
  const badgeColor = !rate ? '' :
    variant === 'cost' ? 'bg-red-50 text-red-600' :
      rate.startsWith('-') ? 'bg-green-50 text-green-600' : 'bg-primary/5 text-primary'

  return (
    <div className={CARD_STYLES.padded}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-[#8181A5]">{label}</p>
        {rate && <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>{rate}</span>}
      </div>
      <p className="text-xl font-bold text-[#1C1D21]">{value}</p>
      {diff && <p className={`text-xs mt-1 ${diffColor(parseFloat(diff.replace(/[^-\d.]/g, '')))}`}>{diff}</p>}
    </div>
  )
}

// ─── Expandable Row ──────────────────────────────────────

function DetailRow({ label, c, s }: { label: string; c: number; s: number }) {
  const d = s - c
  return (
    <tr className="border-b border-[#F0F0F3] text-[13px]">
      <td className="py-1.5 pl-8 text-[#8181A5]">{label}</td>
      <td className="py-1.5 text-right font-mono">{fmtKRW(c)}</td>
      <td className="py-1.5 text-right font-mono">{fmtKRW(s)}</td>
      <td className={`py-1.5 text-right font-mono ${diffColor(d)}`}>{signedKRW(d)}</td>
    </tr>
  )
}

function EmployeeExpandedDetail({ emp }: { emp: EmployeeSimResult }) {
  const c = emp.current
  const s = emp.simulated
  return (
    <tr>
      <td colSpan={7} className="p-0">
        <div className="bg-[#FAFAFA] px-6 py-3">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-[#8181A5] border-b border-[#F0F0F3]">
                <th className="text-left py-1.5 pl-8 font-medium">항목</th>
                <th className="text-right py-1.5 font-medium">현재</th>
                <th className="text-right py-1.5 font-medium">시뮬레이션</th>
                <th className="text-right py-1.5 font-medium">차이</th>
              </tr>
            </thead>
            <tbody>
              <DetailRow label="기본급" c={c.baseSalary} s={s.baseSalary} />
              <DetailRow label="시간외수당" c={c.overtimePay} s={s.overtimePay} />
              <DetailRow label="야간수당" c={c.nightPay} s={s.nightPay} />
              <DetailRow label="식대" c={c.mealAllowance} s={s.mealAllowance} />
              <DetailRow label="교통비" c={c.transportAllowance} s={s.transportAllowance} />
              <tr className="border-b-2 border-[#E0E0E0] text-[13px] font-semibold">
                <td className="py-1.5 pl-8">총 지급액</td>
                <td className="py-1.5 text-right font-mono">{fmtKRW(c.grossPay)}</td>
                <td className="py-1.5 text-right font-mono">{fmtKRW(s.grossPay)}</td>
                <td className={`py-1.5 text-right font-mono ${diffColor(s.grossPay - c.grossPay)}`}>{signedKRW(s.grossPay - c.grossPay)}</td>
              </tr>
              <DetailRow label="국민연금" c={c.nationalPension} s={s.nationalPension} />
              <DetailRow label="건강보험" c={c.healthInsurance} s={s.healthInsurance} />
              <DetailRow label="장기요양" c={c.longTermCare} s={s.longTermCare} />
              <DetailRow label="고용보험" c={c.employmentInsurance} s={s.employmentInsurance} />
              <DetailRow label="소득세" c={c.incomeTax} s={s.incomeTax} />
              <DetailRow label="지방소득세" c={c.localIncomeTax} s={s.localIncomeTax} />
              <tr className="border-b-2 border-[#E0E0E0] text-[13px] font-semibold">
                <td className="py-1.5 pl-8">총 공제액</td>
                <td className="py-1.5 text-right font-mono">{fmtKRW(c.totalDeductions)}</td>
                <td className="py-1.5 text-right font-mono">{fmtKRW(s.totalDeductions)}</td>
                <td className={`py-1.5 text-right font-mono ${diffColor(s.totalDeductions - c.totalDeductions)}`}>{signedKRW(s.totalDeductions - c.totalDeductions)}</td>
              </tr>
              <tr className="text-sm font-bold">
                <td className="py-2 pl-8">실수령액</td>
                <td className="py-2 text-right font-mono">{fmtKRW(c.netPay)}</td>
                <td className="py-2 text-right font-mono">{fmtKRW(s.netPay)}</td>
                <td className={`py-2 text-right font-mono ${diffColor(s.netPay - c.netPay)}`}>{signedKRW(s.netPay - c.netPay)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  )
}

// ─── Main Component ──────────────────────────────────────

export default function PayrollSimulationClient({ user, companies, departments }: {
  user: SessionUser; companies: Company[]; departments: Department[]
}) {
  const tCommon = useTranslations('common')
  const t = useTranslations('payroll')
  const [mode, setMode] = useState<SimMode>('SINGLE')
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [result, setResult] = useState<SimResponse | null>(null)
  const [error, setError] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Single mode state
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
    } finally { setIsExporting(false) }
  }

  const sm = result?.summary
  const totals = sm?.totals

  // Chart data for single mode
  const chartData = result && mode === 'SINGLE' && result.employees[0] ? (() => {
    const c = result.employees[0].current
    const s = result.employees[0].simulated
    return [
      { name: t('current'), 기본급: c.baseSalary, 수당: c.overtimePay + c.mealAllowance + c.transportAllowance, 상여: c.bonusAmount },
      { name: t('simulated'), 기본급: s.baseSalary, 수당: s.overtimePay + s.mealAllowance + s.transportAllowance, 상여: s.bonusAmount },
    ]
  })() : null

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary/5 rounded-lg flex items-center justify-center">
            <Calculator className="w-5 h-5 text-[#5E81F4]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1C1D21]">{t('simulation')}</h1>
            <p className="text-sm text-[#8181A5]">{t('simulationDesc')}</p>
          </div>
        </div>
        {result && (
          <button onClick={handleExcelDownload} disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 border border-[#F0F0F3] rounded-lg text-sm text-[#1C1D21] hover:bg-[#F5F5FA] disabled:opacity-50">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {t('excelDownload')}
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* ─── Left Panel: Input ──────────────────────── */}
        <div className="w-[350px] shrink-0 space-y-4">
          {/* Mode toggle */}
          <div className="flex border border-[#F0F0F3] rounded-lg overflow-hidden">
            {(['SINGLE', 'BULK'] as SimMode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setResult(null) }}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${mode === m ? 'bg-[#5E81F4] text-white' : 'bg-white text-[#8181A5] hover:text-[#1C1D21]'}`}>
                {m === 'SINGLE' ? t('singleSim') : t('bulkSim')}
              </button>
            ))}
          </div>

          {/* ─ SINGLE: Employee Search ─ */}
          {mode === 'SINGLE' && (
            <div className={`${CARD_STYLES.kpi} space-y-3`}>
              <h3 className="text-sm font-semibold text-[#1C1D21]">{t('targetEmployee')}</h3>
              {selectedEmployee ? (
                <div className="bg-[#F5F5FA] rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#1C1D21]">{selectedEmployee.name}</p>
                    <p className="text-xs text-[#8181A5]">
                      {selectedEmployee.department} · {selectedEmployee.position} · 현재 ₩{fmtN(selectedEmployee.currentSalary)}
                    </p>
                  </div>
                  <button onClick={() => setSelectedEmployee(null)} className="text-[#8181A5] hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div ref={searchRef} className="relative">
                  <div className="flex items-center border border-[#F0F0F3] rounded-lg px-3">
                    <Search className="w-4 h-4 text-[#8181A5]" />
                    <input value={searchQuery} onChange={e => handleSearchChange(e.target.value)}
                      placeholder={t('searchPlaceholder')}
                      className="flex-1 px-2 py-2 text-sm outline-none bg-transparent" />
                  </div>
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#F0F0F3] rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                      {searchResults.map(emp => (
                        <button key={emp.id} onClick={() => selectEmployee(emp)}
                          className="w-full text-left px-3 py-2.5 hover:bg-[#F5F5FA] text-sm border-b border-[#F0F0F3] last:border-0">
                          <span className="font-medium text-[#1C1D21]">{emp.name}</span>
                          <span className="text-[#8181A5]"> · {emp.department} · {emp.position}</span>
                          <span className="text-[#8181A5] text-xs ml-1">({emp.employeeNo})</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showDropdown && searchResults.length === 0 && searchQuery.length >= 1 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#F0F0F3] rounded-lg shadow-lg z-20 p-4 text-center text-sm text-[#8181A5]">
                      {tCommon('noResults')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─ SINGLE: Parameters ─ */}
          {mode === 'SINGLE' && (
            <div className={`${CARD_STYLES.kpi} space-y-3`}>
              <h3 className="text-sm font-semibold text-[#1C1D21]">{t('baseSalary')}</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-[#1C1D21]">
                  <input type="radio" name="salaryMode" checked={salaryMode === 'rate'} onChange={() => setSalaryMode('rate')} />
                  {t('adjustRate')}
                </label>
                {salaryMode === 'rate' && (
                  <div className="ml-6 flex items-center gap-1">
                    <input type="number" value={adjustRate} onChange={e => setAdjustRate(Number(e.target.value))}
                      className="w-20 px-2 py-1.5 border border-[#F0F0F3] rounded text-sm text-right" min={-50} max={50} step={0.5} />
                    <span className="text-sm text-[#8181A5]">%</span>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-[#1C1D21]">
                  <input type="radio" name="salaryMode" checked={salaryMode === 'override'} onChange={() => setSalaryMode('override')} />
                  {t('amountOverride')}
                </label>
                {salaryMode === 'override' && (
                  <div className="ml-6 flex items-center gap-1">
                    <span className="text-sm text-[#8181A5]">₩</span>
                    <input type="number" value={baseSalaryOverride} onChange={e => setBaseSalaryOverride(Number(e.target.value))}
                      className="w-32 px-2 py-1.5 border border-[#F0F0F3] rounded text-sm text-right" min={0} />
                  </div>
                )}
              </div>
              <h3 className="text-sm font-semibold text-[#1C1D21] pt-2">{t('workHoursOptional')}</h3>
              <div className="grid grid-cols-3 gap-2">
                {([['시간외', overtimeHours, setOvertimeHours], ['야간', nightHours, setNightHours], ['휴일', holidayHours, setHolidayHours]] as [string, number, (v: number) => void][]).map(([l, v, fn]) => (
                  <div key={l}>
                    <label className="text-xs text-[#8181A5]">{l}</label>
                    <div className="flex items-center gap-1">
                      <input type="number" value={v} onChange={e => fn(Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-[#F0F0F3] rounded text-sm text-right" min={0} max={52} />
                      <span className="text-xs text-[#8181A5]">h</span>
                    </div>
                  </div>
                ))}
              </div>
              <h3 className="text-sm font-semibold text-[#1C1D21] pt-2">{t('bonusOptional')}</h3>
              <div className="flex items-center gap-1">
                <span className="text-sm text-[#8181A5]">₩</span>
                <input type="number" value={bonusAmount} onChange={e => setBonusAmount(Number(e.target.value))}
                  className="w-32 px-2 py-1.5 border border-[#F0F0F3] rounded text-sm text-right" min={0} />
              </div>
            </div>
          )}

          {/* ─ BULK: Target ─ */}
          {mode === 'BULK' && (
            <div className={`${CARD_STYLES.kpi} space-y-3`}>
              <h3 className="text-sm font-semibold text-[#1C1D21]">{t('selectTarget')}</h3>
              {(['COMPANY', 'DEPARTMENT', 'SELECTED'] as BulkTargetType[]).map(bKey => (
                <div key={bKey}>
                  <label className="flex items-center gap-2 text-sm text-[#1C1D21]">
                    <input type="radio" name="bulkTarget" checked={bulkTarget === bKey} onChange={() => setBulkTarget(bKey)} />
                    {bKey === 'COMPANY' ? t('wholeCompany') : bKey === 'DEPARTMENT' ? t('byDept') : t('selectEmployees')}
                  </label>
                  {bulkTarget === 'COMPANY' && bKey === 'COMPANY' && (
                    <select value={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)}
                      className="mt-1 ml-6 w-48 px-2 py-1.5 border border-[#F0F0F3] rounded text-sm">
                      {companies.map(c => <option key={c.id} value={c.id}>{c.code} ({c.name})</option>)}
                    </select>
                  )}
                  {bulkTarget === 'DEPARTMENT' && bKey === 'DEPARTMENT' && (
                    <div className="mt-1 ml-6 space-y-1">
                      <select value={selectedCompanyId} onChange={e => { setSelectedCompanyId(e.target.value); setSelectedDeptId('') }}
                        className="w-48 px-2 py-1.5 border border-[#F0F0F3] rounded text-sm">
                        {companies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                      </select>
                      <select value={selectedDeptId} onChange={e => setSelectedDeptId(e.target.value)}
                        className="w-48 px-2 py-1.5 border border-[#F0F0F3] rounded text-sm">
                        <option value="">부서 선택</option>
                        {filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  )}
                  {bulkTarget === 'SELECTED' && bKey === 'SELECTED' && (
                    <div className="mt-2 ml-6 space-y-2">
                      <div ref={searchRef} className="relative">
                        <div className="flex items-center border border-[#F0F0F3] rounded px-2">
                          <Search className="w-3.5 h-3.5 text-[#8181A5]" />
                          <input value={searchQuery} onChange={e => handleSearchChange(e.target.value)}
                            placeholder="직원 검색" className="flex-1 px-2 py-1.5 text-sm outline-none bg-transparent" />
                        </div>
                        {showDropdown && searchResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#F0F0F3] rounded shadow-lg z-20 max-h-40 overflow-y-auto">
                            {searchResults.map(emp => (
                              <button key={emp.id} onClick={() => selectEmployee(emp)}
                                className="w-full text-left px-2 py-1.5 hover:bg-[#F5F5FA] text-xs border-b border-[#F0F0F3] last:border-0">
                                {emp.name} · {emp.department} ({emp.employeeNo})
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {selectedEmployees.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {selectedEmployees.map(e => (
                            <span key={e.id} className="inline-flex items-center px-2 py-1 bg-[#F5F5FA] rounded text-xs text-[#1C1D21]">
                              {e.name}
                              <button onClick={() => setSelectedEmployees(prev => prev.filter(p => p.id !== e.id))}
                                className="ml-1 text-[#8181A5] hover:text-red-500"><X className="w-3 h-3" /></button>
                            </span>
                          ))}
                        <p className="text-xs text-[#8181A5] w-full mt-1">{selectedEmployees.length}{tCommon('unit.person')} {tCommon('selected')}</p>
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
            <div className={`${CARD_STYLES.kpi} space-y-3`}>
              <h3 className="text-sm font-semibold text-[#1C1D21]">{t('adjustConditions')}</h3>
              <div>
                <label className="text-xs text-[#8181A5]">{t('baseSalaryRate')}</label>
                <div className="flex items-center gap-1 mt-1">
                  <input type="number" value={bulkRate} onChange={e => setBulkRate(Number(e.target.value))}
                    className="w-20 px-2 py-1.5 border border-[#F0F0F3] rounded text-sm text-right" min={-50} max={50} step={0.5} />
                  <span className="text-sm text-[#8181A5]">%</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-[#8181A5]">{t('bonusMonths')}</label>
                <div className="flex items-center gap-1 mt-1">
                  <input type="number" value={bonusMonths} onChange={e => setBonusMonths(Number(e.target.value))}
                    className="w-20 px-2 py-1.5 border border-[#F0F0F3] rounded text-sm text-right" min={0} max={12} step={0.5} />
                  <span className="text-sm text-[#8181A5]">{tCommon('unit.month')}</span>
                </div>
              </div>
            </div>
          )}

          {error && <div className="text-sm text-[#DC2626] bg-[#FEE2E2] px-4 py-3 rounded-lg">{error}</div>}

          <button onClick={handleCalculate} disabled={!isValid || isLoading}
            className="w-full px-4 py-3 bg-[#5E81F4] text-white rounded-lg text-sm font-medium hover:bg-[#4B6FE0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{tCommon('loading')}</> : t('calculate')}
          </button>
        </div>

        {/* ─── Right Panel: Results ───────────────────── */}
        <div className="flex-1 min-w-0">
          {!result && !isLoading && (
            <div className="flex flex-col items-center justify-center h-[500px] text-[#8181A5]">
              <Calculator className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">{t('simPrompt')}</p>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center h-[500px] text-[#8181A5]">
              <Loader2 className="w-10 h-10 animate-spin mb-3" />
              <p className="text-sm">{t('simCalculating')}</p>
            </div>
          )}

          {result && totals && sm && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-4 gap-4">
                <KPICard label={t('kpiCurrentGross')} value={fmtKRW(totals.currentGross)} />
                <KPICard label={t('kpiSimGross')} value={fmtKRW(totals.simulatedGross)}
                  diff={signedKRW(totals.grossDifference)} rate={pctStr(totals.grossChangeRate)} variant="neutral" />
                <KPICard label={t('kpiDeductionChange')} value={signedKRW(totals.simulatedTotalDeductions - totals.currentTotalDeductions)}
                  rate={totals.currentTotalDeductions > 0
                    ? pctStr((totals.simulatedTotalDeductions - totals.currentTotalDeductions) / totals.currentTotalDeductions)
                    : undefined} variant="cost" />
                <KPICard label={t('kpiNetChange')} value={signedKRW(totals.netDifference)} rate={pctStr(totals.netChangeRate)} variant="neutral" />
              </div>

              {/* Chart (single mode) */}
              {chartData && (
                <div className={CARD_STYLES.padded}>
                  <h3 className="text-sm font-semibold text-[#1C1D21] mb-4">{t('currentVsSimulation')}</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                      <XAxis type="number" tickFormatter={v => `₩${(v / 10000).toFixed(0)}만`} />
                      <YAxis type="category" dataKey="name" width={40} />
                      <Tooltip formatter={(v: number | undefined) => v !== undefined ? fmtKRW(v) : ''} />
                      <Legend />
                      <Bar dataKey="기본급" fill={CHART_THEME.colors[0]} stackId="a" />
                      <Bar dataKey="수당" fill={CHART_THEME.colors[3]} stackId="a" />
                      <Bar dataKey="상여" fill={CHART_THEME.colors[2]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Department Table (bulk) */}
              {sm.byDepartment && sm.byDepartment.length > 0 && (
                <div className={CARD_STYLES.padded}>
                  <h3 className="text-sm font-semibold text-[#1C1D21] mb-3">{t('deptSummary')}</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-[#8181A5] border-b border-[#F0F0F3]">
                        <th className="text-left py-2 font-medium">부서</th>
                        <th className="text-right py-2 font-medium">인원</th>
                        <th className="text-right py-2 font-medium">현재 합계</th>
                        <th className="text-right py-2 font-medium">시뮬 합계</th>
                        <th className="text-right py-2 font-medium">차이</th>
                        <th className="text-right py-2 font-medium">변동률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sm.byDepartment.map(dept => (
                        <tr key={dept.department} className={TABLE_STYLES.header}>
                          <td className="py-2.5">{dept.department}</td>
                          <td className="py-2.5 text-right">{dept.employeeCount}명</td>
                          <td className="py-2.5 text-right font-mono">{fmtKRW(dept.currentGross)}</td>
                          <td className="py-2.5 text-right font-mono">{fmtKRW(dept.simulatedGross)}</td>
                          <td className={`py-2.5 text-right font-mono ${diffColor(dept.difference)}`}>{signedKRW(dept.difference)}</td>
                          <td className={`py-2.5 text-right ${diffColor(dept.difference)}`}>
                            {dept.currentGross > 0 ? pctStr(dept.difference / dept.currentGross) : '—'}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-semibold border-t-2 border-[#1C1D21]">
                        <td className="py-2.5">합계</td>
                        <td className="py-2.5 text-right">{sm.employeeCount}{tCommon('unit.person')}</td>
                        <td className="py-2.5 text-right font-mono">{fmtKRW(totals.currentGross)}</td>
                        <td className="py-2.5 text-right font-mono">{fmtKRW(totals.simulatedGross)}</td>
                        <td className={`py-2.5 text-right font-mono ${diffColor(totals.grossDifference)}`}>{signedKRW(totals.grossDifference)}</td>
                        <td className={`py-2.5 text-right ${diffColor(totals.grossDifference)}`}>{pctStr(totals.grossChangeRate)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Employee Detail Table */}
              <div className={CARD_STYLES.padded}>
                <h3 className="text-sm font-semibold text-[#1C1D21] mb-3">직원별 상세 ({result.employees.length}명)</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-[#8181A5] border-b border-[#F0F0F3]">
                      <th className="text-left py-2 font-medium">직원명</th>
                      <th className="text-left py-2 font-medium">부서</th>
                      <th className="text-left py-2 font-medium">직위</th>
                      <th className="text-right py-2 font-medium">현재 실수령</th>
                      <th className="text-right py-2 font-medium">시뮬 실수령</th>
                      <th className="text-right py-2 font-medium">차이</th>
                      <th className="text-right py-2 font-medium">변동률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.employees.map(emp => {
                      const isExp = expandedRow === emp.id
                      const netDiff = emp.difference.netPay
                      const netRate = emp.current.netPay > 0 ? netDiff / emp.current.netPay : 0
                      return (
                        <><tr key={emp.id} onClick={() => setExpandedRow(isExp ? null : emp.id)}
                          className="border-b border-[#F0F0F3] hover:bg-[#FAFAFA] cursor-pointer">
                          <td className="py-2.5 flex items-center gap-1">
                            {isExp ? <ChevronDown className="w-3.5 h-3.5 text-[#8181A5]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#8181A5]" />}
                            {emp.name}
                          </td>
                          <td className="py-2.5">{emp.department}</td>
                          <td className="py-2.5">{emp.position}</td>
                          <td className="py-2.5 text-right font-mono">{fmtKRW(emp.current.netPay)}</td>
                          <td className="py-2.5 text-right font-mono">{fmtKRW(emp.simulated.netPay)}</td>
                          <td className={`py-2.5 text-right font-mono ${diffColor(netDiff)}`}>
                            {diffArrow(netDiff)}{fmtKRW(Math.abs(netDiff))}
                          </td>
                          <td className={`py-2.5 text-right ${diffColor(netDiff)}`}>{pctStr(netRate)}</td>
                        </tr>
                          {isExp && <EmployeeExpandedDetail key={`${emp.id}-detail`} emp={emp} />}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
