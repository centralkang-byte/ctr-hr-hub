'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, GitBranch, ChevronDown, ChevronUp, Check, X, Loader2 } from 'lucide-react'
import { ApprovalFlowEditor } from '@/components/settings/ApprovalFlowEditor'
import { toast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import type { ApprovalFlowData, ApprovalModule, ApproverRole } from '@/types/settings'

interface Props { companyId: string | null }

const MODULE_OPTIONS: { value: ApprovalModule | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'common.all' },
  { value: 'leave', labelKey: 'approvalFlows.modules.leave' },
  { value: 'payroll', labelKey: 'approvalFlows.modules.payroll' },
  { value: 'recruitment', labelKey: 'approvalFlows.modules.recruitment' },
  { value: 'attendance', labelKey: 'approvalFlows.modules.attendance' },
  { value: 'discipline', labelKey: 'approvalFlows.modules.discipline' },
  { value: 'certificate', labelKey: 'approvalFlows.modules.certificate' },
  { value: 'promotion', labelKey: 'approvalFlows.modules.promotion' },
  { value: 'benefits', labelKey: 'approvalFlows.modules.benefits' },
  { value: 'offboarding', labelKey: 'approvalFlows.modules.offboarding' },
  { value: 'personnel_order', labelKey: 'approvalFlows.modules.personnel_order' },
  { value: 'probation', labelKey: 'approvalFlows.modules.probation' },
  { value: 'contract_conversion', labelKey: 'approvalFlows.modules.contract_conversion' },
  { value: 'general', labelKey: 'approvalFlows.modules.general' },
]

const MODULE_LABEL_KEYS: Record<string, string> = Object.fromEntries(
  MODULE_OPTIONS.filter(o => o.value !== 'all').map(o => [o.value, o.labelKey])
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
  const t = useTranslations('settings')
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
      const params: Record<string, string | undefined> = {}
      if (companyId) params.companyId = companyId
      const { data } = await apiClient.get<ApprovalFlowData[]>('/api/v1/settings/approval-flows', params)
      setFlows(data ?? [])
    } catch {
      toast({ title: t('common.loadFailed'), description: t('approvalFlows.loadFailedDesc'), variant: 'destructive' })
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

      if (isNew) {
        await apiClient.post(url, body)
      } else {
        await apiClient.put(url, body)
      }
      toast({ title: t('common.saveSuccess') })
      setEditingFlow(null)
      setCreatingModule(null)
      setExpandedId(null)
      await fetchFlows()
    } catch (err) {
      toast({ title: t('common.saveFailed'), description: err instanceof Error ? err.message : t('common.retryMessage'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('approvalFlows.deleteConfirm'))) return
    try {
      await apiClient.delete(`/api/v1/settings/approval-flows?id=${id}`)
      toast({ title: t('common.deleteSuccess') })
      await fetchFlows()
    } catch {
      toast({ title: t('common.deleteFailed'), variant: 'destructive' })
    }
  }

  const roleLabel = (role: ApproverRole | null) => {
    if (!role) return '—'
    return t(`approvalFlows.roles.${role}` as Parameters<typeof t>[0])
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
          <h3 className="text-base font-semibold text-foreground">{t('approvalFlows.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('approvalFlows.description', { count: flows.length })}
            {companyId ? '' : ` · ${t('common.global')}`}
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
                ? 'bg-primary text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted'
            }`}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
                    className="rounded-xl border border-border bg-card transition-shadow hover:shadow-sm"
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
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <GitBranch className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {t(MODULE_LABEL_KEYS[flow.module] ?? flow.module)}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            !flow.deletedAt
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-muted text-muted-foreground/60'
                          }`}>
                            {!flow.deletedAt ? t('common.active') : t('common.inactive')}
                          </span>
                          {!flow.companyId && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{t('common.global')}</span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {flow.name} · {t('approvalFlows.stepsCount', { count: flow.steps.length })}
                          {flow.steps.length > 0 && ` (${flow.steps.map(s => roleLabel(s.approverRole as ApproverRole | null)).join(' → ')})`}
                        </p>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>

                    {/* 확장 영역 */}
                    {isExpanded && (
                      <div className="border-t border-border px-4 py-3 space-y-3">
                        {isEditing ? (
                          <>
                            <div className="space-y-2">
                              <input
                                value={editingFlow.name}
                                onChange={e => setEditingFlow({ ...editingFlow, name: e.target.value })}
                                placeholder={t('approvalFlows.flowNamePlaceholder')}
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                              >
                                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                {t('common.save')}
                              </button>
                              <button
                                onClick={() => { setEditingFlow(null); setExpandedId(null) }}
                                className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
                              >
                                <X className="h-3 w-3" />
                                {t('common.cancel')}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <ApprovalFlowEditor flow={flow} onChange={() => {}} disabled />
                            <div className="flex items-center gap-2 pt-2">
                              <button
                                onClick={() => setEditingFlow({ ...flow })}
                                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary/90"
                              >
                                {t('common.edit')}
                              </button>
                              <button
                                onClick={() => handleDelete(flow.id)}
                                className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
                              >
                                {t('common.delete')}
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
              <p className="text-xs font-medium text-muted-foreground pt-2">{t('approvalFlows.unconfiguredModules')}</p>
              {unconfiguredModules.map(mod => {
                const isCreating = creatingModule === mod

                return (
                  <div key={mod} className="rounded-xl border border-dashed border-border bg-background">
                    {isCreating && editingFlow ? (
                      <div className="px-4 py-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-semibold text-foreground">{t(MODULE_LABEL_KEYS[mod] ?? mod)}</span>
                        </div>
                        <input
                          value={editingFlow.name}
                          onChange={e => setEditingFlow({ ...editingFlow, name: e.target.value })}
                          placeholder={t('approvalFlows.flowNameExPlaceholder')}
                          className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <ApprovalFlowEditor flow={editingFlow} onChange={setEditingFlow} />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSave(editingFlow)}
                            disabled={saving || !editingFlow.name || editingFlow.steps.length === 0}
                            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            {t('common.create')}
                          </button>
                          <button
                            onClick={() => { setCreatingModule(null); setEditingFlow(null) }}
                            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
                          >
                            <X className="h-3 w-3" />
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const newFlow = emptyFlow(mod, companyId)
                          newFlow.name = `${MODULE_LABEL_KEYS[mod]} approval`
                          setCreatingModule(mod)
                          setEditingFlow(newFlow)
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="text-left">
                          <span className="text-sm font-medium text-muted-foreground">{t(MODULE_LABEL_KEYS[mod] ?? mod)}</span>
                          <p className="text-xs text-muted-foreground">{t('approvalFlows.unconfiguredDesc')}</p>
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
              <GitBranch className="mb-3 h-8 w-8 text-border" />
              <p className="text-sm text-muted-foreground">{t('approvalFlows.noFlowForModule', { module: t(MODULE_LABEL_KEYS[moduleFilter] ?? moduleFilter) })}</p>
              <button
                onClick={() => {
                  const newFlow = emptyFlow(moduleFilter as ApprovalModule, companyId)
                  newFlow.name = `${MODULE_LABEL_KEYS[moduleFilter]} approval`
                  setCreatingModule(moduleFilter as ApprovalModule)
                  setEditingFlow(newFlow)
                  setModuleFilter('all')
                }}
                className="mt-2 text-xs font-medium text-primary hover:underline"
              >
                {t('approvalFlows.createFlow')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
