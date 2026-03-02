'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, Pencil, CheckCircle2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { CompanySelector } from './CompanySelector'
import { ApprovalFlowEditor } from './ApprovalFlowEditor'
import type { ApprovalFlowData, ApprovalModule } from '@/types/settings'

const MODULES: { value: ApprovalModule | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'benefits', label: '복리후생' },
  { value: 'recruitment', label: '채용' },
  { value: 'leave', label: '휴가' },
  { value: 'promotion', label: '승진' },
  { value: 'general', label: '일반' },
]

const MODULE_LABELS: Record<ApprovalModule, string> = {
  benefits: '복리후생',
  recruitment: '채용',
  leave: '휴가',
  promotion: '승진',
  general: '일반',
}

function emptyFlow(companyId: string | null): Omit<ApprovalFlowData, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: '',
    description: null,
    companyId,
    module: 'general',
    isActive: true,
    steps: [],
  }
}

export function ApprovalFlowManagerClient() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [moduleFilter, setModuleFilter] = useState<ApprovalModule | 'all'>('all')
  const [flows, setFlows] = useState<ApprovalFlowData[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingFlow, setEditingFlow] = useState<ApprovalFlowData | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newFlow, setNewFlow] = useState<Partial<ApprovalFlowData> | null>(null)
  const [saving, setSaving] = useState(false)

  // Fetch initial company
  useEffect(() => {
    apiClient.get<{ id: string }[]>('/api/v1/org/companies').then((res) => {
      if (res.data?.[0]) setCompanyId(res.data[0].id)
    })
  }, [])

  // Fetch flows when company or module filter changes
  useEffect(() => {
    fetchFlows()
  }, [companyId, moduleFilter])

  async function fetchFlows() {
    setLoading(true)
    const params = new URLSearchParams()
    if (moduleFilter !== 'all') params.set('module', moduleFilter)
    if (companyId) params.set('companyId', companyId)
    const res = await apiClient.get<ApprovalFlowData[]>(`/api/v1/settings/approval-flows?${params}`)
    if (res.data) setFlows(res.data)
    setLoading(false)
  }

  const handleCreateStart = () => {
    setNewFlow({
      ...emptyFlow(companyId),
      id: `new-${Date.now()}`,
      steps: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ApprovalFlowData)
    setIsCreating(true)
    setExpandedId(null)
    setEditingFlow(null)
  }

  const handleSaveNew = async () => {
    if (!newFlow?.name) return
    setSaving(true)
    await apiClient.post('/api/v1/settings/approval-flows', {
      name: newFlow.name,
      description: newFlow.description,
      companyId: newFlow.companyId ?? null,
      module: newFlow.module,
      isActive: true,
      steps: (newFlow as ApprovalFlowData).steps ?? [],
    })
    setIsCreating(false)
    setNewFlow(null)
    setSaving(false)
    fetchFlows()
  }

  const handleSaveEdit = async (flow: ApprovalFlowData) => {
    setSaving(true)
    await apiClient.put('/api/v1/settings/approval-flows', {
      id: flow.id,
      name: flow.name,
      description: flow.description,
      isActive: flow.isActive,
      steps: flow.steps,
    })
    setSaving(false)
    setExpandedId(null)
    setEditingFlow(null)
    fetchFlows()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 승인 플로우를 삭제하시겠습니까?')) return
    await apiClient.delete(`/api/v1/settings/approval-flows?id=${id}`)
    fetchFlows()
  }

  const handleToggleActive = async (flow: ApprovalFlowData) => {
    await apiClient.put('/api/v1/settings/approval-flows', {
      id: flow.id,
      name: flow.name,
      description: flow.description,
      isActive: !flow.isActive,
      steps: flow.steps,
    })
    fetchFlows()
  }

  const handleExpandEdit = (flow: ApprovalFlowData) => {
    setExpandedId(flow.id)
    setEditingFlow({ ...flow, steps: [...flow.steps] })
    setIsCreating(false)
    setNewFlow(null)
  }

  return (
    <div className="space-y-6">
      {/* Header: company selector + create button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-[#E8E8E8] bg-[#FAFAFA] px-4 py-2.5">
            <span className="text-sm font-medium text-[#555]">법인:</span>
            {companyId && (
              <CompanySelector
                selectedCompanyId={companyId}
                onCompanyChange={(id) => setCompanyId(id)}
              />
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCreateStart}
          className="flex items-center gap-2 rounded-lg bg-[#00C853] px-4 py-2 text-sm font-medium text-white hover:bg-[#00A844]"
        >
          <Plus className="h-4 w-4" />
          새 플로우
        </button>
      </div>

      {/* Module filter tabs */}
      <div className="flex gap-1 border-b border-[#E8E8E8]">
        {MODULES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setModuleFilter(m.value)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              moduleFilter === m.value
                ? 'border-b-2 border-[#00C853] text-[#00C853]'
                : 'text-[#666] hover:text-[#333]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* New flow form */}
      {isCreating && newFlow && (
        <div className="rounded-xl border-2 border-[#00C853] bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-[#1A1A1A]">새 승인 플로우</h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-[#555]">플로우명 *</label>
                <input
                  value={newFlow.name ?? ''}
                  onChange={(e) => setNewFlow({ ...newFlow, name: e.target.value })}
                  className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20"
                  placeholder="예: 휴가 승인 (한국)"
                  autoFocus
                />
              </div>
              <div className="w-40">
                <label className="mb-1 block text-xs font-medium text-[#555]">모듈</label>
                <select
                  value={newFlow.module}
                  onChange={(e) => setNewFlow({ ...newFlow, module: e.target.value as ApprovalModule })}
                  className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20"
                >
                  {MODULES.filter((m) => m.value !== 'all').map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#555]">설명</label>
              <input
                value={newFlow.description ?? ''}
                onChange={(e) => setNewFlow({ ...newFlow, description: e.target.value || null })}
                className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20"
                placeholder="플로우 용도 설명 (선택)"
              />
            </div>
            {/* Step editor */}
            <div>
              <label className="mb-2 block text-xs font-medium text-[#555]">결재 단계</label>
              <ApprovalFlowEditor
                flow={newFlow as ApprovalFlowData}
                onChange={(f) => setNewFlow(f)}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setIsCreating(false); setNewFlow(null) }}
              className="rounded-lg border border-[#E8E8E8] px-4 py-2 text-sm text-[#666] hover:bg-[#FAFAFA]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSaveNew}
              disabled={saving || !newFlow.name}
              className="rounded-lg bg-[#00C853] px-4 py-2 text-sm font-medium text-white hover:bg-[#00A844] disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* Flow list */}
      {loading ? (
        <div className="py-8 text-center text-sm text-[#999]">로딩 중...</div>
      ) : flows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E8E8E8] py-12 text-center">
          <p className="text-sm text-[#999]">승인 플로우가 없습니다.</p>
          <p className="mt-1 text-xs text-[#BBB]">위 버튼을 눌러 새 플로우를 만드세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {flows.map((flow) => {
            const isExpanded = expandedId === flow.id
            const editing = isExpanded ? editingFlow : null

            return (
              <div
                key={flow.id}
                className={`rounded-xl border bg-white transition-shadow ${
                  isExpanded ? 'border-[#00C853] shadow-sm' : 'border-[#E8E8E8] hover:border-[#CCC]'
                }`}
              >
                {/* Flow header row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Active toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(flow)}
                    title={flow.isActive ? '비활성화' : '활성화'}
                    className={`flex-shrink-0 ${flow.isActive ? 'text-[#059669]' : 'text-[#CCC]'}`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>

                  {/* Flow info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#1A1A1A] truncate">{flow.name}</span>
                      <span className="flex-shrink-0 rounded-full border border-[#E0E7FF] bg-[#E0E7FF]/60 px-2 py-0.5 text-xs text-[#4338CA]">
                        {MODULE_LABELS[flow.module]}
                      </span>
                      {!flow.companyId && (
                        <span className="flex-shrink-0 rounded-full border border-[#E8E8E8] bg-[#FAFAFA] px-2 py-0.5 text-xs text-[#888]">
                          글로벌
                        </span>
                      )}
                      {!flow.isActive && (
                        <span className="flex-shrink-0 rounded-full border border-[#E8E8E8] px-2 py-0.5 text-xs text-[#999]">
                          비활성
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#999] mt-0.5">
                      {flow.steps.length}단계 결재
                      {flow.description && ` · ${flow.description}`}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => isExpanded ? (setExpandedId(null), setEditingFlow(null)) : handleExpandEdit(flow)}
                      className="rounded-lg p-1.5 text-[#666] hover:bg-[#FAFAFA]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(flow.id)}
                      className="rounded-lg p-1.5 text-[#999] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => isExpanded ? (setExpandedId(null), setEditingFlow(null)) : handleExpandEdit(flow)}
                      className="rounded-lg p-1.5 text-[#999] hover:bg-[#FAFAFA]"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded editor */}
                {isExpanded && editing && (
                  <div className="border-t border-[#F5F5F5] px-4 pb-4 pt-3 space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-[#555]">플로우명</label>
                        <input
                          value={editing.name}
                          onChange={(e) => setEditingFlow({ ...editing, name: e.target.value })}
                          className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[#555]">설명</label>
                        <input
                          value={editing.description ?? ''}
                          onChange={(e) =>
                            setEditingFlow({ ...editing, description: e.target.value || null })
                          }
                          className="w-64 rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853]/20"
                          placeholder="선택"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium text-[#555]">결재 단계</label>
                      <ApprovalFlowEditor
                        flow={editing}
                        onChange={(f) => setEditingFlow(f)}
                      />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => { setExpandedId(null); setEditingFlow(null) }}
                        className="rounded-lg border border-[#E8E8E8] px-4 py-2 text-sm text-[#666] hover:bg-[#FAFAFA]"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(editing)}
                        disabled={saving}
                        className="rounded-lg bg-[#00C853] px-4 py-2 text-sm font-medium text-white hover:bg-[#00A844] disabled:opacity-50"
                      >
                        {saving ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
