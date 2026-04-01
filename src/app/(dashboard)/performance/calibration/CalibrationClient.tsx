'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Sparkles, CheckCircle2, AlertTriangle, Layers } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { getAllowedStatuses } from '@/lib/performance/pipeline'
import type { SessionUser } from '@/types'
import EmployeeInsightPanel from '@/components/performance/EmployeeInsightPanel'
import BiasDetectionBanner from '@/components/performance/BiasDetectionBanner'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/use-toast'
import CalibrationBlockGrid from './components/CalibrationBlockGrid'
import CalibrationBatchToolbar from './components/CalibrationBatchToolbar'
import CalibrationBatchSaveDialog from './components/CalibrationBatchSaveDialog'
import { useBatchAdjustmentState } from './hooks/useBatchAdjustmentState'

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string; half: string }

interface CalibSession {
  id: string
  name: string
  status: string
  department: { id: string; name: string } | null
  cycle: { id: string; name: string }
  creator: { id: string; name: string }
  _count: { adjustments: number }
  completedAt: string | null
  createdAt: string
}

interface EvalItem {
  id: string
  employeeId: string
  performanceScore: number | null
  competencyScore: number | null
  emsBlock: string | null
  employee: {
    id: string; name: string; employeeCode: string
    department: { name: string } | null
    jobGrade: { name: string } | null
  }
}

interface SessionDetail {
  id: string
  name: string
  status: string
  notes: string | null
  blockDistribution: Record<string, number> | null
  evaluations: EvalItem[]
  adjustments: AdjItem[]
}

interface AdjItem {
  id: string
  employeeId: string
  originalBlock: string
  adjustedBlock: string
  reason: string
  employee: { id: string; name: string; employeeCode: string }
  originalPerformanceScore: number
  originalCompetencyScore: number
  adjustedPerformanceScore: number
  adjustedCompetencyScore: number
}

const STATUS_MAP: Record<string, { label: string; style: string }> = {
  CALIBRATION_DRAFT: { label: '임시저장', style: 'bg-muted text-muted-foreground' },
  CALIBRATION_IN_PROGRESS: { label: '진행 중', style: 'bg-amber-500/15 text-amber-700' },
  CALIBRATION_COMPLETED: { label: '완료', style: 'bg-emerald-500/15 text-emerald-700' },
}

// ─── Component ────────────────────────────────────────────

