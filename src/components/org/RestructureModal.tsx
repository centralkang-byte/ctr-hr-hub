// ═══════════════════════════════════════════════════════════
// CTR HR Hub — RestructureModal
// B8-1 Task 4: 조직 개편 워크플로 편집기
// ChangeTypes: create | move | merge | rename | close | transfer_employee
// ═══════════════════════════════════════════════════════════

'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, Plus, Trash2, ChevronRight, GitBranch, ArrowRight } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { EffectiveDatePicker } from '@/components/shared/EffectiveDatePicker'
import { RestructureDiffView } from '@/components/org/RestructureDiffView'
import { BUTTON_VARIANTS,  MODAL_STYLES } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

export type ChangeType =
  | 'create'
  | 'move'
  | 'merge'
  | 'rename'
  | 'close'
  | 'transfer_employee'

export interface OrgChange {
  id: string
  type: ChangeType
  // create
  newDeptName?: string
  newDeptCode?: string
  newDeptParentId?: string | null
  // move: move a department under new parent
  deptId?: string
  targetParentId?: string | null
  // merge: source → target
  sourceDeptId?: string
  targetDeptId?: string
  // rename
  renameDeptId?: string
  newName?: string
  newNameEn?: string
  // close
  closeDeptId?: string
  // transfer_employee
  employeeId?: string
  fromDeptId?: string
  toDeptId?: string
}

export interface RestructurePlanDraft {
  title: string
  description: string
  effectiveDate: Date
  changes: OrgChange[]
}

interface DeptOption {
  id: string
  name: string
  code: string
  level: number
  parentId: string | null
  employeeCount: number
}

interface EmployeeOption {
  id: string
  name: string
  employeeNo: string
  departmentId: string | null
}

interface RestructureModalProps {
  companyId: string
  onClose: () => void
  onApplied: () => void
}

// ─── Helpers ────────────────────────────────────────────────

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  create: '부서 신설',
  move: '부서 이동',
  merge: '부서 통합',
  rename: '부서 명칭 변경',
  close: '부서 폐지',
  transfer_employee: '인원 이동',
}

const CHANGE_TYPE_COLORS: Record<ChangeType, string> = {
  create: 'bg-[#D1FAE5] text-[#047857]',
  move: 'bg-[#DBEAFE] text-[#1D4ED8]',
  merge: 'bg-[#E0E7FF] text-[#4B6DE0]',
  rename: 'bg-[#FEF3C7] text-[#B45309]',
  close: 'bg-[#FEE2E2] text-[#B91C1C]',
  transfer_employee: 'bg-[#F3E8FF] text-[#7C3AED]',
}

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

// ─── Change Item Editor ─────────────────────────────────────

interface ChangeEditorProps {
  change: OrgChange
  depts: DeptOption[]
  employees: EmployeeOption[]
  onChange: (updated: OrgChange) => void
  onRemove: () => void
  idx: number
}

