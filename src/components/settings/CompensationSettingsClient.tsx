'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { SettingsPageLayout } from './SettingsPageLayout'
import type {
  CompensationSettings,
  PayComponent,
  PayComponentType,
  SalaryBandEntry,
  RaiseMatrixEntry,
  BonusRule,
  BandPosition,
  SettingsResponse,
} from '@/types/settings'

const B1_TABS = ['pay-components', 'salary-band', 'raise-matrix', 'bonus-rules']

const PAY_COMPONENT_TYPES: { value: PayComponentType; label: string; color: string }[] = [
  { value: 'BASE', label: '기본급', color: 'bg-[#E8F5E9] text-[#047857]' },
  { value: 'ALLOWANCE', label: '수당', color: 'bg-[#E0E7FF] text-[#4338CA]' },
  { value: 'BONUS', label: '성과급', color: 'bg-[#FEF3C7] text-[#B45309]' },
  { value: 'DEDUCTION', label: '공제', color: 'bg-[#FEE2E2] text-[#DC2626]' },
]

const BAND_POSITIONS: BandPosition[] = ['LOWER', 'MID', 'UPPER']
const BAND_LABELS: Record<BandPosition, string> = {
  LOWER: 'Lower (하위)',
  MID: 'Mid (중위)',
  UPPER: 'Upper (상위)',
}

// ─── Sub-components ──────────────────────────────────────────

