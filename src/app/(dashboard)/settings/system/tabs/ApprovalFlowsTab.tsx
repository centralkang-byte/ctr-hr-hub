'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, GitBranch, ChevronDown, ChevronUp, Check, X, Loader2 } from 'lucide-react'
import { ApprovalFlowEditor } from '@/components/settings/ApprovalFlowEditor'
import { toast } from '@/hooks/use-toast'
import type { ApprovalFlowData, ApprovalModule, ApproverRole } from '@/types/settings'

interface Props { companyId: string | null }

const MODULE_OPTIONS: { value: ApprovalModule | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'leave', label: '휴가' },
  { value: 'payroll', label: '급여' },
  { value: 'recruitment', label: '채용' },
  { value: 'attendance', label: '근태' },
  { value: 'discipline', label: '징계' },
  { value: 'certificate', label: '증명서' },
  { value: 'promotion', label: '승진' },
  { value: 'benefits', label: '복리후생' },
  { value: 'offboarding', label: '퇴직/사직' },
  { value: 'personnel_order', label: '인사발령' },
  { value: 'probation', label: '수습 전환' },
  { value: 'contract_conversion', label: '계약 전환' },
  { value: 'general', label: '일반' },
]

const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  MODULE_OPTIONS.filter(o => o.value !== 'all').map(o => [o.value, o.label])
)

