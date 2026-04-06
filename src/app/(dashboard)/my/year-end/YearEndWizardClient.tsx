'use client'

import { EmptyState } from '@/components/ui/EmptyState'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 연말정산 위자드 클라이언트 (4-step wizard)
// Step 1: 부양가족 확인
// Step 2: 간소화자료 / 공제항목 입력
// Step 3: 추가공제 입력
// Step 4: 결과 확인
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
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

const RELATIONSHIP_OPTIONS = [
  { value: '본인', labelKey: 'relationship.self' },
  { value: '배우자', labelKey: 'relationship.spouse' },
  { value: '자녀', labelKey: 'relationship.child' },
  { value: '부모', labelKey: 'relationship.parent' },
  { value: '조부모', labelKey: 'relationship.grandparent' },
  { value: '형제자매', labelKey: 'relationship.sibling' },
] as const

const STEPS = [
  { labelKey: 'steps.dependents', icon: Users },
  { labelKey: 'steps.deductions', icon: FileText },
  { labelKey: 'steps.additional', icon: Plus },
  { labelKey: 'steps.result', icon: Calculator },
] as const

const INCOME_DEDUCTIONS: DeductionInput[] = [
  { configCode: 'credit_card', category: 'income_deduction', name: '신용카드 사용액', amount: 0 },
  { configCode: 'debit_card', category: 'income_deduction', name: '체크카드 사용액', amount: 0 },
  { configCode: 'cash_receipt', category: 'income_deduction', name: '현금영수증 사용액', amount: 0 },
]

const INCOME_DEDUCTION_NAME_KEYS: Record<string, string> = {
  credit_card: 'deduction.credit_card',
  debit_card: 'deduction.debit_card',
  cash_receipt: 'deduction.cash_receipt',
}

const TAX_CREDIT_DEDUCTIONS: DeductionInput[] = [
  { configCode: 'medical_credit', category: 'tax_credit', name: '의료비', amount: 0 },
  { configCode: 'education_credit', category: 'tax_credit', name: '본인 교육비', amount: 0 },
  { configCode: 'child_education_credit', category: 'tax_credit', name: '자녀 교육비 (1인당)', amount: 0 },
  { configCode: 'donation_credit', category: 'tax_credit', name: '기부금', amount: 0 },
  { configCode: 'rent_credit', category: 'tax_credit', name: '월세 (연간 총액)', amount: 0 },
]

const TAX_CREDIT_NAME_KEYS: Record<string, string> = {
  medical_credit: 'deduction.medical_credit',
  education_credit: 'deduction.education_credit',
  child_education_credit: 'deduction.child_education_credit',
  donation_credit: 'deduction.donation_credit',
  rent_credit: 'deduction.rent_credit',
}

const ADDITIONAL_DEDUCTIONS: DeductionInput[] = [
  { configCode: 'housing_savings', category: 'income_deduction', name: '주택마련저축 납입액', amount: 0 },
  { configCode: 'housing_loan_interest', category: 'income_deduction', name: '주택임차차입금 이자', amount: 0 },
]

