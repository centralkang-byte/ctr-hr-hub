'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle New Request Client
// Off-Cycle 보상 요청 생성 폼
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Save, Send, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PayBandChart from '@/components/compensation/PayBandChart'
import { apiClient } from '@/lib/api'
import { formatCurrency } from '@/lib/compensation'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

type ReasonCategory = 'PROMOTION' | 'RETENTION' | 'EQUITY_ADJUSTMENT' | 'ROLE_CHANGE' | 'MARKET_ADJUSTMENT' | 'PERFORMANCE'

interface EmployeeOption {
  id: string
  name: string
  department: string
  jobGrade: string
  currentSalary: number
  salaryBand?: {
    minSalary: number
    midSalary: number
    maxSalary: number
  }
}

interface Props {
  user: SessionUser
}

// ─── Constants ──────────────────────────────────────────────

const REASON_OPTIONS: { value: ReasonCategory; label: string }[] = [
  { value: 'PROMOTION', label: '승진' }, // TODO: i18n
  { value: 'RETENTION', label: '리텐션' }, // TODO: i18n
  { value: 'EQUITY_ADJUSTMENT', label: '형평성 조정' }, // TODO: i18n
  { value: 'ROLE_CHANGE', label: '역할 변경' }, // TODO: i18n
  { value: 'MARKET_ADJUSTMENT', label: '시장 조정' }, // TODO: i18n
  { value: 'PERFORMANCE', label: '성과 기반' }, // TODO: i18n
]

// ─── Helpers ────────────────────────────────────────────────

function computeCompaRatio(salary: number, midSalary: number): number {
  if (midSalary <= 0) return 0
  return (salary / midSalary) * 100
}

// ─── Component ──────────────────────────────────────────────

