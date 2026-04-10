'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users, Sparkles, Plus, CheckCircle2, XCircle, Search } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import type { SessionUser } from '@/types'
import { StatusBadge } from '@/components/ui/StatusBadge'

// ─── Types ───────────────────────────────────────────────

interface Employee {
  id: string
  name: string
  employeeNo: string
  department: { name: string } | null
}

interface PeerCandidate {
  employeeId: string
  name: string
  department: string
  totalScore: number
  scores: { type: string; rawCount: number; weightedScore: number }[]
}

interface Nomination {
  id: string
  employeeId: string
  nomineeId: string
  nominationSource: string
  collaborationTotalScore: number | null
  status: string
  employee: { id: string; name: string; employeeNo: string; department: { name: string } | null }
  nominee: { id: string; name: string; employeeNo: string; department: { name: string } | null }
  approver: { id: string; name: string } | null
}

const SOURCE_LABELS: Record<string, string> = {
  AI_RECOMMENDED: 'peerNomination.sourceAiRecommended',
  SELF_NOMINATED: 'peerNomination.sourceSelfNominated',
  MANAGER_ASSIGNED: 'peerNomination.sourceManagerAssigned',
  HR_ASSIGNED: 'peerNomination.sourceHrAssigned',
}

const STATUS_MAP: Record<string, { labelKey: string }> = {
  PROPOSED: { labelKey: 'peerNomination.statusProposed' },
  NOMINATION_APPROVED: { labelKey: 'peerNomination.statusApproved' },
  NOMINATION_REJECTED: { labelKey: 'peerNomination.statusRejected' },
  NOMINATION_COMPLETED: { labelKey: 'peerNomination.statusCompleted' },
}

// ─── Component ───────────────────────────────────────────