function emptyFlow(module: ApprovalModule, companyId: string | null): ApprovalFlowData {
  return {
    id: `new-${Date.now()}`,
    name: '',
    description: null,
    companyId,
    module,
    deletedAt: null,
    steps: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export function ApprovalFlowsTab({ companyId }: Props) {
  const [flows, setFlows] = useState<ApprovalFlowData[]>([])
  const [loading, setLoading] = useState(true)
  const [moduleFilter, setModuleFilter] = useState<ApprovalModule | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingFlow, setEditingFlow] = useState<ApprovalFlowData | null>(null)
  const [saving, setSaving] = useState(false)
  const [creatingModule, setCreatingModule] = useState<ApprovalModule | null>(null)

  const fetchFlows = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (companyId) params.set('companyId', companyId)
      const res = await fetch(`/api/v1/settings/approval-flows?${params}`)
      if (!res.ok) throw new Error('로드 실패')
      const json = await res.json()
      setFlows(json.data ?? [])
    } catch {
      toast({ title: '로드 실패', description: '결재 플로우를 불러올 수 없습니다.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchFlows() }, [fetchFlows])

  const filteredFlows = moduleFilter === 'all'
    ? flows
    : flows.filter(f => f.module === moduleFilter)

  const handleSave = async (flow: ApprovalFlowData) => {
    setSaving(true)
    try {
      const isNew = flow.id.startsWith('new-')
      const url = '/api/v1/settings/approval-flows'
      const method = isNew ? 'POST' : 'PUT'
      const body = isNew
        ? { name: flow.name, description: flow.description, companyId: flow.companyId, module: flow.module, steps: flow.steps.map(s => ({ approverType: s.approverType, approverRole: s.approverRole, approverUserId: s.approverUserId, isRequired: s.isRequired, autoApproveDays: s.autoApproveDays })) }
        : { id: flow.id, name: flow.name, description: flow.description, module: flow.module, deletedAt: flow.deletedAt, steps: flow.steps.map(s => ({ approverType: s.approverType, approverRole: s.approverRole, approverUserId: s.approverUserId, isRequired: s.isRequired, autoApproveDays: s.autoApproveDays })) }

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? '저장 실패')
      }
      toast({ title: '저장되었습니다' })
      setEditingFlow(null)
      setCreatingModule(null)
      setExpandedId(null)
      await fetchFlows()
    } catch (err) {
      toast({ title: '저장 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 결재 플로우를 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/v1/settings/approval-flows?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast({ title: '삭제되었습니다' })
      await fetchFlows()
    } catch {
      toast({ title: '삭제 실패', variant: 'destructive' })
    }
  }

  const roleLabel = (role: ApproverRole | null) => {
    const map: Record<string, string> = { direct_manager: '직속 팀장', dept_head: '부서장', hr_admin: 'HR 담당', finance: '경영관리', ceo: '대표이사' }
    return role ? map[role] ?? role : '—'
  }

  // 모듈별 그룹
  const grouped = filteredFlows.reduce<Record<string, ApprovalFlowData[]>>((acc, f) => {
    const key = f.module
    if (!acc[key]) acc[key] = []
    acc[key].push(f)
    return acc
  }, {})

  // 미설정 모듈 목록
  const configuredModules = new Set(flows.map(f => f.module))
  const unconfiguredModules = MODULE_OPTIONS
    .filter(o => o.value !== 'all' && !configuredModules.has(o.value as ApprovalModule))
    .map(o => o.value as ApprovalModule)

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1C1D21]">결재 플로우</h3>
          <p className="text-sm text-[#8181A5]">
            모듈별 전결 규정 설정 ({flows.length}개 플로우)
            {companyId ? '' : ' · 글로벌'}
          </p>
        </div>
      </div>

      {/* 모듈 필터 */}
      <div className="flex flex-wrap gap-1.5">
        {MODULE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setModuleFilter(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              moduleFilter === opt.value
                ? 'bg-[#5E81F4] text-white'
                : 'bg-[#F5F5FA] text-[#8181A5] hover:bg-[#E8E8EE]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[#8181A5]" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* 설정된 플로우 */}
          {Object.entries(grouped).map(([mod, modFlows]) => (
            <div key={mod} className="space-y-2">
              {modFlows.map(flow => {
                const isExpanded = expandedId === flow.id
                const isEditing = editingFlow?.id === flow.id

                return (
                  <div
                    key={flow.id}
                    className="rounded-xl border border-[#F0F0F3] bg-white transition-shadow hover:shadow-sm"
                  >
                    {/* 카드 헤더 */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditing) return
                        setExpandedId(isExpanded ? null : flow.id)
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5E81F4]/10">
                        <GitBranch className="h-4 w-4 text-[#5E81F4]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#1C1D21]">
                            {MODULE_LABELS[flow.module] ?? flow.module}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            !flow.deletedAt
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-gray-100 text-gray-400'
                          }`}>
                            {!flow.deletedAt ? '활성' : '비활성'}
                          </span>
                          {!flow.companyId && (
                            <span className="rounded-full bg-[#F5F5FA] px-2 py-0.5 text-[10px] text-[#8181A5]">글로벌</span>
                          )}
                        </div>
                        <p className="truncate text-xs text-[#8181A5]">
                          {flow.name} · {flow.steps.length}단계
                          {flow.steps.length > 0 && ` (${flow.steps.map(s => roleLabel(s.approverRole as ApproverRole | null)).join(' → ')})`}
                        </p>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-[#999]" /> : <ChevronDown className="h-4 w-4 text-[#999]" />}
                    </button>

                    {/* 확장 영역 */}
                    {isExpanded && (
                      <div className="border-t border-[#F0F0F3] px-4 py-3 space-y-3">
                        {isEditing ? (
                          <>
                            <div className="space-y-2">
                              <input
                                value={editingFlow.name}
                                onChange={e => setEditingFlow({ ...editingFlow, name: e.target.value })}
                                placeholder="플로우 이름"
                                className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/20"
                              />
                            </div>
                            <ApprovalFlowEditor
                              flow={editingFlow}
                              onChange={setEditingFlow}
                            />
                            <div className="flex items-center gap-2 pt-2">
                              <button
                                onClick={() => handleSave(editingFlow)}
                                disabled={saving || !editingFlow.name || editingFlow.steps.length === 0}
                                className="flex items-center gap-1.5 rounded-lg bg-[#5E81F4] px-4 py-2 text-xs font-medium text-white hover:bg-[#4A6DE0] disabled:opacity-50"
                              >
                                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                저장
                              </button>
                              <button
                                onClick={() => { setEditingFlow(null); setExpandedId(null) }}
                                className="flex items-center gap-1.5 rounded-lg border border-[#D4D4D4] px-4 py-2 text-xs font-medium text-[#666] hover:bg-[#F5F5FA]"
                              >
                                <X className="h-3 w-3" />
                                취소
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <ApprovalFlowEditor flow={flow} onChange={() => {}} disabled />
                            <div className="flex items-center gap-2 pt-2">
                              <button
                                onClick={() => setEditingFlow({ ...flow })}
                                className="rounded-lg bg-[#5E81F4] px-4 py-2 text-xs font-medium text-white hover:bg-[#4A6DE0]"
                              >
                                편집
                              </button>
                              <button
                                onClick={() => handleDelete(flow.id)}
                                className="rounded-lg border border-[#D4D4D4] px-4 py-2 text-xs font-medium text-[#DC2626] hover:bg-[#FEE2E2]"
                              >
                                삭제
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {/* 미설정 모듈 */}
          {moduleFilter === 'all' && unconfiguredModules.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#8181A5] pt-2">미설정 모듈</p>
              {unconfiguredModules.map(mod => {
                const isCreating = creatingModule === mod

                return (
                  <div key={mod} className="rounded-xl border border-dashed border-[#D4D4D4] bg-[#FAFAFA]">
                    {isCreating && editingFlow ? (
                      <div className="px-4 py-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-[#999]" />
                          <span className="text-sm font-semibold text-[#1C1D21]">{MODULE_LABELS[mod]}</span>
                        </div>
                        <input
                          value={editingFlow.name}
                          onChange={e => setEditingFlow({ ...editingFlow, name: e.target.value })}
                          placeholder="플로우 이름 (예: 휴가 승인)"
                          className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/20"
                        />
                        <ApprovalFlowEditor flow={editingFlow} onChange={setEditingFlow} />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSave(editingFlow)}
                            disabled={saving || !editingFlow.name || editingFlow.steps.length === 0}
                            className="flex items-center gap-1.5 rounded-lg bg-[#5E81F4] px-4 py-2 text-xs font-medium text-white hover:bg-[#4A6DE0] disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            생성
                          </button>
                          <button
                            onClick={() => { setCreatingModule(null); setEditingFlow(null) }}
                            className="flex items-center gap-1.5 rounded-lg border border-[#D4D4D4] px-4 py-2 text-xs font-medium text-[#666] hover:bg-[#F5F5FA]"
                          >
                            <X className="h-3 w-3" />
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const newFlow = emptyFlow(mod, companyId)
                          newFlow.name = `${MODULE_LABELS[mod]} 승인`
                          setCreatingModule(mod)
                          setEditingFlow(newFlow)
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                          <Plus className="h-4 w-4 text-[#999]" />
                        </div>
                        <div className="text-left">
                          <span className="text-sm font-medium text-[#666]">{MODULE_LABELS[mod]}</span>
                          <p className="text-xs text-[#999]">플로우 미설정 — 클릭하여 생성</p>
                        </div>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* 빈 상태 */}
          {filteredFlows.length === 0 && !loading && moduleFilter !== 'all' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <GitBranch className="mb-3 h-8 w-8 text-[#D4D4D4]" />
              <p className="text-sm text-[#8181A5]">{MODULE_LABELS[moduleFilter]} 모듈에 설정된 플로우가 없습니다.</p>
              <button
                onClick={() => {
                  const newFlow = emptyFlow(moduleFilter as ApprovalModule, companyId)
                  newFlow.name = `${MODULE_LABELS[moduleFilter]} 승인`
                  setCreatingModule(moduleFilter as ApprovalModule)
                  setEditingFlow(newFlow)
                  setModuleFilter('all')
                }}
                className="mt-2 text-xs font-medium text-[#5E81F4] hover:underline"
              >
                플로우 생성
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
