'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 연말정산 위자드 클라이언트 (4-step wizard)
// Step 1: 부양가족 확인
// Step 2: 간소화자료 / 공제항목 입력
// Step 3: 추가공제 입력
// Step 4: 결과 확인
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import {
  FileText,
  Users,
  Calculator,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  Upload,
  Send,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { BUTTON_VARIANTS } from '@/lib/styles'

// ─── Types ─────────────────────────────────────────────────

interface Settlement {
  id: string
  employeeId: string
  year: number
  status: string
  totalSalary: string
  earnedIncomeDeduction: string
  earnedIncome: string
  totalIncomeDeduction: string
  taxableBase: string
  taxRate: number | null
  calculatedTax: string
  totalTaxCredit: string
  determinedTax: string
  prepaidTax: string
  finalSettlement: string
  localTaxSettlement: string
  submittedAt: string | null
  dependents: Dependent[]
  deductions: Deduction[]
  documents: Document[]
}

interface Dependent {
  id: string
  settlementId: string
  relationship: string
  name: string
  birthDate: string | null
  isDisabled: boolean
  isSenior: boolean
  isSingleParent: boolean
  deductionAmount: number
  additionalDeduction: number
}

interface Deduction {
  id: string
  settlementId: string
  configCode: string
  category: string
  name: string
  inputAmount: string
  deductibleAmount: string
}

interface Document {
  id: string
  documentType: string
  fileName: string
  uploadedAt: string
}

interface DeductionInput {
  configCode: string
  category: string
  name: string
  amount: number
}

interface CalculationResult {
  settlement: Settlement
}

// ─── Constants ─────────────────────────────────────────────

const RELATIONSHIP_OPTIONS = ['본인', '배우자', '자녀', '부모', '조부모', '형제자매']

const STEPS = [
  { label: '부양가족 확인', icon: Users },
  { label: '공제항목 입력', icon: FileText },
  { label: '추가공제', icon: Plus },
  { label: '결과 확인', icon: Calculator },
]

const INCOME_DEDUCTIONS: DeductionInput[] = [
  { configCode: 'credit_card', category: 'income_deduction', name: '신용카드 사용액', amount: 0 },
  { configCode: 'debit_card', category: 'income_deduction', name: '체크카드 사용액', amount: 0 },
  { configCode: 'cash_receipt', category: 'income_deduction', name: '현금영수증 사용액', amount: 0 },
]

const TAX_CREDIT_DEDUCTIONS: DeductionInput[] = [
  { configCode: 'medical_credit', category: 'tax_credit', name: '의료비', amount: 0 },
  { configCode: 'education_credit', category: 'tax_credit', name: '본인 교육비', amount: 0 },
  { configCode: 'child_education_credit', category: 'tax_credit', name: '자녀 교육비 (1인당)', amount: 0 },
  { configCode: 'donation_credit', category: 'tax_credit', name: '기부금', amount: 0 },
  { configCode: 'rent_credit', category: 'tax_credit', name: '월세 (연간 총액)', amount: 0 },
]

const ADDITIONAL_DEDUCTIONS: DeductionInput[] = [
  { configCode: 'housing_savings', category: 'income_deduction', name: '주택마련저축 납입액', amount: 0 },
  { configCode: 'housing_loan_interest', category: 'income_deduction', name: '주택임차차입금 이자', amount: 0 },
]

// ─── Formatting helpers ────────────────────────────────────

function formatKRW(value: string | number): string {
  const num = typeof value === 'string' ? parseInt(value, 10) : value
  if (isNaN(num)) return '₩ 0'
  return '₩ ' + num.toLocaleString('ko-KR')
}

function parseAmount(str: string): number {
  const cleaned = str.replace(/[^0-9]/g, '')
  return parseInt(cleaned, 10) || 0
}

function formatAmountInput(value: number): string {
  if (!value) return ''
  return value.toLocaleString('ko-KR')
}

// ─── Step Indicator ────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const Icon = step.icon
        const isActive = i === current
        const isDone = i < current
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors
                  ${isActive ? 'bg-[#5E81F4] text-white' : isDone ? 'bg-[#059669] text-white' : 'bg-[#F5F5F5] text-[#999]'}`}
              >
                {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${isActive ? 'text-[#5E81F4]' : isDone ? 'text-[#059669]' : 'text-[#999]'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mt-[-14px] ${isDone ? 'bg-[#059669]' : 'bg-[#E8E8E8]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: 부양가족 확인 ────────────────────────────────

interface Step1Props {
  dependents: Dependent[]
  onChange: (deps: Dependent[]) => void
}

function Step1Dependents({ dependents, onChange }: Step1Props) {
  const tCommon = useTranslations('common')
  const addDependent = () => {
    const newDep: Dependent = {
      id: `new-${Date.now()}`,
      settlementId: '',
      relationship: '배우자',
      name: '',
      birthDate: null,
      isDisabled: false,
      isSenior: false,
      isSingleParent: false,
      deductionAmount: 1500000,
      additionalDeduction: 0,
    }
    onChange([...dependents, newDep])
  }

  const updateDependent = (index: number, updates: Partial<Dependent>) => {
    const updated = [...dependents]
    updated[index] = { ...updated[index], ...updates }
    onChange(updated)
  }

  const removeDependent = (index: number) => {
    // Cannot remove 본인
    if (dependents[index].relationship === '본인') return
    onChange(dependents.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">부양가족 확인</h2>
          <p className="text-sm text-[#666] mt-0.5">인적공제를 받을 부양가족 정보를 입력하세요.</p>
        </div>
        <button
          onClick={addDependent}
          className={`flex items-center gap-1.5 ${BUTTON_VARIANTS.primary} px-3 py-2 rounded-lg text-sm font-medium`}
        >
          <Plus className="w-4 h-4" />
          부양가족 추가
        </button>
      </div>

      <div className="space-y-3">
        {dependents.map((dep, index) => (
          <div key={dep.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start gap-3">
              <div className="flex-1 grid grid-cols-2 gap-3">
                {/* Relationship */}
                <div>
                  <label className="text-xs font-medium text-[#333] mb-1 block">관계</label>
                  <select
                    value={dep.relationship}
                    onChange={(e) => updateDependent(index, { relationship: e.target.value })}
                    disabled={dep.relationship === '본인'}
                    className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10 disabled:bg-[#F5F5F5] disabled:text-[#999]"
                  >
                    {RELATIONSHIP_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Name */}
                <div>
                  <label className="text-xs font-medium text-[#333] mb-1 block">이름</label>
                  <input
                    type="text"
                    value={dep.name}
                    onChange={(e) => updateDependent(index, { name: e.target.value })}
                    disabled={dep.relationship === '본인'}
                    placeholder={tCommon('enterTitle')}
                    className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10 placeholder:text-[#999] disabled:bg-[#F5F5F5] disabled:text-[#999]"
                  />
                </div>

                {/* Birth Date */}
                <div>
                  <label className="text-xs font-medium text-[#333] mb-1 block">생년월일</label>
                  <input
                    type="date"
                    value={dep.birthDate ? dep.birthDate.substring(0, 10) : ''}
                    onChange={(e) => updateDependent(index, { birthDate: e.target.value || null })}
                    className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10"
                  />
                </div>

                {/* Checkboxes */}
                <div className="flex flex-col gap-2 justify-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dep.isDisabled}
                      onChange={(e) => updateDependent(index, { isDisabled: e.target.checked })}
                      className="w-4 h-4 rounded border-[#D4D4D4] text-[#5E81F4] focus:ring-[#5E81F4]"
                    />
                    <span className="text-sm text-[#555]">장애인</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dep.isSenior}
                      onChange={(e) => updateDependent(index, { isSenior: e.target.checked })}
                      className="w-4 h-4 rounded border-[#D4D4D4] text-[#5E81F4] focus:ring-[#5E81F4]"
                    />
                    <span className="text-sm text-[#555]">경로우대 (70세 이상)</span>
                  </label>
                </div>
              </div>

              {/* Delete button (disabled for 본인) */}
              {dep.relationship !== '본인' && (
                <button
                  onClick={() => removeDependent(index)}
                  className="p-1.5 hover:bg-[#FEE2E2] text-[#DC2626] rounded-lg mt-4"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {dep.relationship === '본인' && (
              <EmptyState title="데이터가 없습니다" description="조건을 변경하거나 새로운 데이터를 추가해보세요." />
            )}
          </div>
        ))}
      </div>

      <div className="bg-[#EDF1FE] rounded-xl p-4 text-sm text-[#047857]">
        <p className="font-medium mb-1">인적공제 안내</p>
        <p>기본공제: 1인당 150만원 / 장애인 추가: 200만원 / 경로우대 추가: 100만원</p>
      </div>
    </div>
  )
}

// ─── Step 2: 공제항목 입력 ────────────────────────────────

interface Step2Props {
  amounts: Record<string, number>
  onChange: (code: string, amount: number) => void
  settlementId: string
  onDocumentUploaded: () => void
}

function Step2Deductions({ amounts, onChange, settlementId, onDocumentUploaded }: Step2Props) {
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('manual')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)

    try {
      // Record document metadata (file upload to storage would happen here)
      await apiClient.post(`/api/v1/year-end/settlements/${settlementId}/documents`, {
        documentType: 'hometax_simplified',
        fileName: file.name,
        filePath: `year-end/${settlementId}/${file.name}`,
      })
      onDocumentUploaded()
    } catch {
      setUploadError('파일 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const allDeductions = [...INCOME_DEDUCTIONS, ...TAX_CREDIT_DEDUCTIONS]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[#1A1A1A]">공제항목 입력</h2>
        <p className="text-sm text-[#666] mt-0.5">홈택스 간소화자료를 업로드하거나 직접 입력하세요.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E8E8E8]">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
            ${activeTab === 'upload' ? 'border-[#5E81F4] text-[#5E81F4]' : 'border-transparent text-[#666] hover:text-[#333]'}`}
        >
          홈택스 간소화자료 업로드
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
            ${activeTab === 'manual' ? 'border-[#5E81F4] text-[#5E81F4]' : 'border-transparent text-[#666] hover:text-[#333]'}`}
        >
          직접 입력
        </button>
      </div>

      {activeTab === 'upload' && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-[#D4D4D4] rounded-xl p-8 text-center hover:border-[#5E81F4] transition-colors">
            <Upload className="w-10 h-10 text-[#999] mx-auto mb-3" />
            <p className="text-sm font-medium text-[#333] mb-1">홈택스 간소화자료 PDF 업로드</p>
            <p className="text-xs text-[#999] mb-4">국세청 홈택스 → 연말정산 → 소득·세액공제자료 조회/발급</p>
            <label className={`cursor-pointer inline-flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg text-sm font-medium`}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? '업로드 중...' : 'PDF 파일 선택'}
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>

          {uploadError && (
            <div className="flex items-center gap-2 text-[#B91C1C] text-sm">
              <AlertTriangle className="w-4 h-4" />
              {uploadError}
            </div>
          )}

          <div className="bg-[#FEF3C7] rounded-xl p-4 text-sm text-[#B45309]">
            <p className="font-medium mb-1">파싱 기능 준비 중</p>
            <p>아래 "직접 입력" 탭에서 금액을 직접 입력해 주세요.</p>
          </div>
        </div>
      )}

      {activeTab === 'manual' && (
        <div className="space-y-6">
          {/* Income deductions */}
          <div className="bg-white rounded-xl border border-[#E8E8E8]">
            <div className="px-5 py-3.5 border-b border-[#F5F5F5]">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">신용카드 등 소득공제</h3>
            </div>
            <div className="p-5 space-y-4">
              {INCOME_DEDUCTIONS.map((item) => (
                <div key={item.configCode}>
                  <label className="text-sm font-medium text-[#333] mb-1 block">{item.name}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#999]">₩</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatAmountInput(amounts[item.configCode] ?? 0)}
                      onChange={(e) => onChange(item.configCode, parseAmount(e.target.value))}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2 border border-[#D4D4D4] rounded-lg text-sm text-right focus:ring-2 focus:ring-[#5E81F4]/10 placeholder:text-[#999]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tax credits */}
          <div className="bg-white rounded-xl border border-[#E8E8E8]">
            <div className="px-5 py-3.5 border-b border-[#F5F5F5]">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">세액공제 항목</h3>
            </div>
            <div className="p-5 space-y-4">
              {TAX_CREDIT_DEDUCTIONS.map((item) => (
                <div key={item.configCode}>
                  <label className="text-sm font-medium text-[#333] mb-1 block">{item.name}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#999]">₩</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatAmountInput(amounts[item.configCode] ?? 0)}
                      onChange={(e) => onChange(item.configCode, parseAmount(e.target.value))}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2 border border-[#D4D4D4] rounded-lg text-sm text-right focus:ring-2 focus:ring-[#5E81F4]/10 placeholder:text-[#999]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step 3: 추가공제 ─────────────────────────────────────

interface Step3Props {
  amounts: Record<string, number>
  onChange: (code: string, amount: number) => void
}

function Step3Additional({ amounts, onChange }: Step3Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[#1A1A1A]">추가공제 입력</h2>
        <p className="text-sm text-[#666] mt-0.5">홈택스 간소화자료에 포함되지 않는 공제 항목입니다.</p>
      </div>

      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        <div className="px-5 py-3.5 border-b border-[#F5F5F5]">
          <h3 className="text-sm font-semibold text-[#1A1A1A]">주택 관련 공제</h3>
        </div>
        <div className="p-5 space-y-4">
          {ADDITIONAL_DEDUCTIONS.map((item) => (
            <div key={item.configCode}>
              <label className="text-sm font-medium text-[#333] mb-1 block">{item.name}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#999]">₩</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatAmountInput(amounts[item.configCode] ?? 0)}
                  onChange={(e) => onChange(item.configCode, parseAmount(e.target.value))}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 border border-[#D4D4D4] rounded-lg text-sm text-right focus:ring-2 focus:ring-[#5E81F4]/10 placeholder:text-[#999]"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#EDF1FE] rounded-xl p-4 text-sm text-[#047857]">
        <p className="font-medium mb-1">주택마련저축 공제 안내</p>
        <p>총급여 7,000만원 이하 무주택 세대주만 공제 가능합니다. (납입액의 40%, 연한도 240만원)</p>
      </div>
    </div>
  )
}

// ─── Step 4: 결과 확인 ────────────────────────────────────

interface Step4Props {
  settlement: Settlement
  onCalculate: () => Promise<void>
  onSubmit: () => Promise<void>
  calculating: boolean
  submitting: boolean
  calcResult: Settlement | null
}

function Step4Result({ settlement, onCalculate, onSubmit, calculating, submitting, calcResult }: Step4Props) {
  const data = calcResult ?? settlement
  const isSubmitted = settlement.status === 'submitted' || settlement.status === 'hr_review' || settlement.status === 'confirmed'

  const finalNum = parseInt(data.finalSettlement ?? '0', 10)
  const isRefund = finalNum < 0
  const isAdditional = finalNum > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">결과 확인</h2>
          <p className="text-sm text-[#666] mt-0.5">{settlement.year}년 연말정산 예상 결과입니다.</p>
        </div>
        {!isSubmitted && (
          <button
            onClick={onCalculate}
            disabled={calculating}
            className="flex items-center gap-2 bg-white border border-[#5E81F4] text-[#5E81F4] hover:bg-[#EDF1FE] px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            {calculating ? '계산 중...' : '재계산'}
          </button>
        )}
      </div>

      {/* 11-step breakdown table */}
      <div className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#F5F5F5]">
          <h3 className="text-sm font-semibold text-[#1A1A1A]">11단계 세액 계산 내역</h3>
        </div>
        <div className="divide-y divide-[#F5F5F5]">
          <ResultRow label="① 총급여" value={data.totalSalary} />
          <ResultRow label="② 근로소득공제" value={data.earnedIncomeDeduction} indent />
          <ResultRow label="③ 근로소득금액" value={data.earnedIncome} highlight />
          <ResultRow label="④ 소득공제 합계" value={data.totalIncomeDeduction} indent />
          <ResultRow label="⑤ 과세표준" value={data.taxableBase} highlight />
          <ResultRow
            label={`⑦ 산출세액 (세율 ${((data.taxRate ?? 0) * 100).toFixed(0)}%)`}
            value={data.calculatedTax}
          />
          <ResultRow label="⑧ 세액공제 합계" value={data.totalTaxCredit} indent />
          <ResultRow label="⑨ 결정세액" value={data.determinedTax} highlight />
          <ResultRow label="⑩ 기납부세액 (원천징수)" value={data.prepaidTax} indent />
          <div className="px-5 py-4 flex items-center justify-between bg-[#F5F5F5]">
            <span className="text-sm font-semibold text-[#1A1A1A]">⑪ 환급 예정 / 추가납부</span>
            <span className={`text-lg font-bold ${isRefund ? 'text-[#059669]' : isAdditional ? 'text-[#DC2626]' : 'text-[#1A1A1A]'}`}>
              {isRefund ? '환급 ' : isAdditional ? '추가납부 ' : ''}
              {formatKRW(Math.abs(finalNum))}
            </span>
          </div>
        </div>
      </div>

      {/* Local tax */}
      <div className="bg-[#FAFAFA] rounded-xl border border-[#E8E8E8] px-5 py-3.5 flex items-center justify-between">
        <span className="text-sm text-[#555]">지방소득세 (소득세의 10%)</span>
        <span className="text-sm font-semibold text-[#1A1A1A]">{formatKRW(data.localTaxSettlement ?? '0')}</span>
      </div>

      {/* Status badges */}
      {isSubmitted && (
        <div className="flex items-center gap-2 bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0] rounded-xl px-5 py-4">
          <CheckCircle2 className="w-5 h-5" />
          <div>
            <p className="text-sm font-semibold">제출 완료</p>
            <p className="text-xs mt-0.5">HR에서 검토 중입니다. 결과는 이메일로 안내드립니다.</p>
          </div>
        </div>
      )}

      {/* Submit button */}
      {!isSubmitted && (
        <button
          onClick={onSubmit}
          disabled={submitting || calculating}
          className={`w-full flex items-center justify-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-3 rounded-xl font-semibold disabled:opacity-50`}
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          {submitting ? '제출 중...' : '연말정산 제출'}
        </button>
      )}
    </div>
  )
}

function ResultRow({ label, value, indent, highlight }: {
  label: string
  value: string | number
  indent?: boolean
  highlight?: boolean
}) {
  return (
    <div className={`px-5 py-3.5 flex items-center justify-between ${highlight ? 'bg-[#F9FFF9]' : ''}`}>
      <span className={`text-sm ${indent ? 'pl-4 text-[#555]' : highlight ? 'font-semibold text-[#1A1A1A]' : 'text-[#333]'}`}>
        {indent && <span className="text-[#999] mr-1">├</span>}
        {label}
      </span>
      <span className={`text-sm ${highlight ? 'font-semibold text-[#1A1A1A]' : 'text-[#555]'}`}>
        {formatKRW(value)}
      </span>
    </div>
  )
}

// ─── Main Wizard Component ─────────────────────────────────

export function YearEndWizardClient({ user, year }: { user: SessionUser; year: number }) {
  const [step, setStep] = useState(0)
  const [settlement, setSettlement] = useState<Settlement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [calcResult, setCalcResult] = useState<Settlement | null>(null)

  // Step 1: dependents state (local edits)
  const [dependents, setDependents] = useState<Dependent[]>([])

  // Step 2 + 3: deduction amounts (local edits)
  const [deductionAmounts, setDeductionAmounts] = useState<Record<string, number>>({})

  // Load settlement on mount
  const loadSettlement = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<Settlement>('/api/v1/year-end/settlements', { year: String(year) })
      if (res.data) {
        setSettlement(res.data)
        setDependents(res.data.dependents ?? [])

        // Restore deduction amounts from saved deductions
        const amounts: Record<string, number> = {}
        for (const d of res.data.deductions ?? []) {
          amounts[d.configCode] = parseInt(d.inputAmount, 10) || 0
        }
        setDeductionAmounts(amounts)
      }
    } catch {
      setError('연말정산 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => {
    void loadSettlement()
  }, [loadSettlement])

  const updateDeductionAmount = (code: string, amount: number) => {
    setDeductionAmounts((prev) => ({ ...prev, [code]: amount }))
  }

  // Save dependents to API
  const saveDependents = async () => {
    if (!settlement) return
    setSaving(true)
    try {
      await apiClient.put(`/api/v1/year-end/settlements/${settlement.id}/dependents`, {
        dependents: dependents.map((d) => ({
          relationship: d.relationship,
          name: d.name,
          birthDate: d.birthDate,
          isDisabled: d.isDisabled,
          isSenior: d.isSenior,
          isSingleParent: d.isSingleParent,
        })),
      })
    } catch {
      setError('부양가족 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // Save deductions to API
  const saveDeductions = async () => {
    if (!settlement) return
    setSaving(true)
    try {
      const allItems = [...INCOME_DEDUCTIONS, ...TAX_CREDIT_DEDUCTIONS, ...ADDITIONAL_DEDUCTIONS]
      const deductionsToSave = allItems
        .filter((item) => (deductionAmounts[item.configCode] ?? 0) > 0)
        .map((item) => ({
          configCode: item.configCode,
          category: item.category,
          name: item.name,
          inputAmount: deductionAmounts[item.configCode] ?? 0,
        }))

      await apiClient.put(`/api/v1/year-end/settlements/${settlement.id}/deductions`, {
        deductions: deductionsToSave,
      })
    } catch {
      setError('공제항목 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // Calculate
  const handleCalculate = async () => {
    if (!settlement) return
    setCalculating(true)
    try {
      const res = await apiClient.post<CalculationResult>(`/api/v1/year-end/settlements/${settlement.id}/calculate`)
      if (res.data?.settlement) {
        setCalcResult(res.data.settlement)
      }
    } catch {
      setError('계산 중 오류가 발생했습니다.')
    } finally {
      setCalculating(false)
    }
  }

  // Submit
  const handleSubmit = async () => {
    if (!settlement) return
    setSubmitting(true)
    try {
      const res = await apiClient.post<Settlement>(`/api/v1/year-end/settlements/${settlement.id}/submit`)
      if (res.data) {
        setSettlement(res.data)
      }
    } catch {
      setError('제출 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  // Navigate to next step with auto-save
  const goNext = async () => {
    if (step === 0) {
      await saveDependents()
    } else if (step === 1 || step === 2) {
      await saveDeductions()
    } else if (step === 3) {
      // On step 4, trigger calculation
      await handleCalculate()
      return
    }

    if (step < 3) {
      // Auto calculate when reaching step 4
      if (step === 2) {
        setStep(3)
        // Give UI time to render then calculate
        setTimeout(() => {
          void handleCalculate()
        }, 100)
      } else {
        setStep((s) => s + 1)
      }
    }
  }

  const goPrev = () => {
    if (step > 0) setStep((s) => s - 1)
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="flex flex-col items-center gap-3 text-[#999]">
          <Loader2 className="w-8 h-8 animate-spin text-[#5E81F4]" />
          <p className="text-sm">연말정산 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error && !settlement) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-[#B91C1C] bg-[#FEE2E2] border border-[#FECACA] rounded-xl px-5 py-4">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  const isSubmitted = settlement?.status === 'submitted' || settlement?.status === 'hr_review' || settlement?.status === 'confirmed'

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-[#5E81F4]" />
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{year}년 연말정산</h1>
          <p className="text-sm text-[#666] mt-0.5">4단계 위자드를 완료하고 제출하세요</p>
        </div>
        {isSubmitted && (
          <span className="ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            제출완료
          </span>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 text-[#B91C1C] text-sm bg-[#FEE2E2] border border-[#FECACA] rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-xs underline">닫기</button>
        </div>
      )}

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Step content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {step === 0 && (
          <Step1Dependents
            dependents={dependents}
            onChange={setDependents}
          />
        )}
        {step === 1 && settlement && (
          <Step2Deductions
            amounts={deductionAmounts}
            onChange={updateDeductionAmount}
            settlementId={settlement.id}
            onDocumentUploaded={() => void loadSettlement()}
          />
        )}
        {step === 2 && (
          <Step3Additional
            amounts={deductionAmounts}
            onChange={updateDeductionAmount}
          />
        )}
        {step === 3 && settlement && (
          <Step4Result
            settlement={settlement}
            onCalculate={handleCalculate}
            onSubmit={handleSubmit}
            calculating={calculating}
            submitting={submitting}
            calcResult={calcResult}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={step === 0}
          className="flex items-center gap-2 bg-white border border-[#D4D4D4] hover:bg-[#FAFAFA] text-[#333] px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
          이전
        </button>

        <span className="text-sm text-[#999]">
          {step + 1} / {STEPS.length}
        </span>

        {step < 3 ? (
          <button
            onClick={() => void goNext()}
            disabled={saving}
            className={`flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? '저장 중...' : '다음'}
            {!saving && <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <div /> // placeholder to maintain layout
        )}
      </div>
    </div>
  )
}