export default function CalibrationClient({ user }: { user: SessionUser }) {
  const t = useTranslations('performance')
  const tc = useTranslations('common')

  const [cycles, setCycles] = useState<CycleOption[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState('')
  const [sessions, setSessions] = useState<CalibSession[]>([])
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newSessionName, setNewSessionName] = useState('')

  const { confirm, dialogProps } = useConfirmDialog()
  const tCommon = useTranslations('common')

  const [insightEmployeeId, setInsightEmployeeId] = useState<string | null>(null)
  const [insightEmployeeName, setInsightEmployeeName] = useState<string>('')
  const [readinessMap, setReadinessMap] = useState<Record<string, string>>({})

  // Adjustment form
  const [adjEmployee, setAdjEmployee] = useState<EvalItem | null>(null)
  const [adjPerfScore, setAdjPerfScore] = useState(3)
  const [adjCompScore, setAdjCompScore] = useState(3)
  const [adjReason, setAdjReason] = useState('')

  // Batch mode
  const [batchMode, setBatchMode] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  // ─── Batch adjustment hook ───────────────────────────

  const handleBatchSaveComplete = useCallback(() => {
    if (selectedSession) loadSession(selectedSession.id)
  }, [selectedSession]) // eslint-disable-line react-hooks/exhaustive-deps

  const batch = useBatchAdjustmentState(
    selectedSession?.evaluations ?? [],
    selectedSession?.id ?? null,
    handleBatchSaveComplete,
  )

  // beforeunload 경고
  useEffect(() => {
    if (!batch.hasUnsavedChanges) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [batch.hasUnsavedChanges])

  // ─── Fetch cycles ────────────────────────────────────

  useEffect(() => {
    async function fetchCycles() {
      try {
        const res = await apiClient.getList<CycleOption>('/api/v1/performance/cycles', { page: 1, limit: 100 })
        const calibCycles = res.data.filter((c) => getAllowedStatuses('calibration', c.half ?? 'H2').includes(c.status))
        setCycles(calibCycles)
        if (calibCycles.length > 0) setSelectedCycleId(calibCycles[0].id)
      } catch (err) { toast({ title: '평가 주기 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }); setLoading(false) }
    }
    fetchCycles()
  }, [])

  // ─── Fetch sessions ─────────────────────────────────

  const fetchSessions = useCallback(async () => {
    if (!selectedCycleId) { setLoading(false); return }
    setLoading(true)
    try {
      const res = await apiClient.getList<CalibSession>('/api/v1/performance/calibration/sessions', { cycleId: selectedCycleId })
      setSessions(res.data)
    } catch (err) { toast({ title: '캘리브레이션 세션 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [selectedCycleId])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  // ─── Load readiness data ────────────────────────────

  const loadReadinessData = useCallback(async (employeeIds: string[]) => {
    if (employeeIds.length === 0) return
    try {
      const res = await apiClient.post<{ employeeId: string; readiness: string }[]>(
        '/api/v1/succession/readiness-batch',
        { employeeIds },
      )
      const map: Record<string, string> = {}
      for (const item of (res.data ?? [])) {
        map[item.employeeId] = item.readiness
      }
      setReadinessMap(map)
    } catch {
      // Readiness 없으면 뱃지 미표시 (graceful degradation)
    }
  }, [])

  // ─── Load session detail ────────────────────────────

  const loadSession = useCallback(async (sessionId: string) => {
    setDetailLoading(true)
    setReadinessMap({})   // 이전 세션 데이터 초기화
    try {
      const res = await apiClient.get<SessionDetail>(`/api/v1/performance/calibration/sessions/${sessionId}`)
      setSelectedSession(res.data)
      // Readiness 배지 데이터 로드
      if (res.data.evaluations && res.data.evaluations.length > 0) {
        loadReadinessData(res.data.evaluations.map((e: EvalItem) => e.employeeId))
      }
    } catch (err) { toast({ title: '세션 상세 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
    finally { setDetailLoading(false) }
  }, [loadReadinessData])

  // ─── Create session ─────────────────────────────────

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return
    try {
      await apiClient.post('/api/v1/performance/calibration/sessions', {
        cycleId: selectedCycleId,
        name: newSessionName,
      })
      setNewSessionName('')
      setShowCreateForm(false)
      await fetchSessions()
    } catch {
      toast({ title: t('kr_kec84b8ec_kec839dec_kec8ba4ed'), variant: 'destructive' })
    }
  }

  // ─── Submit adjustment ──────────────────────────────

  const handleAdjustment = useCallback(async () => {
    if (!adjEmployee || !selectedSession || !adjReason.trim()) return
    try {
      await apiClient.post('/api/v1/performance/calibration/adjustments', {
        sessionId: selectedSession.id,
        employeeId: adjEmployee.employeeId,
        evaluationId: adjEmployee.id,
        adjustedPerformanceScore: adjPerfScore,
        adjustedCompetencyScore: adjCompScore,
        reason: adjReason,
      })
      setAdjEmployee(null)
      setAdjReason('')
      await loadSession(selectedSession.id)
    } catch {
      toast({ title: t('kr_keca1b0ec_keca080ec_kec8ba4ed'), variant: 'destructive' })
    }
  }, [adjEmployee, selectedSession, adjReason, adjPerfScore, adjCompScore, loadSession])

  // ─── AI Analysis ────────────────────────────────────

  const handleAiAnalysis = async () => {
    if (!selectedSession) return
    setAiLoading(true)
    try {
      const blockDist: Record<string, number> = {}
      for (const ev of selectedSession.evaluations) {
        const block = ev.emsBlock ?? 'N/A'
        blockDist[block] = (blockDist[block] ?? 0) + 1
      }

      const res = await apiClient.post<{
        overall_assessment: string
        outliers: { employeeName: string; reason: string; suggestion: string }[]
        recommendations: string[]
      }>('/api/v1/ai/calibration-analysis', {
        sessionName: selectedSession.name,
        evaluations: selectedSession.evaluations.map((ev) => ({
          employeeName: ev.employee.name,
          performanceScore: ev.performanceScore ?? 0,
          competencyScore: ev.competencyScore ?? 0,
          emsBlock: ev.emsBlock ?? 'N/A',
        })),
        blockDistribution: blockDist,
      })

      toast({ title: `AI 분석 완료:\n${res.data.overall_assessment}\n\n권고사항:\n${res.data.recommendations.join('\n')}` })
    } catch {
      toast({ title: t('kr_ai_kebb684ec_kec8ba4ed'), variant: 'destructive' })
    } finally { setAiLoading(false) }
  }

  // ─── Employee chip click ────────────────────────────

  const handleEmployeeChipClick = useCallback((ev: EvalItem) => {
    setInsightEmployeeId(ev.employeeId)
    setInsightEmployeeName(ev.employee.name)
  }, [])

  // ─── Batch mode toggle ──────────────────────────────

  const handleToggleBatchMode = useCallback(() => {
    setBatchMode((prev) => {
      if (prev) {
        // 배치 모드 OFF 시 선택 초기화 (pending은 유지)
        batch.clearSelection()
      }
      return !prev
    })
  }, [batch])

  if (loading) {
    return <div className="p-4 flex items-center justify-center h-64 text-muted-foreground">{tc('loading')}...</div>
  }

  return (
    <>
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('calibration')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('kr_kec84b1ea_kecba98eb_keab480eb')}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedCycleId}
            onChange={(e) => { setSelectedCycleId(e.target.value); setSelectedSession(null) }}
            className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
          >
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={() => setShowCreateForm(true)}
            className={`flex items-center gap-2 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium`}
          >
            <Plus className="w-4 h-4" />
            {t('kr_kec8388_kec84b8ec')}
          </button>
        </div>
      </div>

      {/* Create session form */}
      {showCreateForm && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              placeholder="세션 이름"
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
            />
            <button
              onClick={handleCreateSession}
              className={`px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium`}
            >
              {t('kr_kec839dec')}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-background"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sessions list */}
        <div className="rounded-xl border border-border bg-card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">{t('calibration_kec84b8ec')}</h2>
          </div>
          <div className="divide-y divide-border">
            {sessions.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">{t('kr_kec84b8ec_kec9786ec')}</div>
            )}
            {sessions.map((s) => {
              const st = STATUS_MAP[s.status]
              return (
                <button
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  className={`w-full px-5 py-3 text-left hover:bg-background transition-colors ${
                    selectedSession?.id === s.id ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st?.style ?? ''}`}>
                      {st?.label ?? s.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.department?.name ?? '전사'} · 조정 {s._count.adjustments}건
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Session detail + 9-block */}
        <div className="lg:col-span-2 space-y-4">
          {detailLoading ? (
            <div className="rounded-xl border border-border bg-card flex items-center justify-center h-64">
              <p className="text-sm text-muted-foreground">{tc('loading')}...</p>
            </div>
          ) : !selectedSession ? (
            <div className="rounded-xl border border-border bg-card flex items-center justify-center h-64">
              <p className="text-sm text-muted-foreground">{t('kr_kec84b8ec_kec84a0ed')}</p>
            </div>
          ) : (
            <>
              {/* Bias Detection Banner */}
              {selectedSession && selectedCycleId && (
                <BiasDetectionBanner
                  cycleId={selectedCycleId}
                  onRunCheck={() => loadSession(selectedSession.id)}
                />
              )}

              {/* 9-Block Grid */}
              <div className="rounded-2xl bg-card p-5">
                <CalibrationBlockGrid
                  evaluations={selectedSession.evaluations}
                  batchMode={batchMode}
                  pendingChanges={batch.pendingChanges}
                  selectedIds={batch.selectedIds}
                  readinessMap={readinessMap}
                  onToggleSelect={batch.toggleSelect}
                  onEmployeeChipClick={handleEmployeeChipClick}
                  onAdjEmployeeClick={(ev) => {
                    setAdjEmployee(ev)
                    setAdjPerfScore(ev.performanceScore ?? 3)
                    setAdjCompScore(ev.competencyScore ?? 3)
                  }}
                  onDragMove={batch.moveSingle}
                  onSelectAllInBlock={batch.selectAllInBlock}
                />
              </div>

              {/* Batch Toolbar */}
              {batchMode && (
                <CalibrationBatchToolbar
                  selectedCount={batch.selectedIds.size}
                  pendingCount={batch.pendingCount}
                  onMoveToBlock={batch.moveSelected}
                  onClearSelection={batch.clearSelection}
                  onClearAll={batch.clearAll}
                  onOpenSaveDialog={() => setShowSaveDialog(true)}
                />
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleBatchMode}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                    batchMode
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  <Layers className="w-4 h-4" />
                  {t('calibrationBatch.batchMode')}
                </button>
                <button
                  onClick={handleAiAnalysis}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-500/15 text-primary/90 hover:bg-indigo-200 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {aiLoading ? t('aiAnalyzing') : 'AI 캘리브레이션 분석'}
                </button>
              </div>

              {/* Adjustment form */}
              {adjEmployee && (
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-foreground">
                      <AlertTriangle className="w-4 h-4 inline mr-1 text-amber-700" />
                      점수 조정: {adjEmployee.employee.name}
                    </h3>
                    <button onClick={() => setAdjEmployee(null)} className="text-sm text-muted-foreground hover:text-muted-foreground">{t('close')}</button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">{t('kr_kec84b1ea_score')}</label>
                      <input
                        type="number"
                        min={1} max={5} step={0.1}
                        value={adjPerfScore}
                        onChange={(e) => setAdjPerfScore(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">{t('kr_kec97adeb_score')}</label>
                      <input
                        type="number"
                        min={1} max={5} step={0.1}
                        value={adjCompScore}
                        onChange={(e) => setAdjCompScore(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">{t('kr_keca1b0ec_kec82acec')}</label>
                    <textarea
                      rows={2}
                      value={adjReason}
                      onChange={(e) => setAdjReason(e.target.value)}
                      placeholder={tCommon('placeholderAdjustmentReason')}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground resize-none"
                    />
                  </div>
                  <button
                    onClick={handleAdjustment}
                    disabled={!adjReason.trim()}
                    className={`px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50`}
                  >
                    {t('kr_keca1b0ec_save')}
                  </button>
                </div>
              )}

              {/* Adjustment history */}
              {selectedSession.adjustments.length > 0 && (
                <div className="rounded-xl border border-border bg-card">
                  <div className="px-5 py-4 border-b border-border">
                    <h3 className="text-base font-semibold text-foreground">{t('kr_keca1b0ec_kec9db4eb')}</h3>
                  </div>
                  <div className={TABLE_STYLES.wrapper}>
                    <table className={TABLE_STYLES.table}>
                      <thead>
                        <tr className={TABLE_STYLES.header}>
                          <th className={TABLE_STYLES.headerCell}>{t('kr_keca781ec')}</th>
                          <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('krw_keb9e98_kebb894eb')}</th>
                          <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('kr_keca1b0ec_kebb894eb')}</th>
                          <th className={TABLE_STYLES.headerCell}>{t('kr_kec82acec')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSession.adjustments.map((adj) => (
                          <tr key={adj.id} className={TABLE_STYLES.row}>
                            <td className={cn(TABLE_STYLES.cell)}>{adj.employee.name}</td>
                            <td className={cn(TABLE_STYLES.cellMuted, "text-center")}>{adj.originalBlock}</td>
                            <td className={cn(TABLE_STYLES.cell, "text-center font-medium text-primary")}>{adj.adjustedBlock}</td>
                            <td className={TABLE_STYLES.cellMuted}>{adj.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Complete session */}
              {selectedSession.status !== 'CALIBRATION_COMPLETED' && (
                <div className="flex justify-end">
                  <button
                    onClick={async () => {
                      confirm({ title: t('calibration_kec9d84_kec9984eb'), onConfirm: async () => {
                        try {
                          await apiClient.put(`/api/v1/performance/calibration/sessions/${selectedSession.id}`, {
                            status: 'CALIBRATION_COMPLETED',
                          })
                          await loadSession(selectedSession.id)
                          await fetchSessions()
                        } catch { toast({ title: t('complete_kecb298eb_kec8ba4ed'), variant: 'destructive' }) }
                      }})
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {t('calibration_complete')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>

    {/* 배치 저장 다이얼로그 */}
    <CalibrationBatchSaveDialog
      open={showSaveDialog}
      onOpenChange={setShowSaveDialog}
      pendingChanges={batch.pendingChanges}
      distribution={batch.mergedDistribution}
      isSaving={batch.isSaving}
      onSave={(reason) => {
        batch.saveBatch(reason)
        setShowSaveDialog(false)
      }}
    />

    {/* 직원 통합 사이드패널 */}
    <EmployeeInsightPanel
      employeeId={insightEmployeeId}
      employeeName={insightEmployeeName}
      onClose={() => setInsightEmployeeId(null)}
    />
      <ConfirmDialog {...dialogProps} />
      </>
  )
}
