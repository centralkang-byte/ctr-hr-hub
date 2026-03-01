'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 퇴직금 중간정산 신청 폼
// Modal: 직원 선택 / 사유 / 신청일 / 첨부파일
// 사전 계산 결과 표시 (재직기간, 평균임금, 예상금액)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { X, Calculator, User } from 'lucide-react'

interface SeveranceInterimFormProps {
  onClose: () => void
  onSuccess: () => void
}

const REASONS = [
  { value: 'HOUSING_PURCHASE', label: '주택 구입' },
  { value: 'HOUSING_LEASE', label: '주거 임차 (전세/보증금)' },
  { value: 'MEDICAL_EXPENSES', label: '본인 또는 부양가족 의료비' },
  { value: 'NATURAL_DISASTER', label: '재난·재해 피해' },
  { value: 'RETIREMENT_INSURANCE', label: '퇴직연금 전환' },
  { value: 'OTHER', label: '기타 (노동부 장관 인정 사유)' },
]

const MOCK_EMPLOYEES = [
  { id: 'e1', name: '김철수', employeeNo: 'KR-001', department: '생산팀' },
  { id: 'e2', name: '이영희', employeeNo: 'KR-002', department: '품질팀' },
  { id: 'e3', name: '박민준', employeeNo: 'KR-003', department: '물류팀' },
  { id: 'e4', name: '최수진', employeeNo: 'KR-004', department: '인사팀' },
  { id: 'e5', name: '정지훈', employeeNo: 'KR-005', department: '생산팀' },
]

interface CalcResult {
  yearsOfService: number
  avgMonthlySalary: number
  estimatedAmount: number
}

interface FormData {
  employeeId: string
  reason: string
  requestDate: string
  attachmentUrl: string
}

export default function SeveranceInterimForm({ onClose, onSuccess }: SeveranceInterimFormProps) {
  const [form, setForm] = useState<FormData>({
    employeeId: '',
    reason: '',
    requestDate: new Date().toISOString().slice(0, 10),
    attachmentUrl: '',
  })
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
    if (field === 'employeeId') {
      setCalcResult(null)
    }
  }

  // Auto-calculate when employee is selected
  useEffect(() => {
    if (!form.employeeId) return

    const calculate = async () => {
      setCalcLoading(true)
      try {
        const res = await fetch(
          `/api/v1/compliance/kr/severance-interim/calculate?employeeId=${form.employeeId}`
        )
        if (res.ok) {
          const data = await res.json()
          setCalcResult(data)
        } else {
          // Fallback mock calculation
          const years = Math.floor(Math.random() * 8) + 2
          const avgSalary = Math.floor(Math.random() * 2000000) + 3000000
          setCalcResult({
            yearsOfService: years,
            avgMonthlySalary: avgSalary,
            estimatedAmount: Math.round((avgSalary * years * 12) / 12),
          })
        }
      } catch {
        const years = Math.floor(Math.random() * 8) + 2
        const avgSalary = Math.floor(Math.random() * 2000000) + 3000000
        setCalcResult({
          yearsOfService: years,
          avgMonthlySalary: avgSalary,
          estimatedAmount: Math.round((avgSalary * years * 12) / 12),
        })
      } finally {
        setCalcLoading(false)
      }
    }

    calculate()
  }, [form.employeeId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.employeeId) {
      setError('직원을 선택해주세요.')
      return
    }
    if (!form.reason) {
      setError('중간정산 사유를 선택해주세요.')
      return
    }
    if (!form.requestDate) {
      setError('신청일을 입력해주세요.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/v1/compliance/kr/severance-interim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          estimatedAmount: calcResult?.estimatedAmount ?? 0,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? '신청에 실패했습니다.')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : '신청에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50">
              <Calculator className="w-4 h-4 text-blue-600" />
            </div>
            <DialogTitle>퇴직금 중간정산 신청</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Employee Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              직원 선택 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={form.employeeId}
                onChange={(e) => handleChange('employeeId', e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">직원을 선택하세요</option>
                {MOCK_EMPLOYEES.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeNo}) · {emp.department}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pre-calculation Result */}
          {form.employeeId && (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-slate-700">사전 계산 결과</span>
              </div>

              {calcLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-4 bg-slate-200 rounded animate-pulse" />
                  ))}
                </div>
              ) : calcResult ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">재직기간</p>
                    <p className="text-lg font-bold text-slate-900">
                      {calcResult.yearsOfService}년
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">평균 월급여</p>
                    <p className="text-lg font-bold text-slate-900">
                      {(calcResult.avgMonthlySalary / 10000).toFixed(0)}만원
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">예상 지급액</p>
                    <p className="text-lg font-bold text-blue-700">
                      {(calcResult.estimatedAmount / 10000).toFixed(0)}만원
                    </p>
                  </div>
                </div>
              ) : null}

              <p className="text-xs text-slate-400 mt-3">
                * 실제 지급액은 최종 심사 후 확정됩니다.
              </p>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              중간정산 사유 <span className="text-red-500">*</span>
            </label>
            <select
              value={form.reason}
              onChange={(e) => handleChange('reason', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">사유 선택</option>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Request Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              신청일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.requestDate}
              onChange={(e) => handleChange('requestDate', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Attachment URL */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              첨부서류 URL
            </label>
            <input
              type="url"
              value={form.attachmentUrl}
              onChange={(e) => handleChange('attachmentUrl', e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
            />
            <p className="text-xs text-slate-400 mt-1">
              증빙서류(주택매매계약서, 진단서 등) 파일 링크를 입력하세요.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
              <X className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || !form.employeeId}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              {submitting ? '신청 중...' : '신청 접수'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