export default function PeerNominationSetupClient({ user: _user, cycleId }: { user: SessionUser; cycleId: string }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
  const router = useRouter()

  const [nominations, setNominations] = useState<Nomination[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [candidates, setCandidates] = useState<PeerCandidate[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [empLoading, setEmpLoading] = useState(false)
  const { confirm, dialogProps } = useConfirmDialog()

  const fetchNominations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ items: Nomination[] }>(
        `/api/v1/peer-review/nominations?cycleId=${cycleId}&size=100`
      )
      setNominations(res.data.items ?? [])
    } catch (err) { toast({ title: t('peerNomination.loadNominationsFailed'), description: err instanceof Error ? err.message : tCommon('retryMessage'), variant: 'destructive' }) }
    setLoading(false)
  }, [cycleId])

  const fetchEmployees = useCallback(async () => {
    if (!searchQuery || searchQuery.length < 2) return
    setEmpLoading(true)
    try {
      const res = await apiClient.get<{ items: Employee[] }>(`/api/v1/employees?search=${encodeURIComponent(searchQuery)}&size=10`)
      setEmployees(res.data.items ?? [])
    } catch (err) { toast({ title: t('peerNomination.searchEmployeeFailed'), description: err instanceof Error ? err.message : tCommon('retryMessage'), variant: 'destructive' }) }
    setEmpLoading(false)
  }, [searchQuery])

  useEffect(() => { fetchNominations() }, [fetchNominations])
  useEffect(() => {
    const t = setTimeout(fetchEmployees, 300)
    return () => clearTimeout(t)
  }, [fetchEmployees])

  const fetchRecommendations = async (employeeId: string) => {
    setSelectedEmployeeId(employeeId)
    setSearchQuery('')
    setEmployees([])
    try {
      const res = await apiClient.get<PeerCandidate[]>(
        `/api/v1/peer-review/recommend?employeeId=${employeeId}&cycleId=${cycleId}&limit=5`
      )
      setCandidates(res.data ?? [])
    } catch (err) { toast({ title: t('peerNomination.loadRecommendationsFailed'), description: err instanceof Error ? err.message : tCommon('retryMessage'), variant: 'destructive' }) }
  }

  const handleNominate = async (nomineeId: string, source: string, score?: number) => {
    try {
      await apiClient.post('/api/v1/peer-review/nominations', {
        cycleId,
        employeeId: selectedEmployeeId,
        nomineeId,
        nominationSource: source,
        collaborationTotalScore: score,
      })
      fetchNominations()
      if (selectedEmployeeId) {
        fetchRecommendations(selectedEmployeeId)
      }
    } catch (err) { toast({ title: t('peerNomination.nominateFailed'), description: err instanceof Error ? err.message : tCommon('retryMessage'), variant: 'destructive' }) }
  }

  const handleApproveReject = (nomId: string, status: string) => {
    if (status === 'NOMINATION_APPROVED') {
      confirm({
        title: t('peerNomination.confirmApproveTitle'),
        description: t('peerNomination.confirmApproveDesc'),
        confirmLabel: t('peerNomination.approve'),
        variant: 'default',
        onConfirm: async () => {
          try {
            await apiClient.put(`/api/v1/peer-review/nominations/${nomId}`, { status })
            fetchNominations()
          } catch (err) { toast({ title: t('peerNomination.statusChangeFailed'), description: err instanceof Error ? err.message : tCommon('retryMessage'), variant: 'destructive' }) }
        },
      })
    } else {
      void apiClient.put(`/api/v1/peer-review/nominations/${nomId}`, { status })
        .then(() => fetchNominations())
        .catch((err: unknown) => { toast({ title: t('peerNomination.statusChangeFailed'), description: err instanceof Error ? err.message : tCommon('retryMessage'), variant: 'destructive' }) })
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/performance/peer-review')} className="p-1 hover:bg-muted rounded-lg">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <Users className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">{t('peerReview_kecb694ec_keca780ec')}</h1>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Employee Search + AI Recommendations */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-base font-semibold text-foreground mb-3">{t('kr_keb8c80ec_keca781ec_kec84a0ed')}</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tCommon('searchEmployee')}
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm placeholder:text-muted-foreground" />
            </div>
            {empLoading && <p className="text-xs text-muted-foreground mt-2">{t('search_keca491')}</p>}
            {employees.length > 0 && (
              <div className="mt-2 space-y-1">
                {employees.map((emp) => (
                  <button key={emp.id} onClick={() => fetchRecommendations(emp.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-background ${selectedEmployeeId === emp.id ? 'bg-primary/10 border border-primary' : ''}`}>
                    <span className="font-medium text-foreground">{emp.name}</span>
                    <span className="text-muted-foreground ml-2">{emp.employeeNo}</span>
                    {emp.department && <span className="text-muted-foreground ml-2">· {emp.department.name}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* AI Recommendations */}
          {selectedEmployeeId && candidates.length > 0 && (
            <div className="bg-indigo-500/15 rounded-xl border border-indigo-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary/90" />
                <h3 className="text-sm font-semibold text-primary/90">{t('kr_ai_kecb694ec_ked8f89ea')}</h3>
              </div>
              <div className="space-y-2">
                {candidates.map((c) => (
                  <div key={c.employeeId} className="bg-card rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.department} · {t('peerNomination.collaborationScore', { score: c.totalScore })}</p>
                    </div>
                    <button onClick={() => handleNominate(c.employeeId, 'AI_RECOMMENDED', c.totalScore)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary/90 text-white rounded-lg text-xs font-medium hover:bg-indigo-800">
                      <Plus className="w-3 h-3" /> {t('kr_kecb694ec')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Nominations List */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-base font-semibold text-foreground mb-3">
            {t('peerNomination.nominationList', { count: nominations.length })}
          </h2>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">{tCommon('loading')}</p>
          ) : nominations.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {nominations.map((n) => (
                <div key={n.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{n.employee.name}</span>
                        <span className="text-muted-foreground mx-1">←</span>
                        <span className="font-medium">{n.nominee.name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {SOURCE_LABELS[n.nominationSource] ? t(SOURCE_LABELS[n.nominationSource]) : n.nominationSource}
                        {n.collaborationTotalScore != null && ` · ${t('peerNomination.collaboration', { score: n.collaborationTotalScore })}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={n.status}>
                        {STATUS_MAP[n.status] ? t(STATUS_MAP[n.status].labelKey) : n.status}
                      </StatusBadge>
                      {n.status === 'PROPOSED' && (
                        <div className="flex gap-1">
                          <button onClick={() => handleApproveReject(n.id, 'NOMINATION_APPROVED')}
                            className="p-1 text-emerald-600 hover:bg-emerald-500/15 rounded">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleApproveReject(n.id, 'NOMINATION_REJECTED')}
                            className="p-1 text-red-500 hover:bg-destructive/10 rounded">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
