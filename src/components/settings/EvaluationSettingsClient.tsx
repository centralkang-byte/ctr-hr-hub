'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { SettingsPageLayout } from './SettingsPageLayout'
import type {
  EvaluationSettings,
  EvaluationMethodology,
  OverallGradeMethod,
  GradeItem,
  DistributionRule,
  SettingsResponse,
} from '@/types/settings'

const B1_TABS = ['methodology', 'grade-system', 'forced-distribution']

// ─── Sub-components ──────────────────────────────────────────

function MethodologyTab({
  settings,
  onChange,
  disabled,
}: {
  settings: EvaluationSettings
  onChange: (s: EvaluationSettings) => void
  disabled: boolean
}) {
  const isMBOBEI = settings.methodology === 'MBO_BEI'

  const setMethodology = (v: EvaluationMethodology) =>
    onChange({ ...settings, methodology: v })

  const setMboWeight = (v: number) =>
    onChange({ ...settings, mboWeight: v, beiWeight: 100 - v })

  return (
    <div className="space-y-8">
      {/* Methodology */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[#333]">평가 방법론</h3>
        <div className="flex gap-3">
          {([
            { value: 'MBO_ONLY', label: 'MBO Only', desc: '업적 평가만 진행' },
            { value: 'MBO_BEI', label: 'MBO + BEI', desc: '업적 + 역량 병행' },
          ] as { value: EvaluationMethodology; label: string; desc: string }[]).map((opt) => (
            <label
              key={opt.value}
              className={`flex-1 cursor-pointer rounded-xl border-2 p-4 transition-colors ${
                settings.methodology === opt.value
                  ? 'border-[#00C853] bg-[#E8F5E9]'
                  : 'border-[#E8E8E8] bg-white hover:border-[#00C853]/40'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="radio"
                name="methodology"
                value={opt.value}
                checked={settings.methodology === opt.value}
                onChange={() => setMethodology(opt.value)}
                disabled={disabled}
                className="sr-only"
              />
              <p className="font-semibold text-sm text-[#1A1A1A]">{opt.label}</p>
              <p className="mt-1 text-xs text-[#666]">{opt.desc}</p>
            </label>
          ))}
        </div>
      </div>

      {/* Weights (MBO+BEI only) */}
      {isMBOBEI && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#333]">업적/역량 비중</h3>
          <div className="rounded-xl border border-[#E8E8E8] bg-white p-5 space-y-4">
            <div className="flex items-center gap-4">
              <span className="w-20 text-sm text-[#555]">MBO 비중</span>
              <input
                type="range"
                min={10}
                max={90}
                step={5}
                value={settings.mboWeight}
                onChange={(e) => setMboWeight(Number(e.target.value))}
                disabled={disabled}
                className="flex-1 accent-[#00C853] disabled:opacity-60"
              />
              <span className="w-12 text-right text-sm font-medium text-[#1A1A1A]">
                {settings.mboWeight}%
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="w-20 text-sm text-[#555]">BEI 비중</span>
              <div className="flex-1 h-2 rounded-full bg-[#E8E8E8]">
                <div
                  className="h-2 rounded-full bg-[#059669]"
                  style={{ width: `${settings.beiWeight}%` }}
                />
              </div>
              <span className="w-12 text-right text-sm font-medium text-[#1A1A1A]">
                {settings.beiWeight}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Overall grade method */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[#333]">종합등급 산출 방식</h3>
        <div className="flex gap-3">
          {([
            { value: 'WEIGHTED', label: '가중평균', desc: '업적·역량 비중 적용 평균' },
            { value: 'MATRIX', label: '매트릭스', desc: '업적 × 역량 교차표' },
            { value: 'MANUAL', label: '수동입력', desc: '평가자가 직접 종합등급 입력' },
          ] as { value: OverallGradeMethod; label: string; desc: string }[]).map((opt) => (
            <label
              key={opt.value}
              className={`flex-1 cursor-pointer rounded-xl border-2 p-4 transition-colors ${
                settings.overallGradeMethod === opt.value
                  ? 'border-[#00C853] bg-[#E8F5E9]'
                  : 'border-[#E8E8E8] bg-white hover:border-[#00C853]/40'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="radio"
                name="overallGradeMethod"
                value={opt.value}
                checked={settings.overallGradeMethod === opt.value}
                onChange={() => onChange({ ...settings, overallGradeMethod: opt.value })}
                disabled={disabled}
                className="sr-only"
              />
              <p className="font-semibold text-sm text-[#1A1A1A]">{opt.label}</p>
              <p className="mt-1 text-xs text-[#666]">{opt.desc}</p>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

function GradeEditor({
  title,
  grades,
  onChange,
  disabled,
}: {
  title: string
  grades: GradeItem[]
  onChange: (g: GradeItem[]) => void
  disabled: boolean
}) {
  const addGrade = () => {
    const next: GradeItem = { code: '', label: '', order: grades.length + 1 }
    onChange([...grades, next])
  }

  const updateGrade = (i: number, patch: Partial<GradeItem>) => {
    onChange(grades.map((g, idx) => (idx === i ? { ...g, ...patch } : g)))
  }

  const removeGrade = (i: number) => {
    onChange(grades.filter((_, idx) => idx !== i).map((g, idx) => ({ ...g, order: idx + 1 })))
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-[#333]">{title}</h3>
      <div className="rounded-xl border border-[#E8E8E8] bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#F5F5F5] bg-[#FAFAFA]">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666] w-12">순서</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666] w-32">코드</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">레이블</th>
              {!disabled && <th className="px-4 py-2.5 w-10" />}
            </tr>
          </thead>
          <tbody>
            {grades.map((g, i) => (
              <tr key={i} className="border-b border-[#F5F5F5] last:border-0">
                <td className="px-4 py-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00C853] text-xs font-bold text-white">
                    {g.order}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <input
                    value={g.code}
                    onChange={(e) => updateGrade(i, { code: e.target.value })}
                    disabled={disabled}
                    className="w-full rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA] disabled:text-[#999]"
                    placeholder="S"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={g.label}
                    onChange={(e) => updateGrade(i, { label: e.target.value })}
                    disabled={disabled}
                    className="w-full rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA] disabled:text-[#999]"
                    placeholder="최우수"
                  />
                </td>
                {!disabled && (
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => removeGrade(i)}
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
              등급 추가
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function GradeSystemTab({
  settings,
  onChange,
  disabled,
}: {
  settings: EvaluationSettings
  onChange: (s: EvaluationSettings) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-6">
      <GradeEditor
        title="MBO 등급 체계"
        grades={settings.mboGrades}
        onChange={(g) => onChange({ ...settings, mboGrades: g })}
        disabled={disabled}
      />
      {settings.methodology === 'MBO_BEI' && (
        <GradeEditor
          title="BEI(역량) 등급 체계"
          grades={settings.beiGrades}
          onChange={(g) => onChange({ ...settings, beiGrades: g })}
          disabled={disabled}
        />
      )}
    </div>
  )
}

function ForcedDistributionTab({
  settings,
  onChange,
  disabled,
}: {
  settings: EvaluationSettings
  onChange: (s: EvaluationSettings) => void
  disabled: boolean
}) {
  const addRule = () => {
    const newRule: DistributionRule = { gradeCode: '', minPct: 0, maxPct: 100 }
    onChange({ ...settings, distributionRules: [...settings.distributionRules, newRule] })
  }

  const updateRule = (i: number, patch: Partial<DistributionRule>) => {
    const rules = settings.distributionRules.map((r, idx) =>
      idx === i ? { ...r, ...patch } : r
    )
    onChange({ ...settings, distributionRules: rules })
  }

  const removeRule = (i: number) => {
    onChange({
      ...settings,
      distributionRules: settings.distributionRules.filter((_, idx) => idx !== i),
    })
  }

  return (
    <div className="space-y-6">
      {/* Enable toggle */}
      <div className="flex items-center justify-between rounded-xl border border-[#E8E8E8] bg-white px-5 py-4">
        <div>
          <p className="text-sm font-medium text-[#333]">강제배분 사용</p>
          <p className="mt-0.5 text-xs text-[#666]">등급별 배분 비율을 강제로 제한합니다</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ ...settings, forcedDistribution: !settings.forcedDistribution })}
          className={`relative h-6 w-11 rounded-full transition-colors disabled:cursor-not-allowed ${
            settings.forcedDistribution ? 'bg-[#00C853]' : 'bg-[#E8E8E8]'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              settings.forcedDistribution ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {settings.forcedDistribution && (
        <>
          {/* Soft / Hard */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-[#333]">배분 방식</h3>
            <div className="flex gap-3">
              {([
                { value: 'SOFT', label: 'Soft', desc: '가이드라인 — 예외 허용' },
                { value: 'HARD', label: 'Hard', desc: '엄격 적용 — 예외 불가' },
              ] as { value: 'SOFT' | 'HARD'; label: string; desc: string }[]).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex-1 cursor-pointer rounded-xl border-2 p-4 transition-colors ${
                    settings.forcedDistributionType === opt.value
                      ? 'border-[#00C853] bg-[#E8F5E9]'
                      : 'border-[#E8E8E8] bg-white hover:border-[#00C853]/40'
                  } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <input
                    type="radio"
                    name="fdType"
                    value={opt.value}
                    checked={settings.forcedDistributionType === opt.value}
                    onChange={() => onChange({ ...settings, forcedDistributionType: opt.value })}
                    disabled={disabled}
                    className="sr-only"
                  />
                  <p className="font-semibold text-sm text-[#1A1A1A]">{opt.label}</p>
                  <p className="mt-1 text-xs text-[#666]">{opt.desc}</p>
                </label>
              ))}
            </div>
          </div>

          {/* Distribution rules table */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-[#333]">등급별 배분 비율</h3>
            <div className="rounded-xl border border-[#E8E8E8] bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F5F5F5] bg-[#FAFAFA]">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">등급 코드</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">최소(%)</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">최대(%)</th>
                    {!disabled && <th className="px-4 py-2.5 w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {settings.distributionRules.map((rule, i) => (
                    <tr key={i} className="border-b border-[#F5F5F5] last:border-0">
                      <td className="px-4 py-2">
                        <input
                          value={rule.gradeCode}
                          onChange={(e) => updateRule(i, { gradeCode: e.target.value })}
                          disabled={disabled}
                          className="w-24 rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA]"
                          placeholder="S"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={rule.minPct}
                          onChange={(e) => updateRule(i, { minPct: Number(e.target.value) })}
                          disabled={disabled}
                          className="w-20 rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA]"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={rule.maxPct}
                          onChange={(e) => updateRule(i, { maxPct: Number(e.target.value) })}
                          disabled={disabled}
                          className="w-20 rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA]"
                        />
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
                    규칙 추가
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Tab metadata ────────────────────────────────────────────

const TAB_META: Record<string, { title: string; description: string }> = {
  methodology: {
    title: '평가 방법론',
    description: 'MBO/MBO+BEI 병행 여부, 업적·역량 비중, 종합등급 산출 방식 법인별 설정',
  },
  'grade-system': {
    title: '등급체계',
    description: 'S/A/B/C/D 등급 정의, 표시 레이블 커스터마이징',
  },
  'forced-distribution': {
    title: '강제배분',
    description: 'Soft/Hard 강제배분 선택, 등급별 최소·최대 비율 설정',
  },
}

// ─── Main component ──────────────────────────────────────────

export function EvaluationSettingsClient({ activeTab }: { activeTab: string }) {
  const [companyId, setCompanyId] = useState('')
  const [settings, setSettings] = useState<EvaluationSettings | null>(null)
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
    const res = await apiClient.get<SettingsResponse<EvaluationSettings>>(
      `/api/v1/settings/evaluation?companyId=${cid}`
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
    await apiClient.put('/api/v1/settings/evaluation', { ...settings, companyId })
    setSaving(false)
  }

  if (!B1_TABS.includes(activeTab)) return null
  if (!companyId) return <div className="py-8 text-center text-sm text-[#999]">법인 정보 로딩 중...</div>

  const meta = TAB_META[activeTab]

  return (
    <SettingsPageLayout
      title={meta.title}
      description={meta.description}
      endpoint="evaluation"
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
          {activeTab === 'methodology' && (
            <MethodologyTab settings={settings} onChange={setSettings} disabled={!isOverride} />
          )}
          {activeTab === 'grade-system' && (
            <GradeSystemTab settings={settings} onChange={setSettings} disabled={!isOverride} />
          )}
          {activeTab === 'forced-distribution' && (
            <ForcedDistributionTab settings={settings} onChange={setSettings} disabled={!isOverride} />
          )}
        </>
      )}
    </SettingsPageLayout>
  )
}