export default function OffCycleNewClient({ user: _user }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL pre-fill params
  const preEmployeeId = searchParams.get('employeeId') ?? ''
  const preReason = (searchParams.get('reason') as ReasonCategory) ?? ''

  // ─── State ───
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [searchResults, setSearchResults] = useState<EmployeeOption[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null)
  const [reasonCategory, setReasonCategory] = useState<ReasonCategory | ''>(preReason || '')
  const [proposedSalary, setProposedSalary] = useState<string>('')
  const [effectiveDate, setEffectiveDate] = useState<string>('')
  const [justification, setJustification] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ─── Pre-fill from URL ───
  useEffect(() => {
    if (preEmployeeId) {
      (async () => {
        try {
          const res = await apiClient.get<EmployeeOption>(
            `/api/v1/employees/${preEmployeeId}/compensation-info`,
          )
          setSelectedEmployee(res.data)
        } catch {
          // 직원 정보를 로드할 수 없으면 무시
        }
      })()
    }
  }, [preEmployeeId])

  // ─── Employee search ───
  const handleEmployeeSearch = useCallback(async (query: string) => {
    setEmployeeSearch(query)
    if (query.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    try {
      setSearching(true)
      setShowResults(true)
      const res = await apiClient.getList<EmployeeOption>(
        '/api/v1/employees/search',
        { search: query, limit: 10 },
      )
      setSearchResults(res.data)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleSelectEmployee = (emp: EmployeeOption) => {
    setSelectedEmployee(emp)
    setEmployeeSearch(emp.name)
    setShowResults(false)
    setSearchResults([])
  }

  // ─── Computed values ───
  const currentSalary = selectedEmployee?.currentSalary ?? 0
  const proposed = Number(proposedSalary) || 0
  const changePct = currentSalary > 0 ? ((proposed - currentSalary) / currentSalary) * 100 : 0
  const band = selectedEmployee?.salaryBand
  const currentCompaRatio = band ? computeCompaRatio(currentSalary, band.midSalary) : null
  const proposedCompaRatio = band && proposed > 0 ? computeCompaRatio(proposed, band.midSalary) : null

  // ─── Submit ───
  const handleSave = async (submitForApproval: boolean) => {
    if (!selectedEmployee) {
      toast({ title: '직원을 선택해 주세요', variant: 'destructive' }) // TODO: i18n
      return
    }
    if (!reasonCategory) {
      toast({ title: '사유를 선택해 주세요', variant: 'destructive' }) // TODO: i18n
      return
    }
    if (!proposed || proposed <= 0) {
      toast({ title: '제안 급여를 입력해 주세요', variant: 'destructive' }) // TODO: i18n
      return
    }
    if (!effectiveDate) {
      toast({ title: '시행일을 선택해 주세요', variant: 'destructive' }) // TODO: i18n
      return
    }

    try {
      setSubmitting(true)
      const body = {
        employeeId: selectedEmployee.id,
        reasonCategory,
        proposedSalary: proposed,
        effectiveDate,
        justification: justification.trim(),
        submitForApproval,
      }
      const res = await apiClient.post<{ id: string }>(
        '/api/v1/compensation/off-cycle',
        body,
      )
      toast({
        title: submitForApproval ? '승인 요청 완료' : '초안 저장 완료', // TODO: i18n
      })
      router.push(`/compensation/off-cycle/${res.data.id}`)
    } catch (err) {
      toast({
        title: '저장 실패', // TODO: i18n
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* ─── 페이지 헤더 ─── */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/compensation/off-cycle')}
          className="rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <nav className="text-xs text-muted-foreground mb-1">
            보상 / Off-Cycle 조정 / 새 요청 {/* TODO: i18n */}
          </nav>
          <h1 className="text-2xl font-bold text-foreground">
            새 Off-Cycle 보상 요청 {/* TODO: i18n */}
          </h1>
        </div>
      </div>

      {/* ─── 직원 선택 ─── */}
      <div className="rounded-2xl bg-surface-container-lowest shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          대상 직원 {/* TODO: i18n */}
        </h2>

        <div className="relative">
          <Label htmlFor="employee-search" className="text-sm text-muted-foreground mb-1.5 block">
            직원 검색 {/* TODO: i18n */}
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="employee-search"
              placeholder="이름 또는 사번으로 검색..." // TODO: i18n
              value={employeeSearch}
              onChange={(e) => handleEmployeeSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              className="pl-9 rounded-lg"
            />
          </div>

          {/* Search dropdown */}
          {showResults && (
            <div className="absolute z-10 mt-1 w-full rounded-2xl bg-surface-container-lowest shadow-md border border-border/15 overflow-hidden">
              {searching ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  검색 중... {/* TODO: i18n */}
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  검색 결과가 없습니다 {/* TODO: i18n */}
                </div>
              ) : (
                searchResults.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    className="w-full px-4 py-3 text-left hover:bg-surface-container-high/30 transition-colors"
                    onMouseDown={() => handleSelectEmployee(emp)}
                  >
                    <div className="text-sm font-medium text-foreground">{emp.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {emp.department} · {emp.jobGrade}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* 선택된 직원 정보 */}
        {selectedEmployee && (
          <div className="rounded-2xl bg-surface-container-low p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{selectedEmployee.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedEmployee.department} · {selectedEmployee.jobGrade}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">현재 급여</p> {/* TODO: i18n */}
                <p className="font-mono tabular-nums font-semibold text-foreground">
                  {formatCurrency(selectedEmployee.currentSalary)}
                </p>
              </div>
            </div>
            {band && (
              <PayBandChart
                currentSalary={currentSalary}
                minSalary={band.minSalary}
                midSalary={band.midSalary}
                maxSalary={band.maxSalary}
                comparisonSalary={proposed > 0 ? proposed : undefined}
              />
            )}
          </div>
        )}
      </div>

      {/* ─── 조정 정보 ─── */}
      <div className="rounded-2xl bg-surface-container-lowest shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          조정 정보 {/* TODO: i18n */}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 사유 카테고리 */}
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">사유 카테고리</Label> {/* TODO: i18n */}
            <Select
              value={reasonCategory}
              onValueChange={(val) => setReasonCategory(val as ReasonCategory)}
            >
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="사유를 선택하세요" /> {/* TODO: i18n */}
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 시행일 */}
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">시행일</Label> {/* TODO: i18n */}
            <Input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="rounded-lg"
            />
          </div>

          {/* 제안 급여 */}
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">제안 급여 (연봉)</Label> {/* TODO: i18n */}
            <Input
              type="number"
              placeholder="0"
              value={proposedSalary}
              onChange={(e) => setProposedSalary(e.target.value)}
              className="rounded-lg font-mono tabular-nums"
            />
          </div>

          {/* 변동 표시 */}
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">변동</Label> {/* TODO: i18n */}
            <div className="flex items-center gap-4 h-10 px-3 rounded-lg bg-surface-container-low">
              {proposed > 0 && currentSalary > 0 ? (
                <>
                  <span
                    className={cn(
                      'font-mono tabular-nums font-semibold',
                      changePct > 0 ? 'text-[#059669]' : changePct < 0 ? 'text-[#DC2626]' : 'text-muted-foreground',
                    )}
                  >
                    {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({formatCurrency(proposed - currentSalary)})
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </div>

        {/* Compa-ratio 비교 */}
        {currentCompaRatio !== null && (
          <div className="flex gap-6 pt-2">
            <div>
              <p className="text-xs text-muted-foreground">현재 Compa-Ratio</p> {/* TODO: i18n */}
              <p className="font-mono tabular-nums font-semibold text-foreground">
                {currentCompaRatio.toFixed(1)}%
              </p>
            </div>
            {proposedCompaRatio !== null && (
              <>
                <div className="text-muted-foreground flex items-center">→</div>
                <div>
                  <p className="text-xs text-muted-foreground">제안 Compa-Ratio</p> {/* TODO: i18n */}
                  <p className={cn(
                    'font-mono tabular-nums font-semibold',
                    proposedCompaRatio > 120 ? 'text-[#DC2626]' : 'text-foreground',
                  )}>
                    {proposedCompaRatio.toFixed(1)}%
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── 사유 설명 ─── */}
      <div className="rounded-2xl bg-surface-container-lowest shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          사유 및 근거 {/* TODO: i18n */}
        </h2>
        <Textarea
          placeholder="조정 사유를 상세히 설명해 주세요..." // TODO: i18n
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          rows={5}
          className="rounded-lg resize-none"
        />
      </div>

      {/* ─── 하단 버튼 ─── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          variant="outline"
          onClick={() => router.push('/compensation/off-cycle')}
          className="rounded-xl"
          disabled={submitting}
        >
          취소 {/* TODO: i18n */}
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSave(false)}
          className="rounded-xl"
          disabled={submitting}
        >
          <Save className="mr-1.5 h-4 w-4" />
          초안 저장 {/* TODO: i18n */}
        </Button>
        <Button
          onClick={() => handleSave(true)}
          className="rounded-full bg-gradient-to-r from-primary to-primary-dim shadow-lg shadow-primary/20"
          size="lg"
          disabled={submitting}
        >
          <Send className="mr-1.5 h-4 w-4" />
          승인 요청 {/* TODO: i18n */}
        </Button>
      </div>
    </div>
  )
}
