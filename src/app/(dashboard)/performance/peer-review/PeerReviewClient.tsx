'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Settings, ClipboardList, BarChart3 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'

// ─── Types ───────────────────────────────────────────────

interface Cycle {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
}

interface MyReviewItem {
  nominationId: string
  employee: {
    id: string
    name: string
    employeeNo: string
    department: { name: string } | null
    jobGrade: { name: string } | null
  }
  evalStatus: string | null
}

interface TeamResult {
  cycleId: string
  totalEmployees: number
  totalNominations: number
  completionRate: number
  employees: {
    employee: { id: string; name: string; employeeNo: string; department: string }
    nominationCount: number
    completedCount: number
    avgScore: number | null
  }[]
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: '미작성', cls: 'bg-[#FAFAFA] text-[#555] border-[#E8E8E8]' },
  SUBMITTED: { label: '제출 완료', cls: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]' },
  CONFIRMED: { label: '확정', cls: 'bg-[#E8F5E9] text-[#00A844] border-[#E8F5E9]' },
}

// ─── Component ───────────────────────────────────────────

export default function PeerReviewClient() {
  const router = useRouter()
  const [tab, setTab] = useState<'my-reviews' | 'setup' | 'results'>('my-reviews')
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string>('')
  const [myReviews, setMyReviews] = useState<MyReviewItem[]>([])
  const [teamResults, setTeamResults] = useState<TeamResult | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchCycles = useCallback(async () => {
    try {
      const res = await apiClient.get<{ items: Cycle[] }>('/api/v1/performance/cycles?size=10')
      const items = res.data.items ?? []
      setCycles(items)
      if (items.length > 0 && !selectedCycleId) {
        setSelectedCycleId(items[0].id)
      }
    } catch { /* ignore */ }
  }, [selectedCycleId])

  const fetchData = useCallback(async () => {
    if (!selectedCycleId) return
    setLoading(true)
    try {
      if (tab === 'my-reviews') {
        const res = await apiClient.get<MyReviewItem[]>(`/api/v1/peer-review/my-reviews?cycleId=${selectedCycleId}`)
        setMyReviews(res.data ?? [])
      } else if (tab === 'results') {
        const res = await apiClient.get<TeamResult>(`/api/v1/peer-review/results/team?cycleId=${selectedCycleId}`)
        setTeamResults(res.data)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [selectedCycleId, tab])

  useEffect(() => { fetchCycles() }, [fetchCycles])
  useEffect(() => { fetchData() }, [fetchData])

  const TABS = [
    { key: 'my-reviews' as const, label: '내 평가', icon: ClipboardList },
    { key: 'setup' as const, label: '추천/지정', icon: Settings },
    { key: 'results' as const, label: '팀 결과', icon: BarChart3 },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-[#00C853]" />
        <h1 className="text-2xl font-bold text-[#1A1A1A]">360° 동료 평가</h1>
      </div>

      {/* Cycle Selector + Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex border-b border-[#E8E8E8]">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 ${tab === t.key ? 'border-[#00C853] text-[#00C853]' : 'border-transparent text-[#666] hover:text-[#333]'}`}>
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
        <select value={selectedCycleId} onChange={(e) => setSelectedCycleId(e.target.value)}
          className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm">
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center text-[#999] py-10">로딩 중...</div>
      ) : tab === 'my-reviews' ? (
        /* My Reviews Tab */
        <div className="space-y-4">
          {myReviews.length === 0 ? (
            <div className="text-center text-[#999] py-10 text-sm">할당된 동료 평가가 없습니다.</div>
          ) : (
            myReviews.map((r) => (
              <div key={r.nominationId} className={`${CARD_STYLES.kpi} flex items-center justify-between`}>
                <div>
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">{r.employee.name}</h3>
                  <p className="text-xs text-[#666] mt-1">
                    {r.employee.employeeNo} · {r.employee.department?.name ?? '-'}
                    {r.employee.jobGrade && ` · ${r.employee.jobGrade.name}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {r.evalStatus ? (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[r.evalStatus]?.cls ?? ''}`}>
                      {STATUS_BADGE[r.evalStatus]?.label ?? r.evalStatus}
                    </span>
                  ) : (
                    <button onClick={() => router.push(`/performance/peer-review/evaluate/${r.nominationId}`)}
                      className={`px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium`}>
                      평가하기
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : tab === 'setup' ? (
        /* Setup Tab */
        <div className="text-center py-10">
          <button onClick={() => router.push(`/performance/peer-review/${selectedCycleId}/setup`)}
            className={`px-6 py-3 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium`}>
            추천/지정 관리 열기
          </button>
        </div>
      ) : (
        /* Results Tab */
        teamResults && (
          <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <div className={CARD_STYLES.padded}>
                <p className="text-xs text-[#666] mb-1">대상 직원</p>
                <p className="text-3xl font-bold text-[#1A1A1A]">{teamResults.totalEmployees}명</p>
              </div>
              <div className={CARD_STYLES.padded}>
                <p className="text-xs text-[#666] mb-1">총 지명</p>
                <p className="text-3xl font-bold text-[#1A1A1A]">{teamResults.totalNominations}건</p>
              </div>
              <div className={CARD_STYLES.padded}>
                <p className="text-xs text-[#666] mb-1">완료율</p>
                <p className="text-3xl font-bold text-[#00C853]">{teamResults.completionRate}%</p>
              </div>
            </div>

            {/* Employee Table */}
            <div className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    <th className={TABLE_STYLES.headerCell}>직원</th>
                    <th className={TABLE_STYLES.headerCell}>부서</th>
                    <th className={TABLE_STYLES.headerCell}>지명 수</th>
                    <th className={TABLE_STYLES.headerCell}>완료</th>
                    <th className={TABLE_STYLES.headerCell}>평균 점수</th>
                    <th className={TABLE_STYLES.headerCell}>상세</th>
                  </tr>
                </thead>
                <tbody>
                  {teamResults.employees.map((e) => (
                    <tr key={e.employee.id} className={TABLE_STYLES.header}>
                      <td className="px-4 py-3 text-sm text-[#1A1A1A] font-medium">{e.employee.name}</td>
                      <td className="px-4 py-3 text-sm text-[#555]">{e.employee.department}</td>
                      <td className="px-4 py-3 text-sm text-center text-[#555]">{e.nominationCount}</td>
                      <td className="px-4 py-3 text-sm text-center text-[#555]">{e.completedCount}</td>
                      <td className="px-4 py-3 text-sm text-center font-medium text-[#1A1A1A]">
                        {e.avgScore != null ? `${e.avgScore}/5` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => router.push(`/performance/peer-review/results/${selectedCycleId}?employeeId=${e.employee.id}`)}
                          className="text-sm text-[#00C853] hover:text-[#00A844] font-medium">보기</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
