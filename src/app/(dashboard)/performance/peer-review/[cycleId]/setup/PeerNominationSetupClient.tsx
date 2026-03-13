'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Users, Sparkles, Plus, CheckCircle2, XCircle, Search } from 'lucide-react'
import { apiClient } from '@/lib/api'

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
  AI_RECOMMENDED: 'AI 추천',
  SELF_NOMINATED: '자기 추천',
  MANAGER_ASSIGNED: '매니저 지정',
  HR_ASSIGNED: 'HR 지정',
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PROPOSED: { label: '검토 대기', cls: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]' },
  NOMINATION_APPROVED: { label: '승인', cls: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]' },
  NOMINATION_REJECTED: { label: '거부', cls: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]' },
  NOMINATION_COMPLETED: { label: '평가 완료', cls: 'bg-[#EEF2FF] text-[#4338CA] border-[#EEF2FF]' },
}

// ─── Component ───────────────────────────────────────────

export default function PeerNominationSetupClient() {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')

  const { cycleId } = useParams<{ cycleId: string }>()
  const router = useRouter()

  const [nominations, setNominations] = useState<Nomination[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [candidates, setCandidates] = useState<PeerCandidate[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [empLoading, setEmpLoading] = useState(false)

  const fetchNominations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ items: Nomination[] }>(
        `/api/v1/peer-review/nominations?cycleId=${cycleId}&size=100`
      )
      setNominations(res.data.items ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [cycleId])

  const fetchEmployees = useCallback(async () => {
    if (!searchQuery || searchQuery.length < 2) return
    setEmpLoading(true)
    try {
      const res = await apiClient.get<{ items: Employee[] }>(`/api/v1/employees?search=${encodeURIComponent(searchQuery)}&size=10`)
      setEmployees(res.data.items ?? [])
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
  }

  const handleApproveReject = async (nomId: string, status: string) => {
    try {
      await apiClient.put(`/api/v1/peer-review/nominations/${nomId}`, { status })
      fetchNominations()
    } catch { /* ignore */ }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/performance/peer-review')} className="p-1 hover:bg-[#F5F5F5] rounded-lg">
          <ArrowLeft className="w-5 h-5 text-[#666]" />
        </button>
        <Users className="w-6 h-6 text-[#4F46E5]" />
        <h1 className="text-2xl font-bold text-[#1A1A1A]">동료 평가 추천/지정</h1>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Employee Search + AI Recommendations */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-[#1A1A1A] mb-3">대상 직원 선택</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tCommon('searchEmployee')}
                className="w-full pl-9 pr-3 py-2 border border-[#D4D4D4] rounded-lg text-sm placeholder:text-[#999]" />
            </div>
            {empLoading && <p className="text-xs text-[#999] mt-2">검색 중...</p>}
            {employees.length > 0 && (
              <div className="mt-2 space-y-1">
                {employees.map((emp) => (
                  <button key={emp.id} onClick={() => fetchRecommendations(emp.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-[#FAFAFA] ${selectedEmployeeId === emp.id ? 'bg-[#EEF2FF] border border-[#4F46E5]' : ''}`}>
                    <span className="font-medium text-[#1A1A1A]">{emp.name}</span>
                    <span className="text-[#666] ml-2">{emp.employeeNo}</span>
                    {emp.department && <span className="text-[#999] ml-2">· {emp.department.name}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* AI Recommendations */}
          {selectedEmployeeId && candidates.length > 0 && (
            <div className="bg-[#E0E7FF] rounded-xl border border-[#C7D2FE] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[#4338CA]" />
                <h3 className="text-sm font-semibold text-[#4338CA]">AI 추천 평가자</h3>
              </div>
              <div className="space-y-2">
                {candidates.map((c) => (
                  <div key={c.employeeId} className="bg-white rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#1A1A1A]">{c.name}</p>
                      <p className="text-xs text-[#666]">{c.department} · 협업 점수: {c.totalScore}</p>
                    </div>
                    <button onClick={() => handleNominate(c.employeeId, 'AI_RECOMMENDED', c.totalScore)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#4338CA] text-white rounded-lg text-xs font-medium hover:bg-[#3730A3]">
                      <Plus className="w-3 h-3" /> 추천
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Nominations List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-[#1A1A1A] mb-3">
            현재 지명 목록 ({nominations.length}건)
          </h2>
          {loading ? (
            <p className="text-sm text-[#999] text-center py-4">{tCommon('loading')}</p>
          ) : nominations.length === 0 ? (
            <EmptyState title="데이터가 없습니다" description="조건을 변경하거나 새로운 데이터를 추가해보세요." />
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {nominations.map((n) => (
                <div key={n.id} className="border border-[#F5F5F5] rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[#1A1A1A]">
                        <span className="font-medium">{n.employee.name}</span>
                        <span className="text-[#999] mx-1">←</span>
                        <span className="font-medium">{n.nominee.name}</span>
                      </p>
                      <p className="text-xs text-[#666] mt-1">
                        {SOURCE_LABELS[n.nominationSource] ?? n.nominationSource}
                        {n.collaborationTotalScore != null && ` · 협업 ${n.collaborationTotalScore}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_MAP[n.status]?.cls ?? ''}`}>
                        {STATUS_MAP[n.status]?.label ?? n.status}
                      </span>
                      {n.status === 'PROPOSED' && (
                        <div className="flex gap-1">
                          <button onClick={() => handleApproveReject(n.id, 'NOMINATION_APPROVED')}
                            className="p-1 text-[#059669] hover:bg-[#D1FAE5] rounded">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleApproveReject(n.id, 'NOMINATION_REJECTED')}
                            className="p-1 text-[#EF4444] hover:bg-[#FEE2E2] rounded">
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
    </div>
  )
}