const ADDITIONAL_NAME_KEYS: Record<string, string> = {
  housing_savings: 'deduction.housing_savings',
  housing_loan_interest: 'deduction.housing_loan_interest',
}

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
  const t = useTranslations('yearEnd')
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
                  ${isActive ? 'bg-primary text-white' : isDone ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'}`}
              >
                {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${isActive ? 'text-primary' : isDone ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                {t(step.labelKey)}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mt-[-14px] ${isDone ? 'bg-emerald-600' : 'bg-border'}`} />
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
  const t = useTranslations('yearEnd')

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
          <h2 className="text-lg font-semibold text-foreground">{t('step1.title')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t('step1.description')}</p>
        </div>
        <button
          onClick={addDependent}
          className={`flex items-center gap-1.5 ${BUTTON_VARIANTS.primary} px-3 py-2 rounded-lg text-sm font-medium`}
        >
          <Plus className="w-4 h-4" />
          {t('step1.addDependent')}
        </button>
      </div>

      <div className="space-y-3">
        {dependents.map((dep, index) => (
          <div key={dep.id} className="bg-card rounded-xl shadow-sm border border-border p-6">
            <div className="flex items-start gap-3">
              <div className="flex-1 grid grid-cols-2 gap-3">
                {/* Relationship */}
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">{t('step1.relationship')}</label>
                  <select
                    value={dep.relationship}
                    onChange={(e) => updateDependent(index, { relationship: e.target.value })}
                    disabled={dep.relationship === '본인'}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 disabled:bg-muted disabled:text-muted-foreground"
                  >
                    {RELATIONSHIP_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{t(r.labelKey)}</option>
                    ))}
                  </select>
                </div>

                {/* Name */}
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">{t('step1.name')}</label>
                  <input
                    type="text"
                    value={dep.name}
                    onChange={(e) => updateDependent(index, { name: e.target.value })}
                    disabled={dep.relationship === '본인'}
                    placeholder={t('step1.enterName')}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground disabled:bg-muted disabled:text-muted-foreground"
                  />
                </div>

                {/* Birth Date */}
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">{t('step1.birthDate')}</label>
                  <input
                    type="date"
                    value={dep.birthDate ? dep.birthDate.substring(0, 10) : ''}
                    onChange={(e) => updateDependent(index, { birthDate: e.target.value || null })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                {/* Checkboxes */}
                <div className="flex flex-col gap-2 justify-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dep.isDisabled}
                      onChange={(e) => updateDependent(index, { isDisabled: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-muted-foreground">{t('step1.disabled')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dep.isSenior}
                      onChange={(e) => updateDependent(index, { isSenior: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-muted-foreground">{t('step1.senior')}</span>
                  </label>
                </div>
              </div>

              {/* Delete button (disabled for 본인) */}
              {dep.relationship !== '본인' && (
                <button
                  onClick={() => removeDependent(index)}
                  className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg mt-4"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {dep.relationship === '본인' && (
              <EmptyState />
            )}
          </div>
        ))}
      </div>

      <div className="bg-primary/10 rounded-xl p-4 text-sm text-emerald-700">
        <p className="font-medium mb-1">{t('step1.deductionGuideTitle')}</p>
        <p>{t('step1.deductionGuideBody')}</p>
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
  const t = useTranslations('yearEnd')
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
      setUploadError(t('error.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('step2.title')}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t('step2.description')}</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
            ${activeTab === 'upload' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          {t('step2.tabUpload')}
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
            ${activeTab === 'manual' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          {t('step2.tabManual')}
        </button>
      </div>

      {activeTab === 'upload' && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary transition-colors">
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">{t('step2.uploadTitle')}</p>
            <p className="text-xs text-muted-foreground mb-4">{t('step2.uploadGuide')}</p>
            <label className={`cursor-pointer inline-flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg text-sm font-medium`}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? t('step2.uploading') : t('step2.selectPdf')}
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
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="w-4 h-4" />
              {uploadError}
            </div>
          )}

          <div className="bg-amber-500/15 rounded-xl p-4 text-sm text-amber-700">
            <p className="font-medium mb-1">{t('step2.parsingNotReady')}</p>
            <p>{t('step2.parsingNotReadyDesc')}</p>
          </div>
        </div>
      )}

      {activeTab === 'manual' && (
        <div className="space-y-6">
          {/* Income deductions */}
          <div className="bg-card rounded-xl border border-border">
            <div className="px-5 py-3.5 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">{t('step2.incomeDeductionHeader')}</h3>
            </div>
            <div className="p-5 space-y-4">
              {INCOME_DEDUCTIONS.map((item) => (
                <div key={item.configCode}>
                  <label className="text-sm font-medium text-foreground mb-1 block">{t(INCOME_DEDUCTION_NAME_KEYS[item.configCode])}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₩</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatAmountInput(amounts[item.configCode] ?? 0)}
                      onChange={(e) => onChange(item.configCode, parseAmount(e.target.value))}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2 border border-border rounded-lg text-sm text-right focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tax credits */}
          <div className="bg-card rounded-xl border border-border">
            <div className="px-5 py-3.5 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">{t('step2.taxCreditHeader')}</h3>
            </div>
            <div className="p-5 space-y-4">
              {TAX_CREDIT_DEDUCTIONS.map((item) => (
                <div key={item.configCode}>
                  <label className="text-sm font-medium text-foreground mb-1 block">{t(TAX_CREDIT_NAME_KEYS[item.configCode])}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₩</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatAmountInput(amounts[item.configCode] ?? 0)}
                      onChange={(e) => onChange(item.configCode, parseAmount(e.target.value))}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2 border border-border rounded-lg text-sm text-right focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
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
  const t = useTranslations('yearEnd')
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('step3.title')}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t('step3.description')}</p>
      </div>

      <div className="bg-card rounded-xl border border-border">
        <div className="px-5 py-3.5 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">{t('step3.housingHeader')}</h3>
        </div>
        <div className="p-5 space-y-4">
          {ADDITIONAL_DEDUCTIONS.map((item) => (
            <div key={item.configCode}>
              <label className="text-sm font-medium text-foreground mb-1 block">{t(ADDITIONAL_NAME_KEYS[item.configCode])}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₩</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatAmountInput(amounts[item.configCode] ?? 0)}
                  onChange={(e) => onChange(item.configCode, parseAmount(e.target.value))}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 border border-border rounded-lg text-sm text-right focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-primary/10 rounded-xl p-4 text-sm text-emerald-700">
        <p className="font-medium mb-1">{t('step3.housingGuideTitle')}</p>
        <p>{t('step3.housingGuideBody')}</p>
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
  const t = useTranslations('yearEnd')
  const data = calcResult ?? settlement
  const isSubmitted = settlement.status === 'submitted' || settlement.status === 'hr_review' || settlement.status === 'confirmed'

  const finalNum = parseInt(data.finalSettlement ?? '0', 10)
  const isRefund = finalNum < 0
  const isAdditional = finalNum > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('step4.title')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t('step4.description', { year: settlement.year })}</p>
        </div>
        {!isSubmitted && (
          <button
            onClick={onCalculate}
            disabled={calculating}
            className="flex items-center gap-2 bg-card border border-primary text-primary hover:bg-primary/10 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            {calculating ? t('step4.calculating') : t('step4.recalculate')}
          </button>
        )}
      </div>

      {/* 11-step breakdown table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">{t('step4.breakdownHeader')}</h3>
        </div>
        <div className="divide-y divide-border">
          <ResultRow label={t('result.totalSalary')} value={data.totalSalary} />
          <ResultRow label={t('result.earnedIncomeDeduction')} value={data.earnedIncomeDeduction} indent />
          <ResultRow label={t('result.earnedIncome')} value={data.earnedIncome} highlight />
          <ResultRow label={t('result.totalIncomeDeduction')} value={data.totalIncomeDeduction} indent />
          <ResultRow label={t('result.taxableBase')} value={data.taxableBase} highlight />
          <ResultRow
            label={t('result.calculatedTax', { rate: ((data.taxRate ?? 0) * 100).toFixed(0) })}
            value={data.calculatedTax}
          />
          <ResultRow label={t('result.totalTaxCredit')} value={data.totalTaxCredit} indent />
          <ResultRow label={t('result.determinedTax')} value={data.determinedTax} highlight />
          <ResultRow label={t('result.prepaidTax')} value={data.prepaidTax} indent />
          <div className="px-5 py-4 flex items-center justify-between bg-muted">
            <span className="text-sm font-semibold text-foreground">{t('result.finalSettlement')}</span>
            <span className={`text-lg font-bold ${isRefund ? 'text-emerald-600' : isAdditional ? 'text-destructive' : 'text-foreground'}`}>
              {isRefund ? t('result.refund') + ' ' : isAdditional ? t('result.additionalPayment') + ' ' : ''}
              {formatKRW(Math.abs(finalNum))}
            </span>
          </div>
        </div>
      </div>

      {/* Local tax */}
      <div className="bg-background rounded-xl border border-border px-5 py-3.5 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('result.localTax')}</span>
        <span className="text-sm font-semibold text-foreground">{formatKRW(data.localTaxSettlement ?? '0')}</span>
      </div>

      {/* Status badges */}
      {isSubmitted && (
        <div className="flex items-center gap-2 bg-emerald-500/15 text-emerald-700 border border-emerald-200 rounded-xl px-5 py-4">
          <CheckCircle2 className="w-5 h-5" />
          <div>
            <p className="text-sm font-semibold">{t('step4.submittedTitle')}</p>
            <p className="text-xs mt-0.5">{t('step4.submittedDesc')}</p>
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
          {submitting ? t('step4.submitting') : t('step4.submit')}
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
    <div className={`px-5 py-3.5 flex items-center justify-between ${highlight ? 'bg-tertiary-container/10' : ''}`}>
      <span className={`text-sm ${indent ? 'pl-4 text-muted-foreground' : highlight ? 'font-semibold text-foreground' : 'text-foreground'}`}>
        {indent && <span className="text-muted-foreground mr-1">├</span>}
        {label}
      </span>
      <span className={`text-sm ${highlight ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
        {formatKRW(value)}
      </span>
    </div>
  )
}

// ─── Main Wizard Component ─────────────────────────────────

export function YearEndWizardClient({ user: _user, year }: { user: SessionUser; year: number }) {
  const t = useTranslations('yearEnd')
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
      setError(t('error.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [year, t])

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
      setError(t('error.saveDependentsFailed'))
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
      setError(t('error.saveDeductionsFailed'))
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
      setError(t('error.calculateFailed'))
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
      setError(t('error.submitFailed'))
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
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (error && !settlement) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-5 py-4">
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
        <FileText className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('pageTitle', { year })}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('pageDescription')}</p>
        </div>
        {isSubmitted && (
          <span className="ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t('status.submitted')}
          </span>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-xs underline">{t('close')}</button>
        </div>
      )}

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Step content */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
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
          className="flex items-center gap-2 bg-card border border-border hover:bg-background text-foreground px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('nav.previous')}
        </button>

        <span className="text-sm text-muted-foreground">
          {step + 1} / {STEPS.length}
        </span>

        {step < 3 ? (
          <button
            onClick={() => void goNext()}
            disabled={saving}
            className={`flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? t('nav.saving') : t('nav.next')}
            {!saving && <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <div /> // placeholder to maintain layout
        )}
      </div>
    </div>
  )
}