function ChangeEditor({ change, depts, employees, onChange, onRemove, idx }: ChangeEditorProps) {
  const update = (patch: Partial<OrgChange>) => onChange({ ...change, ...patch })

  const deptOptions = depts.map((d) => (
    <option key={d.id} value={d.id}>
      {'  '.repeat(d.level)}{d.name} ({d.code})
    </option>
  ))

  return (
    <div className="border border-[#E8E8E8] rounded-xl p-4 space-y-3 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-[#999] w-5">{idx + 1}.</span>
        <select
          value={change.type}
          onChange={(e) => update({ type: e.target.value as ChangeType })}
          className="text-sm border border-[#D4D4D4] rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10"
        >
          {(Object.keys(CHANGE_TYPE_LABELS) as ChangeType[]).map((t) => (
            <option key={t} value={t}>{CHANGE_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CHANGE_TYPE_COLORS[change.type]}`}>
          {CHANGE_TYPE_LABELS[change.type]}
        </span>
        <button
          onClick={onRemove}
          className="ml-auto p-1 text-[#999] hover:text-[#EF4444] transition-colors"
          title="삭제"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Fields by type */}
      {change.type === 'create' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[#333] block mb-1">부서명 *</label>
            <input
              value={change.newDeptName ?? ''}
              onChange={(e) => update({ newDeptName: e.target.value })}
              placeholder={'신설 부서명'}
              className="w-full px-3 py-1.5 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10 placeholder:text-[#999]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#333] block mb-1">코드 *</label>
            <input
              value={change.newDeptCode ?? ''}
              onChange={(e) => update({ newDeptCode: e.target.value })}
              placeholder="예: DEPT-NEW"
              className="w-full px-3 py-1.5 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10 placeholder:text-[#999]"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-[#333] block mb-1">상위 부서</label>
            <select
              value={change.newDeptParentId ?? ''}
              onChange={(e) => update({ newDeptParentId: e.target.value || null })}
              className="w-full px-3 py-1.5 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10"
            >
              <option value="">— 최상위 부서 —</option>
              {deptOptions}
            </select>
          </div>
        </div>
      )}

      {change.type === 'move' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[#333] block mb-1">이동 대상 부서 *</label>
            <select
              value={change.deptId ?? ''}
              onChange={(e) => update({ deptId: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10"
            >
              <option value="">— 선택 —</option>
              {deptOptions}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <ArrowRight size={16} className="mb-2 text-[#999] shrink-0" />
            <div className="flex-1">
              <label className="text-xs font-medium text-[#333] block mb-1">이동 후 상위 부서 *</label>
              <select
                value={change.targetParentId ?? ''}
                onChange={(e) => update({ targetParentId: e.target.value || null })}
                className="w-full px-3 py-1.5 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10"
              >
                <option value="">— 최상위 —</option>
                {deptOptions}
              </select>
            </div>
          </div>
        </div>
      )}

      {change.type === 'merge' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[#333] block mb-1">통합 대상 (폐지) *</label>
            <select
              value={change.sourceDeptId ?? ''}
              onChange={(e) => update({ sourceDeptId: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10"
            >
              <option value="">— 선택 —</option>
              {deptOptions}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <ArrowRight size={16} className="mb-2 text-[#999] shrink-0" />
            <div className="flex-1">
              <label className="text-xs font-medium text-[#333] block mb-1">흡수 부서 *</label>
              <select
                value={change.targetDeptId ?? ''}
                onChange={(e) => update({ targetDeptId: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10"
              >
                <option value="">— 선택 —</option>
                {deptOptions}
              </select>
            </div>
          </div>
        </div>
      )}

      {change.type === 'rename' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[#333] block mb-1">변경 부서 *</label>
            <select
              value={change.renameDeptId ?? ''}
              onChange={(e) => update({ renameDeptId: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10"
            >
              <option value="">— 선택 —</option>
              {deptOptions}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[#333] block mb-1">새 부서명 *</label>
            <input
              value={change.newName ?? ''}
              onChange={(e) => update({ newName: e.target.value })}
              placeholder={'변경될 이름'}
              className="w-full px-3 py-1.5 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10 placeholder:text-[#999]"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-[#333] block mb-1">영문명 (선택)</label>
            <input
              value={change.newNameEn ?? ''}
              onChange={(e) => update({ newNameEn: e.target.value })}
              placeholder="English name"
              className="w-full px-3 py-1.5 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10 placeholder:text-[#999]"
            />
          </div>
        </div>
      )}

      {change.type === 'close' && (
        <div>
          <label className="text-xs font-medium text-[#333] block mb-1">폐지 부서 *</label>
          <select
            value={change.closeDeptId ?? ''}
            onChange={(e) => update({ closeDeptId: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10"
          >
            <option value="">— 선택 —</option>
            {deptOptions}
          </select>
          {change.closeDeptId && (
            <p className="mt-1.5 text-xs text-[#EF4444] flex items-center gap-1">
              <span>⚠</span> 폐지 시 소속 인원은 상위 부서로 자동 이동됩니다.
            </p>
          )}
        </div>
      )}

      {change.type === 'transfer_employee' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-[#333] block mb-1">이동 직원 *</label>
            <select
              value={change.employeeId ?? ''}
              onChange={(e) => update({ employeeId: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10"
            >
              <option value="">— 직원 선택 —</option>
              {employees.map((emp) => {
                const dept = depts.find((d) => d.id === emp.departmentId)
                return (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeNo}){dept ? ` — ${dept.name}` : ''}
                  </option>
                )
              })}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[#333] block mb-1">현재 부서</label>
            <select
              value={change.fromDeptId ?? ''}
              onChange={(e) => update({ fromDeptId: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10"
            >
              <option value="">— 선택 —</option>
              {deptOptions}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <ArrowRight size={16} className="mb-2 text-[#999] shrink-0" />
            <div className="flex-1">
              <label className="text-xs font-medium text-[#333] block mb-1">이동 부서 *</label>
              <select
                value={change.toDeptId ?? ''}
                onChange={(e) => update({ toDeptId: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10"
              >
                <option value="">— 선택 —</option>
                {deptOptions}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step Indicator ─────────────────────────────────────────

type Step = 'edit' | 'diff' | 'confirm'

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'edit', label: '① 변경 사항 작성' },
    { key: 'diff', label: '② 영향도 검토' },
    { key: 'confirm', label: '③ 확인 및 저장' },
  ]
  return (
    <div className="flex items-center gap-1 px-6 py-3 border-b border-[#E8E8E8] bg-[#FAFAFA]">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={14} className="text-[#999]" />}
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded ${
              s.key === step
                ? 'bg-[#5E81F4] text-white'
                : steps.findIndex((x) => x.key === step) > i
                ? 'text-[#5E81F4]'
                : 'text-[#999]'
            }`}
          >
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── RestructureModal ───────────────────────────────────────

export function RestructureModal({ companyId, onClose, onApplied }: RestructureModalProps) {
  const [step, setStep] = useState<Step>('edit')
  const [depts, setDepts] = useState<DeptOption[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [plan, setPlan] = useState<RestructurePlanDraft>({
    title: '',
    description: '',
    effectiveDate: new Date(),
    changes: [],
  })

  // Load reference data
  useEffect(() => {
    const params = `?companyId=${companyId}&limit=200`
    apiClient
      .getList<DeptOption>(`/api/v1/org/departments${params}`)
      .then((r) => setDepts(r.data))
      .catch(() => {})

    apiClient
      .getList<EmployeeOption>(`/api/v1/employees?companyId=${companyId}&limit=500&status=ACTIVE`)
      .then((r) => setEmployees(r.data))
      .catch(() => {})
  }, [companyId])

  const addChange = (type: ChangeType) => {
    setPlan((prev) => ({
      ...prev,
      changes: [...prev.changes, { id: generateId(), type }],
    }))
  }

  const updateChange = useCallback((id: string, updated: OrgChange) => {
    setPlan((prev) => ({
      ...prev,
      changes: prev.changes.map((c) => (c.id === id ? updated : c)),
    }))
  }, [])

  const removeChange = useCallback((id: string) => {
    setPlan((prev) => ({
      ...prev,
      changes: prev.changes.filter((c) => c.id !== id),
    }))
  }, [])

  const canProceedToDiff = plan.title.trim() && plan.changes.length > 0

  const handleSaveDraft = async () => {
    setSaving(true)
    setError('')
    try {
      await apiClient.post('/api/v1/org/restructure-plans', {
        companyId,
        title: plan.title,
        description: plan.description,
        effectiveDate: plan.effectiveDate.toISOString().split('T')[0],
        changes: plan.changes,
        status: 'draft',
      })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleApplyNow = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await apiClient.post<{ id: string }>('/api/v1/org/restructure-plans', {
        companyId,
        title: plan.title,
        description: plan.description,
        effectiveDate: plan.effectiveDate.toISOString().split('T')[0],
        changes: plan.changes,
        status: 'approved',
      })
      // Apply immediately
      await apiClient.post(`/api/v1/org/restructure-plans/${res.data.id}/apply`, {})
      onApplied()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '적용 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={MODAL_STYLES.container}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E8] shrink-0">
          <div className="flex items-center gap-2">
            <GitBranch size={18} className="text-[#5E81F4]" />
            <h2 className="text-base font-bold text-[#1A1A1A]">조직 개편 계획</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#999] hover:text-[#333] rounded-lg hover:bg-[#F5F5F5] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Indicator */}
        <StepIndicator step={step} />

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {step === 'edit' && (
            <div className="p-6 space-y-5">
              {/* Plan metadata */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-[#333] block mb-1">계획명 *</label>
                  <input
                    value={plan.title}
                    onChange={(e) => setPlan((p) => ({ ...p, title: e.target.value }))}
                    placeholder="예: 2026년 상반기 조직 개편"
                    className="w-full px-3 py-2 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10 placeholder:text-[#999]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-[#333] block mb-1">발효일 *</label>
                    <EffectiveDatePicker
                      value={plan.effectiveDate}
                      onChange={(date) => setPlan((p) => ({ ...p, effectiveDate: date }))}
                      allowFuture={true}
                      label=""
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#333] block mb-1">설명 (선택)</label>
                    <input
                      value={plan.description}
                      onChange={(e) => setPlan((p) => ({ ...p, description: e.target.value }))}
                      placeholder={'개편 배경 및 목적'}
                      className="w-full px-3 py-2 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10 placeholder:text-[#999]"
                    />
                  </div>
                </div>
              </div>

              {/* Changes list */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">
                    변경 사항 ({plan.changes.length}건)
                  </h3>
                </div>

                <div className="space-y-3">
                  {plan.changes.map((change, idx) => (
                    <ChangeEditor
                      key={change.id}
                      change={change}
                      depts={depts}
                      employees={employees}
                      onChange={(updated) => updateChange(change.id, updated)}
                      onRemove={() => removeChange(change.id)}
                      idx={idx}
                    />
                  ))}
                </div>

                {/* Add change buttons */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(Object.keys(CHANGE_TYPE_LABELS) as ChangeType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => addChange(type)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80 ${CHANGE_TYPE_COLORS[type]} border-current/20`}
                    >
                      <Plus size={11} />
                      {CHANGE_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>

                {plan.changes.length === 0 && (
                  <p className="text-center text-sm text-[#999] py-8">
                    위 버튼을 클릭하여 변경 사항을 추가하세요.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 'diff' && (
            <RestructureDiffView
              plan={plan}
              depts={depts}
              employees={employees}
            />
          )}

          {step === 'confirm' && (
            <div className="p-6 space-y-4">
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-[#15803D]">계획 요약</p>
                <p className="text-sm text-[#1A1A1A]">{plan.title}</p>
                <p className="text-xs text-[#555]">
                  발효일: {plan.effectiveDate.toLocaleDateString('ko-KR')} &nbsp;·&nbsp; 변경 {plan.changes.length}건
                </p>
              </div>

              <div className="bg-[#FEF3C7] border border-[#FCD34D] rounded-xl p-4">
                <p className="text-xs font-medium text-[#92400E] mb-1">⚠ 즉시 적용 시 주의사항</p>
                <ul className="text-xs text-[#B45309] space-y-1 list-disc list-inside">
                  <li>부서 이동/통합/폐지 시 소속 인원의 Assignment가 자동 업데이트됩니다.</li>
                  <li>이 작업은 되돌리기 어려울 수 있습니다.</li>
                  <li>발효일 이후로 변경 사항이 반영됩니다.</li>
                </ul>
              </div>

              {error && (
                <p className="text-sm text-[#EF4444] bg-[#FEE2E2] border border-[#FECACA] rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E8E8E8] bg-[#FAFAFA] shrink-0">
          <button
            onClick={step === 'edit' ? onClose : () => setStep(step === 'diff' ? 'edit' : 'diff')}
            className="px-4 py-2 text-sm border border-[#D4D4D4] rounded-lg bg-white hover:bg-[#F5F5F5] text-[#333] transition-colors"
          >
            {step === 'edit' ? '취소' : '이전'}
          </button>

          <div className="flex items-center gap-2">
            {step === 'confirm' && (
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="px-4 py-2 text-sm border border-[#D4D4D4] rounded-lg bg-white hover:bg-[#F5F5F5] text-[#333] transition-colors disabled:opacity-50"
              >
                초안 저장
              </button>
            )}

            <button
              onClick={() => {
                if (step === 'edit') {
                  if (canProceedToDiff) setStep('diff')
                } else if (step === 'diff') {
                  setStep('confirm')
                } else {
                  handleApplyNow()
                }
              }}
              disabled={!canProceedToDiff || saving}
              className={`px-4 py-2 text-sm ${BUTTON_VARIANTS.primary} rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {saving
                ? '처리 중...'
                : step === 'edit'
                ? '다음: 영향도 검토'
                : step === 'diff'
                ? '다음: 확인'
                : '즉시 적용'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