function PayComponentsTab({
  settings,
  onChange,
  disabled,
}: {
  settings: CompensationSettings
  onChange: (s: CompensationSettings) => void
  disabled: boolean
}) {
  const addComponent = () => {
    const newComp: PayComponent = {
      code: '',
      label: '',
      type: 'ALLOWANCE',
      taxable: true,
      required: false,
    }
    onChange({ ...settings, payComponents: [...settings.payComponents, newComp] })
  }

  const updateComponent = (i: number, patch: Partial<PayComponent>) => {
    onChange({
      ...settings,
      payComponents: settings.payComponents.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    })
  }

  const removeComponent = (i: number) => {
    onChange({
      ...settings,
      payComponents: settings.payComponents.filter((_, idx) => idx !== i),
    })
  }

  const typeInfo = (type: PayComponentType) =>
    PAY_COMPONENT_TYPES.find((t) => t.value === type)!

  return (
    <div className="space-y-4">
      {settings.payComponents.map((comp, i) => (
        <div key={i} className="rounded-xl border border-[#E8E8E8] bg-white p-4">
          <div className="flex items-start gap-4">
            {/* Type badge + code */}
            <div className="flex-shrink-0 space-y-2">
              <select
                value={comp.type}
                onChange={(e) => updateComponent(i, { type: e.target.value as PayComponentType })}
                disabled={disabled}
                className="rounded-lg border border-[#D4D4D4] px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA]"
              >
                {PAY_COMPONENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Code + label */}
            <div className="flex flex-1 gap-3">
              <div className="w-32">
                <label className="mb-1 block text-xs text-[#666]">코드</label>
                <input
                  value={comp.code}
                  onChange={(e) => updateComponent(i, { code: e.target.value })}
                  disabled={disabled}
                  className="w-full rounded-lg border border-[#D4D4D4] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA] disabled:text-[#999]"
                  placeholder="MEAL_ALLOW"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-[#666]">항목명</label>
                <input
                  value={comp.label}
                  onChange={(e) => updateComponent(i, { label: e.target.value })}
                  disabled={disabled}
                  className="w-full rounded-lg border border-[#D4D4D4] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA] disabled:text-[#999]"
                  placeholder="식대"
                />
              </div>
              {comp.type === 'ALLOWANCE' && (
                <div className="w-32">
                  <label className="mb-1 block text-xs text-[#666]">비과세 한도</label>
                  <input
                    type="number"
                    min={0}
                    value={comp.maxNonTaxable ?? ''}
                    onChange={(e) =>
                      updateComponent(i, {
                        maxNonTaxable: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    disabled={disabled}
                    className="w-full rounded-lg border border-[#D4D4D4] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA]"
                    placeholder="200000"
                  />
                </div>
              )}
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={comp.taxable}
                  onChange={(e) => updateComponent(i, { taxable: e.target.checked })}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-[#D4D4D4] text-[#00C853] disabled:opacity-60"
                />
                <span className="text-xs text-[#555]">과세</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={comp.required}
                  onChange={(e) => updateComponent(i, { required: e.target.checked })}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-[#D4D4D4] text-[#00C853] disabled:opacity-60"
                />
                <span className="text-xs text-[#555]">필수</span>
              </label>
            </div>

            {!disabled && (
              <button
                type="button"
                onClick={() => removeComponent(i)}
                className="flex-shrink-0 rounded-lg p-1.5 text-[#999] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Type badge */}
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeInfo(comp.type).color}`}>
              {typeInfo(comp.type).label}
            </span>
            {comp.taxable && (
              <span className="inline-flex items-center rounded-full border border-[#E8E8E8] bg-[#FAFAFA] px-2.5 py-0.5 text-xs text-[#666]">
                과세
              </span>
            )}
            {comp.required && (
              <span className="inline-flex items-center rounded-full border border-[#FCD34D] bg-[#FEF3C7] px-2.5 py-0.5 text-xs text-[#B45309]">
                필수
              </span>
            )}
          </div>
        </div>
      ))}

      {!disabled && (
        <button
          type="button"
          onClick={addComponent}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#D4D4D4] py-3 text-sm text-[#666] hover:border-[#00C853] hover:text-[#00C853]"
        >
          <Plus className="h-4 w-4" />
          급여항목 추가
        </button>
      )}
    </div>
  )
}

function SalaryBandTab({
  settings,
  onChange,
  disabled,
}: {
  settings: CompensationSettings
  onChange: (s: CompensationSettings) => void
  disabled: boolean
}) {
  const addBand = () => {
    const newBand: SalaryBandEntry = {
      jobLevel: '',
      currency: settings.currency,
      min: 0,
      mid: 0,
      max: 0,
    }
    onChange({ ...settings, salaryBands: [...settings.salaryBands, newBand] })
  }

  const updateBand = (i: number, patch: Partial<SalaryBandEntry>) => {
    onChange({
      ...settings,
      salaryBands: settings.salaryBands.map((b, idx) => (idx === i ? { ...b, ...patch } : b)),
    })
  }

  const removeBand = (i: number) => {
    onChange({
      ...settings,
      salaryBands: settings.salaryBands.filter((_, idx) => idx !== i),
    })
  }

  return (
    <div>
      <div className="rounded-xl border border-[#E8E8E8] bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#F5F5F5] bg-[#FAFAFA]">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">직급</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">통화</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">최저 (Min)</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">중간 (Mid)</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">최고 (Max)</th>
              {!disabled && <th className="px-4 py-2.5 w-10" />}
            </tr>
          </thead>
          <tbody>
            {settings.salaryBands.map((band, i) => (
              <tr key={i} className="border-b border-[#F5F5F5] last:border-0">
                <td className="px-4 py-2">
                  <input
                    value={band.jobLevel}
                    onChange={(e) => updateBand(i, { jobLevel: e.target.value })}
                    disabled={disabled}
                    className="w-20 rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA] disabled:text-[#999]"
                    placeholder="G1"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={band.currency}
                    onChange={(e) => updateBand(i, { currency: e.target.value })}
                    disabled={disabled}
                    className="w-16 rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA] disabled:text-[#999]"
                    placeholder="KRW"
                  />
                </td>
                {(['min', 'mid', 'max'] as const).map((field) => (
                  <td key={field} className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      value={band[field]}
                      onChange={(e) => updateBand(i, { [field]: Number(e.target.value) })}
                      disabled={disabled}
                      className="w-32 rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA]"
                    />
                  </td>
                ))}
                {!disabled && (
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => removeBand(i)}
                      className="rounded p-1 text-[#999] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!disabled && (
          <div className="border-t border-[#F5F5F5] p-3">
            <button
              type="button"
              onClick={addBand}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#D4D4D4] py-2 text-xs text-[#666] hover:border-[#00C853] hover:text-[#00C853]"
            >
              <Plus className="h-3.5 w-3.5" />
              직급 추가
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function RaiseMatrixTab({
  settings,
  onChange,
  disabled,
}: {
  settings: CompensationSettings
  onChange: (s: CompensationSettings) => void
  disabled: boolean
}) {
  // Get unique grades from matrix
  const grades = Array.from(new Set(settings.raiseMatrix.map((r) => r.grade)))

  const getCell = (grade: string, band: BandPosition): RaiseMatrixEntry | undefined =>
    settings.raiseMatrix.find((r) => r.grade === grade && r.bandPosition === band)

  const updateCell = (grade: string, band: BandPosition, raisePct: number) => {
    const existing = settings.raiseMatrix.find(
      (r) => r.grade === grade && r.bandPosition === band
    )
    if (existing) {
      onChange({
        ...settings,
        raiseMatrix: settings.raiseMatrix.map((r) =>
          r.grade === grade && r.bandPosition === band ? { ...r, raisePct } : r
        ),
      })
    } else {
      onChange({
        ...settings,
        raiseMatrix: [...settings.raiseMatrix, { grade, bandPosition: band, raisePct }],
      })
    }
  }

  const addGrade = () => {
    const newGrade = `NEW`
    const newEntries: RaiseMatrixEntry[] = BAND_POSITIONS.map((band) => ({
      grade: newGrade,
      bandPosition: band,
      raisePct: 0,
    }))
    onChange({ ...settings, raiseMatrix: [...settings.raiseMatrix, ...newEntries] })
  }

  const removeGrade = (grade: string) => {
    onChange({
      ...settings,
      raiseMatrix: settings.raiseMatrix.filter((r) => r.grade !== grade),
    })
  }

  const updateGradeCode = (oldGrade: string, newGrade: string) => {
    onChange({
      ...settings,
      raiseMatrix: settings.raiseMatrix.map((r) =>
        r.grade === oldGrade ? { ...r, grade: newGrade } : r
      ),
    })
  }

  return (
    <div>
      <div className="mb-3 rounded-lg border border-[#E0E7FF] bg-[#E0E7FF]/30 px-4 py-3 text-xs text-[#4338CA]">
        등급(행) × Compa-ratio 위치(열) 기준 인상률(%)을 설정합니다.
      </div>
      <div className="rounded-xl border border-[#E8E8E8] bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#F5F5F5] bg-[#FAFAFA]">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">등급</th>
              {BAND_POSITIONS.map((band) => (
                <th key={band} className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">
                  {BAND_LABELS[band]}
                </th>
              ))}
              {!disabled && <th className="px-4 py-2.5 w-10" />}
            </tr>
          </thead>
          <tbody>
            {grades.map((grade) => (
              <tr key={grade} className="border-b border-[#F5F5F5] last:border-0">
                <td className="px-4 py-2">
                  <input
                    value={grade}
                    onChange={(e) => updateGradeCode(grade, e.target.value)}
                    disabled={disabled}
                    className="w-16 rounded border border-[#D4D4D4] px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA] disabled:text-[#999]"
                  />
                </td>
                {BAND_POSITIONS.map((band) => {
                  const cell = getCell(grade, band)
                  return (
                    <td key={band} className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={50}
                          step={0.1}
                          value={cell?.raisePct ?? 0}
                          onChange={(e) => updateCell(grade, band, Number(e.target.value))}
                          disabled={disabled}
                          className="w-20 rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA]"
                        />
                        <span className="text-xs text-[#999]">%</span>
                      </div>
                    </td>
                  )
                })}
                {!disabled && (
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => removeGrade(grade)}
                      className="rounded p-1 text-[#999] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!disabled && (
          <div className="border-t border-[#F5F5F5] p-3">
            <button
              type="button"
              onClick={addGrade}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#D4D4D4] py-2 text-xs text-[#666] hover:border-[#00C853] hover:text-[#00C853]"
            >
              <Plus className="h-3.5 w-3.5" />
              등급 행 추가
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function BonusRulesTab({
  settings,
  onChange,
  disabled,
}: {
  settings: CompensationSettings
  onChange: (s: CompensationSettings) => void
  disabled: boolean
}) {
  const addRule = () => {
    const newRule: BonusRule = { grade: '', months: 1 }
    onChange({ ...settings, bonusRules: [...settings.bonusRules, newRule] })
  }

  const updateRule = (i: number, patch: Partial<BonusRule>) => {
    onChange({
      ...settings,
      bonusRules: settings.bonusRules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    })
  }

  const removeRule = (i: number) => {
    onChange({
      ...settings,
      bonusRules: settings.bonusRules.filter((_, idx) => idx !== i),
    })
  }

  return (
    <div className="space-y-6">
      {/* Bonus type */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[#333]">성과급 유형</h3>
        <div className="flex gap-3">
          {([
            { value: 'GRADE_BASED', label: '등급 기반', desc: '평가등급에 따른 월수 지급' },
            { value: 'PROFIT_SHARING', label: '이익분배', desc: '회사 이익의 일정 비율 배분' },
            { value: 'MIXED', label: '혼합', desc: '등급 기반 + 이익분배 결합' },
          ] as { value: CompensationSettings['bonusType']; label: string; desc: string }[]).map((opt) => (
            <label
              key={opt.value}
              className={`flex-1 cursor-pointer rounded-xl border-2 p-4 transition-colors ${
                settings.bonusType === opt.value
                  ? 'border-[#00C853] bg-[#E8F5E9]'
                  : 'border-[#E8E8E8] bg-white hover:border-[#00C853]/40'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="radio"
                name="bonusType"
                value={opt.value}
                checked={settings.bonusType === opt.value}
                onChange={() => onChange({ ...settings, bonusType: opt.value })}
                disabled={disabled}
                className="sr-only"
              />
              <p className="font-semibold text-sm text-[#1A1A1A]">{opt.label}</p>
              <p className="mt-1 text-xs text-[#666]">{opt.desc}</p>
            </label>
          ))}
        </div>
      </div>

      {/* Bonus rules table */}
      {settings.bonusType !== 'PROFIT_SHARING' && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#333]">등급별 성과급 기준</h3>
          <div className="rounded-xl border border-[#E8E8E8] bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F5F5F5] bg-[#FAFAFA]">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">등급</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">지급 월수</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">비율(%)</th>
                  {!disabled && <th className="px-4 py-2.5 w-10" />}
                </tr>
              </thead>
              <tbody>
                {settings.bonusRules.map((rule, i) => (
                  <tr key={i} className="border-b border-[#F5F5F5] last:border-0">
                    <td className="px-4 py-2">
                      <input
                        value={rule.grade}
                        onChange={(e) => updateRule(i, { grade: e.target.value })}
                        disabled={disabled}
                        className="w-20 rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA]"
                        placeholder="S"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={rule.months ?? ''}
                        onChange={(e) =>
                          updateRule(i, { months: e.target.value ? Number(e.target.value) : undefined })
                        }
                        disabled={disabled}
                        className="w-20 rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA]"
                        placeholder="3"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={200}
                          value={rule.pct ?? ''}
                          onChange={(e) =>
                            updateRule(i, { pct: e.target.value ? Number(e.target.value) : undefined })
                          }
                          disabled={disabled}
                          className="w-20 rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA]"
                          placeholder="150"
                        />
                        <span className="text-xs text-[#999]">%</span>
                      </div>
                    </td>
                    {!disabled && (
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => removeRule(i)}
                          className="rounded p-1 text-[#999] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!disabled && (
              <div className="border-t border-[#F5F5F5] p-3">
                <button
                  type="button"
                  onClick={addRule}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#D4D4D4] py-2 text-xs text-[#666] hover:border-[#00C853] hover:text-[#00C853]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  등급 추가
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab metadata ────────────────────────────────────────────

const TAB_META: Record<string, { title: string; description: string }> = {
  'pay-components': {
    title: '급여항목',
    description: '기본급/각종 수당/비과세 항목 등 급여 구성요소 법인별 정의',
  },
  'salary-band': {
    title: '급여밴드',
    description: '직급/직무별 급여 범위, 시장 데이터 연동 기준',
  },
  'raise-matrix': {
    title: '인상매트릭스',
    description: '성과등급 × 현재 위치(Compa-ratio) 기반 인상률 테이블',
  },
  'bonus-rules': {
    title: '성과급 규칙',
    description: '등급 기반/이익분배/혼합 성과급 유형, 등급별 지급 월수 설정',
  },
}

// ─── Main component ──────────────────────────────────────────

export function CompensationSettingsClient({ activeTab }: { activeTab: string }) {
  const [companyId, setCompanyId] = useState('')
  const [settings, setSettings] = useState<CompensationSettings | null>(null)
  const [isOverride, setIsOverride] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiClient.get<{ id: string }[]>('/api/v1/org/companies').then((res) => {
      if (res.data?.[0]) setCompanyId(res.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!companyId) return
    fetchSettings(companyId)
  }, [companyId])

  async function fetchSettings(cid: string) {
    setLoading(true)
    const res = await apiClient.get<SettingsResponse<CompensationSettings>>(
      `/api/v1/settings/compensation?companyId=${cid}`
    )
    if (res.data) {
      setSettings(res.data.data)
      setIsOverride(res.data.isOverride)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!settings || !companyId) return
    setSaving(true)
    await apiClient.put('/api/v1/settings/compensation', { ...settings, companyId })
    setSaving(false)
  }

  if (!B1_TABS.includes(activeTab)) return null
  if (!companyId) return <div className="py-8 text-center text-sm text-[#999]">법인 정보 로딩 중...</div>

  const meta = TAB_META[activeTab]

  return (
    <SettingsPageLayout
      title={meta.title}
      description={meta.description}
      endpoint="compensation"
      defaultCompanyId={companyId}
      isOverride={isOverride}
      onCompanyChange={(id) => setCompanyId(id)}
      onOverrideChange={() => fetchSettings(companyId)}
      actions={
        isOverride ? (
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#00C853] px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-[#00A844] disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        ) : undefined
      }
    >
      {loading || !settings ? (
        <div className="py-8 text-center text-sm text-[#999]">로딩 중...</div>
      ) : (
        <>
          {activeTab === 'pay-components' && (
            <PayComponentsTab settings={settings} onChange={setSettings} disabled={!isOverride} />
          )}
          {activeTab === 'salary-band' && (
            <SalaryBandTab settings={settings} onChange={setSettings} disabled={!isOverride} />
          )}
          {activeTab === 'raise-matrix' && (
            <RaiseMatrixTab settings={settings} onChange={setSettings} disabled={!isOverride} />
          )}
          {activeTab === 'bonus-rules' && (
            <BonusRulesTab settings={settings} onChange={setSettings} disabled={!isOverride} />
          )}
        </>
      )}
    </SettingsPageLayout>
  )
}
