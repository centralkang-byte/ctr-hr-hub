'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { SettingsPageLayout } from './SettingsPageLayout'
import type { PromotionSettings, JobLevel, PromotionRule, ApprovalStep, SettingsResponse } from '@/types/settings'

const B1_TABS = ['job-levels', 'promotion-rules', 'approval-chain']

const APPROVER_ROLES = [
  { value: 'direct_manager', label: '직속 팀장' },
  { value: 'dept_head', label: '부서장' },
  { value: 'hr_admin', label: 'HR 담당' },
  { value: 'finance', label: '경영관리' },
  { value: 'ceo', label: '대표이사' },
]

const TRACK_TYPES = [
  { value: '', label: '공통' },
  { value: 'IC', label: 'IC (개인기여자)' },
  { value: 'MANAGER', label: 'MANAGER (관리자)' },
]

// ─── Sub-components ──────────────────────────────────────────

function JobLevelsTab({
  settings,
  onChange,
  disabled,
}: {
  settings: PromotionSettings
  onChange: (s: PromotionSettings) => void
  disabled: boolean
}) {
  const addLevel = () => {
    const newLevel: JobLevel = {
      code: '',
      label: '',
      order: settings.jobLevels.length + 1,
      trackType: '',
    }
    onChange({ ...settings, jobLevels: [...settings.jobLevels, newLevel] })
  }

  const updateLevel = (i: number, patch: Partial<JobLevel>) => {
    onChange({
      ...settings,
      jobLevels: settings.jobLevels.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    })
  }

  const removeLevel = (i: number) => {
    onChange({
      ...settings,
      jobLevels: settings.jobLevels
        .filter((_, idx) => idx !== i)
        .map((l, idx) => ({ ...l, order: idx + 1 })),
    })
  }

  return (
    <div>
      <div className="rounded-xl border border-[#E8E8E8] bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#F5F5F5] bg-[#FAFAFA]">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666] w-12">순서</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666] w-28">코드</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">레이블</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666] w-44">트랙 유형</th>
              {!disabled && <th className="px-4 py-2.5 w-10" />}
            </tr>
          </thead>
          <tbody>
            {settings.jobLevels.map((level, i) => (
              <tr key={i} className="border-b border-[#F5F5F5] last:border-0">
                <td className="px-4 py-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00C853] text-xs font-bold text-white">
                    {level.order}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <input
                    value={level.code}
                    onChange={(e) => updateLevel(i, { code: e.target.value })}
                    disabled={disabled}
                    className="w-full rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA] disabled:text-[#999]"
                    placeholder="G1"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={level.label}
                    onChange={(e) => updateLevel(i, { label: e.target.value })}
                    disabled={disabled}
                    className="w-full rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA] disabled:text-[#999]"
                    placeholder="사원"
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={level.trackType ?? ''}
                    onChange={(e) => updateLevel(i, { trackType: e.target.value })}
                    disabled={disabled}
                    className="w-full rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA] disabled:text-[#999]"
                  >
                    {TRACK_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </td>
                {!disabled && (
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => removeLevel(i)}
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
              onClick={addLevel}
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

function PromotionRulesTab({
  settings,
  onChange,
  disabled,
}: {
  settings: PromotionSettings
  onChange: (s: PromotionSettings) => void
  disabled: boolean
}) {
  const addRule = () => {
    const newRule: PromotionRule = { fromLevel: '', toLevel: '', minMonths: 24, requiredGrade: 'B' }
    onChange({ ...settings, promotionRules: [...settings.promotionRules, newRule] })
  }

  const updateRule = (i: number, patch: Partial<PromotionRule>) => {
    onChange({
      ...settings,
      promotionRules: settings.promotionRules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    })
  }

  const removeRule = (i: number) => {
    onChange({
      ...settings,
      promotionRules: settings.promotionRules.filter((_, idx) => idx !== i),
    })
  }

  const levelCodes = settings.jobLevels.map((l) => l.code)

  return (
    <div className="space-y-6">
      {/* Cycle settings */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-[#333]">승진 사이클</h3>
        <div className="flex flex-wrap gap-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#555]">주기</label>
            <select
              value={settings.promotionCycle}
              onChange={(e) =>
                onChange({ ...settings, promotionCycle: e.target.value as PromotionSettings['promotionCycle'] })
              }
              disabled={disabled}
              className="rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA]"
            >
              <option value="ANNUAL">연 1회</option>
              <option value="SEMI_ANNUAL">반기 (연 2회)</option>
              <option value="QUARTERLY">분기 (연 4회)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#555]">승진 기준월</label>
            <select
              value={settings.promotionMonth}
              onChange={(e) => onChange({ ...settings, promotionMonth: Number(e.target.value) })}
              disabled={disabled}
              className="rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA]"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Promotion rules table */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[#333]">직급별 승진 요건</h3>
        <div className="rounded-xl border border-[#E8E8E8] bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F5F5F5] bg-[#FAFAFA]">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">현재 직급</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">승진 직급</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">최소 체류 (개월)</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#666]">필요 등급</th>
                {!disabled && <th className="px-4 py-2.5 w-10" />}
              </tr>
            </thead>
            <tbody>
              {settings.promotionRules.map((rule, i) => (
                <tr key={i} className="border-b border-[#F5F5F5] last:border-0">
                  <td className="px-4 py-2">
                    <select
                      value={rule.fromLevel}
                      onChange={(e) => updateRule(i, { fromLevel: e.target.value })}
                      disabled={disabled}
                      className="w-full rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA]"
                    >
                      <option value="">선택</option>
                      {levelCodes.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={rule.toLevel}
                      onChange={(e) => updateRule(i, { toLevel: e.target.value })}
                      disabled={disabled}
                      className="w-full rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA]"
                    >
                      <option value="">선택</option>
                      {levelCodes.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={1}
                      value={rule.minMonths}
                      onChange={(e) => updateRule(i, { minMonths: Number(e.target.value) })}
                      disabled={disabled}
                      className="w-24 rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA]"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={rule.requiredGrade}
                      onChange={(e) => updateRule(i, { requiredGrade: e.target.value })}
                      disabled={disabled}
                      className="w-20 rounded border border-[#D4D4D4] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA]"
                      placeholder="B"
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
                요건 추가
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ApprovalChainTab({
  settings,
  onChange,
  disabled,
}: {
  settings: PromotionSettings
  onChange: (s: PromotionSettings) => void
  disabled: boolean
}) {
  const addStep = () => {
    const newStep: ApprovalStep = {
      stepOrder: settings.approvalChain.length + 1,
      approverRole: 'hr_admin',
    }
    onChange({ ...settings, approvalChain: [...settings.approvalChain, newStep] })
  }

  const updateStep = (i: number, approverRole: string) => {
    onChange({
      ...settings,
      approvalChain: settings.approvalChain.map((s, idx) =>
        idx === i ? { ...s, approverRole } : s
      ),
    })
  }

  const removeStep = (i: number) => {
    onChange({
      ...settings,
      approvalChain: settings.approvalChain
        .filter((_, idx) => idx !== i)
        .map((s, idx) => ({ ...s, stepOrder: idx + 1 })),
    })
  }

  return (
    <div className="space-y-3">
      {settings.approvalChain.map((step, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-[#E8E8E8] bg-white px-4 py-3"
        >
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#00C853] text-xs font-bold text-white">
            {step.stepOrder}
          </div>
          <select
            value={step.approverRole}
            onChange={(e) => updateStep(i, e.target.value)}
            disabled={disabled}
            className="flex-1 rounded-lg border border-[#D4D4D4] bg-white px-3 py-2 text-sm text-[#333] focus:outline-none focus:ring-2 focus:ring-[#00C853]/20 disabled:bg-[#FAFAFA] disabled:text-[#999]"
          >
            {APPROVER_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          {!disabled && (
            <button
              type="button"
              onClick={() => removeStep(i)}
              className="flex-shrink-0 rounded-lg p-1.5 text-[#999] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={addStep}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#D4D4D4] py-2.5 text-sm text-[#666] hover:border-[#00C853] hover:text-[#00C853]"
        >
          <Plus className="h-4 w-4" />
          단계 추가
        </button>
      )}
    </div>
  )
}

// ─── Tab metadata ────────────────────────────────────────────

const TAB_META: Record<string, { title: string; description: string }> = {
  'job-levels': {
    title: '직급체계',
    description: '직급 정의, 승진 경로, 직급별 권한 매핑 법인별 설정',
  },
  'promotion-rules': {
    title: '승진요건',
    description: '직급 간 최소 체류기간, 필요 평가등급 매트릭스',
  },
  'approval-chain': {
    title: '결재선 설정',
    description: '승진 결재 단계, 단계별 승인자 역할 설정',
  },
}

// ─── Main component ──────────────────────────────────────────

export function PromotionSettingsClient({ activeTab }: { activeTab: string }) {
  const [companyId, setCompanyId] = useState('')
  const [settings, setSettings] = useState<PromotionSettings | null>(null)
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
    const res = await apiClient.get<SettingsResponse<PromotionSettings>>(
      `/api/v1/settings/promotion?companyId=${cid}`
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
    await apiClient.put('/api/v1/settings/promotion', { ...settings, companyId })
    setSaving(false)
  }

  if (!B1_TABS.includes(activeTab)) return null
  if (!companyId) return <div className="py-8 text-center text-sm text-[#999]">법인 정보 로딩 중...</div>

  const meta = TAB_META[activeTab]

  return (
    <SettingsPageLayout
      title={meta.title}
      description={meta.description}
      endpoint="promotion"
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
          {activeTab === 'job-levels' && (
            <JobLevelsTab settings={settings} onChange={setSettings} disabled={!isOverride} />
          )}
          {activeTab === 'promotion-rules' && (
            <PromotionRulesTab settings={settings} onChange={setSettings} disabled={!isOverride} />
          )}
          {activeTab === 'approval-chain' && (
            <ApprovalChainTab settings={settings} onChange={setSettings} disabled={!isOverride} />
          )}
        </>
      )}
    </SettingsPageLayout>
  )
}
