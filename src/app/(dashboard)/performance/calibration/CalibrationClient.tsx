'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Sparkles, CheckCircle2, AlertTriangle, Grid3X3 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import EmployeeInsightPanel from '@/components/performance/EmployeeInsightPanel'
import BiasDetectionBanner from '@/components/performance/BiasDetectionBanner'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/use-toast'

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string }

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

// ─── EMS 9-Block Labels ──────────────────────────────────

const BLOCK_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: '1A', color: 'bg-[#FEE2E2] text-[#B91C1C]' },
  2: { label: '2A', color: 'bg-[#FEF3C7] text-[#B45309]' },
  3: { label: '3A', color: 'bg-[#D1FAE5] text-[#047857]' },
  4: { label: '1B', color: 'bg-[#FEF3C7] text-[#B45309]' },
  5: { label: '2B', color: 'bg-[#EDF1FE] text-[#4B6DE0]' },
  6: { label: '3B', color: 'bg-[#D1FAE5] text-[#047857]' },
  7: { label: '1C', color: 'bg-[#E0E7FF] text-[#4B6DE0]' },
  8: { label: '2C', color: 'bg-[#D1FAE5] text-[#047857]' },
  9: { label: '3C', color: 'bg-[#EDF1FE] text-[#4B6DE0]' },
}

const STATUS_MAP: Record<string, { label: string; style: string }> = {
  CALIBRATION_DRAFT: { label: '임시저장', style: 'bg-[#F5F5F5] text-[#666]' },
  CALIBRATION_IN_PROGRESS: { label: '진행 중', style: 'bg-[#FEF3C7] text-[#B45309]' },
  CALIBRATION_COMPLETED: { label: '완료', style: 'bg-[#D1FAE5] text-[#047857]' },
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

  // ─── Fetch cycles ────────────────────────────────────

  useEffect(() => {
    async function fetchCycles() {
      try {
        const res = await apiClient.getList<CycleOption>('/api/v1/performance/cycles', { page: 1, limit: 100 })
        const calibCycles = res.data.filter((c) => c.status === 'CALIBRATION' || c.status === 'CLOSED')
        setCycles(calibCycles)
        if (calibCycles.length > 0) setSelectedCycleId(calibCycles[0].id)
      } catch { /* ignore */ }
    }
    fetchCycles()
  }, [])

  // ─── Fetch sessions ─────────────────────────────────

  const fetchSessions = useCallback(async () => {
    if (!selectedCycleId) return
    setLoading(true)
    try {
      const res = await apiClient.getList<CalibSession>('/api/v1/performance/calibration/sessions', { cycleId: selectedCycleId })
      setSessions(res.data)
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
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

  // ─── Build 9-Block Grid ─────────────────────────────

  const buildBlockGrid = () => {
    if (!selectedSession) return null
    const grid: Record<number, EvalItem[]> = {}
    for (let i = 1; i <= 9; i++) grid[i] = []

    for (const ev of selectedSession.evaluations) {
      const blockNum = ev.emsBlock ? parseInt(ev.emsBlock.replace(/[^\d]/g, '')) || 5 : 5
      if (grid[blockNum]) grid[blockNum].push(ev)
    }

    // 3x3 grid: rows = competency (high to low), cols = performance (low to high)
    const gridLayout = [
      [7, 8, 9], // High competency
      [4, 5, 6], // Mid
      [1, 2, 3], // Low competency
    ]

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Grid3X3 className="w-4 h-4 text-[#666]" />
          <span className="text-sm font-medium text-[#333]">EMS 9-Block Matrix</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {gridLayout.flat().map((blockNum) => {
            const blockInfo = BLOCK_LABELS[blockNum]
            const items = grid[blockNum] ?? []
            return (
              <div
                key={blockNum}
                className={`rounded-lg border border-[#E8E8E8] p-2 min-h-[80px] ${items.length > 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${blockInfo?.color ?? ''}`}>
                    {blockInfo?.label ?? blockNum}
                  </span>
                  <span className="text-xs text-[#999]">{items.length}명</span>
                </div>
                <div className="space-y-0.5">
                  {items.slice(0, 3).map((ev) => (
                    <div
                      key={ev.employeeId}
                      className="flex items-center gap-1 text-xs bg-white border border-[#E8E8E8] rounded-md px-1.5 py-0.5 cursor-pointer hover:border-[#5E81F4] hover:bg-[#EDF1FE] transition-colors"
                      onClick={() => handleEmployeeChipClick(ev)}
                    >
                      <span
                        className="truncate max-w-[60px]"
                        title={ev.employee.name}
                        onClick={(e) => {
                          e.stopPropagation()
                          setAdjEmployee(ev)
                          setAdjPerfScore(ev.performanceScore ?? 3)
                          setAdjCompScore(ev.competencyScore ?? 3)
                        }}
                      >
                        {ev.employee.name}
                      </span>
                      {readinessMap[ev.employeeId] === 'READY_NOW' && <span className="flex-shrink-0">🟢</span>}
                      {readinessMap[ev.employeeId] === 'READY_1_2_YEARS' && <span className="flex-shrink-0">🟡</span>}
                      {readinessMap[ev.employeeId] === 'READY_3_PLUS_YEARS' && <span className="flex-shrink-0">🔴</span>}
                    </div>
                  ))}
                  {items.length > 3 && (
                    <span className="text-xs text-[#999]">+{items.length - 3}명</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-xs text-[#999] mt-1">
          <span>{t('kr_kec84b1ea_low')}</span>
          <span>{t('kr_kec84b1ea_high')}</span>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="p-4 flex items-center justify-center h-64 text-[#666]">{tc('loading')}...</div>
  }

  return (
    <>
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('calibration')}</h1>
          <p className="text-sm text-[#666] mt-1">{t('kr_kec84b1ea_kecba98eb_keab480eb')}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedCycleId}
            onChange={(e) => { setSelectedCycleId(e.target.value); setSelectedSession(null) }}
            className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10"
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
        <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              placeholder="세션 이름"
              className="flex-1 px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10 placeholder:text-[#999]"
            />
            <button
              onClick={handleCreateSession}
              className={`px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium`}
            >
              {t('kr_kec839dec')}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#666] hover:bg-[#FAFAFA]"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sessions list */}
        <div className="rounded-xl border border-[#E8E8E8] bg-white">
          <div className="px-5 py-4 border-b border-[#E8E8E8]">
            <h2 className="text-base font-semibold text-[#1A1A1A]">{t('calibration_kec84b8ec')}</h2>
          </div>
          <div className="divide-y divide-[#F5F5F5]">
            {sessions.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[#999]">{t('kr_kec84b8ec_kec9786ec')}</div>
            )}
            {sessions.map((s) => {
              const st = STATUS_MAP[s.status]
              return (
                <button
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  className={`w-full px-5 py-3 text-left hover:bg-[#FAFAFA] transition-colors ${
                    selectedSession?.id === s.id ? 'bg-[#EDF1FE]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#1A1A1A]">{s.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st?.style ?? ''}`}>
                      {st?.label ?? s.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#999] mt-0.5">
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
            <div className="rounded-xl border border-[#E8E8E8] bg-white flex items-center justify-center h-64">
              <p className="text-sm text-[#666]">{tc('loading')}...</p>
            </div>
          ) : !selectedSession ? (
            <div className="rounded-xl border border-[#E8E8E8] bg-white flex items-center justify-center h-64">
              <p className="text-sm text-[#999]">{t('kr_kec84b8ec_kec84a0ed')}</p>
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
              <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
                {buildBlockGrid()}
              </div>

              {/* AI Analysis button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAiAnalysis}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#E0E7FF] text-[#4B6DE0] hover:bg-[#C7D2FE] disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {aiLoading ? t('aiAnalyzing') : 'AI 캘리브레이션 분석'}
                </button>
              </div>

              {/* Adjustment form */}
              {adjEmployee && (
                <div className="rounded-xl border border-[#E8E8E8] bg-white p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-[#1A1A1A]">
                      <AlertTriangle className="w-4 h-4 inline mr-1 text-[#B45309]" />
                      점수 조정: {adjEmployee.employee.name}
                    </h3>
                    <button onClick={() => setAdjEmployee(null)} className="text-sm text-[#999] hover:text-[#666]">{t('close')}</button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-[#333] mb-1 block">{t('kr_kec84b1ea_score')}</label>
                      <input
                        type="number"
                        min={1} max={5} step={0.1}
                        value={adjPerfScore}
                        onChange={(e) => setAdjPerfScore(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#333] mb-1 block">{t('kr_kec97adeb_score')}</label>
                      <input
                        type="number"
                        min={1} max={5} step={0.1}
                        value={adjCompScore}
                        onChange={(e) => setAdjCompScore(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#333] mb-1 block">{t('kr_keca1b0ec_kec82acec')}</label>
                    <textarea
                      rows={2}
                      value={adjReason}
                      onChange={(e) => setAdjReason(e.target.value)}
                      placeholder={tCommon('placeholderAdjustmentReason')}
                      className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10 placeholder:text-[#999] resize-none"
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
                <div className="rounded-xl border border-[#E8E8E8] bg-white">
                  <div className="px-5 py-4 border-b border-[#E8E8E8]">
                    <h3 className="text-base font-semibold text-[#1A1A1A]">{t('kr_keca1b0ec_kec9db4eb')}</h3>
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
                            <td className={cn(TABLE_STYLES.cell, "text-center font-medium text-[#5E81F4]")}>{adj.adjustedBlock}</td>
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
                    className="flex items-center gap-2 px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-sm font-medium"
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
