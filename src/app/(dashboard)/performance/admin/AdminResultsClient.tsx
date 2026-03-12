'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { BarChart3, Download, Lock } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { TABLE_STYLES } from '@/lib/styles'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/use-toast'

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string }

interface AdminResult {
  employee: {
    id: string; name: string; employeeCode: string
    department: { id: string; name: string } | null
    jobGrade: { name: string } | null
    manager: { id: string; name: string } | null
  }
  evaluator: { id: string; name: string }
  selfEval: { performanceScore: number | null; competencyScore: number | null; emsBlock: string | null } | null
  managerEval: { performanceScore: number | null; competencyScore: number | null; emsBlock: string | null }
  finalResult: { performanceScore: number | null; competencyScore: number | null; emsBlock: string | null; calibrated: boolean }
}

interface DeptOption { id: string; name: string }

// ─── Component ────────────────────────────────────────────

export default function AdminResultsClient({ user }: { user: SessionUser }) {
  const t = useTranslations('performance')
  const tc = useTranslations('common')

  const [cycles, setCycles] = useState<CycleOption[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState('')
  const [departments, setDepartments] = useState<DeptOption[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [results, setResults] = useState<AdminResult[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    async function init() {
      try {
        const [cycleRes, deptRes] = await Promise.all([
          apiClient.getList<CycleOption>('/api/v1/performance/cycles', { page: 1, limit: 100 }),
          apiClient.getList<DeptOption>('/api/v1/org/departments', { page: 1, limit: 100 }),
        ])
        setCycles(cycleRes.data)
        setDepartments(deptRes.data)
        if (cycleRes.data.length > 0) setSelectedCycleId(cycleRes.data[0].id)
      } catch { /* ignore */ }
    }
    init()
  }, [])

  const fetchResults = useCallback(async () => {
  const { confirm, dialogProps } = useConfirmDialog()
    if (!selectedCycleId) return
    setLoading(true)
    try {
      const params: Record<string, string | number> = { cycleId: selectedCycleId, page, limit: 20 }
      if (selectedDeptId) params.departmentId = selectedDeptId
      const res = await apiClient.getList<AdminResult>('/api/v1/performance/results/admin', params)
      setResults(res.data)
      setTotalPages(res.pagination.totalPages)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [selectedCycleId, selectedDeptId, page])

  useEffect(() => { fetchResults() }, [fetchResults])

  // Block distribution
  const blockDist: Record<string, number> = {}
  for (const r of results) {
    const block = r.finalResult.emsBlock ?? 'N/A'
    blockDist[block] = (blockDist[block] ?? 0) + 1
  }

  const handleFinalize = async () => {
    const cycle = cycles.find((c) => c.id === selectedCycleId)
    if (cycle?.status !== 'CALIBRATION') {
      toast({ title: '캘리브레이션 단계에서만 확정할 수 있습니다.' })
      return
    }
    confirm({ title: '성과 주기를 확정하시겠습니까? 확정 후에는 수정할 수 없습니다.', onConfirm: async () => {
      try {
        await apiClient.post(`/api/v1/performance/cycles/${selectedCycleId}/finalize`)
        toast({ title: '성과 주기가 확정되었습니다.' })
        // Refresh
        const res = await apiClient.getList<CycleOption>('/api/v1/performance/cycles', { page: 1, limit: 100 })
        setCycles(res.data)
      } catch {
        toast({ title: '확정에 실패했습니다.', variant: 'destructive' })
      }
    }})
  }

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-64 text-[#666]">{tc('loading')}...</div>
  }

  return (
    <>
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('adminResults')}</h1>
          <p className="text-sm text-[#666] mt-1">전사 성과 결과 관리</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedDeptId}
            onChange={(e) => { setSelectedDeptId(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
          >
            <option value="">전체 부서</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select
            value={selectedCycleId}
            onChange={(e) => { setSelectedCycleId(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
          >
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Block distribution */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
        <h2 className="text-base font-semibold text-[#1A1A1A] flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-[#666]" />
          블록 분포
        </h2>
        <div className="flex items-end gap-2">
          {Object.entries(blockDist).sort().map(([block, count]) => (
            <div key={block} className="flex flex-col items-center">
              <span className="text-sm font-bold text-[#1A1A1A]">{count}</span>
              <div
                className="w-12 bg-[#00C853] rounded-t-lg mt-1"
                style={{ height: `${Math.max(count * 20, 8)}px` }}
              />
              <span className="text-xs text-[#666] mt-1">{block}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Results table */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>직원</th>
              <th className={TABLE_STYLES.headerCell}>부서</th>
              <th className={TABLE_STYLES.headerCell}>직급</th>
              <th className={TABLE_STYLES.headerCell}>자기 성과</th>
              <th className={TABLE_STYLES.headerCell}>매니저 성과</th>
              <th className={TABLE_STYLES.headerCell}>최종 성과</th>
              <th className={TABLE_STYLES.headerCell}>최종 역량</th>
              <th className={TABLE_STYLES.headerCell}>EMS</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.employee.id} className={TABLE_STYLES.header}>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-[#1A1A1A]">{r.employee.name}</p>
                  <p className="text-xs text-[#999]">{r.employee.employeeCode}</p>
                </td>
                <td className="px-4 py-3 text-sm text-[#555]">{r.employee.department?.name ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-[#555]">{r.employee.jobGrade?.name ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-center text-[#666]">{r.selfEval?.performanceScore?.toFixed(1) ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-center text-[#666]">{r.managerEval.performanceScore?.toFixed(1) ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-center font-medium text-[#1A1A1A]">{r.finalResult.performanceScore?.toFixed(1) ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-center font-medium text-[#1A1A1A]">{r.finalResult.competencyScore?.toFixed(1) ?? '-'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.finalResult.calibrated ? 'bg-[#E0E7FF] text-[#4338CA]' : 'bg-[#E8F5E9] text-[#00A844]'}`}>
                    {r.finalResult.emsBlock ?? '-'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 border border-[#D4D4D4] rounded-lg text-sm text-[#666] disabled:opacity-50 hover:bg-[#FAFAFA]"
          >
            이전
          </button>
          <span className="text-sm text-[#666]">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 border border-[#D4D4D4] rounded-lg text-sm text-[#666] disabled:opacity-50 hover:bg-[#FAFAFA]"
          >
            다음
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#333] hover:bg-[#FAFAFA]">
            <Download className="w-4 h-4" />
            엑셀 다운로드
          </button>
          {cycles.find((c) => c.id === selectedCycleId)?.status === 'CALIBRATION' && (
            <button
              onClick={handleFinalize}
              className="flex items-center gap-2 px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-sm font-medium"
            >
              <Lock className="w-4 h-4" />
              성과 확정
            </button>
          )}
        </div>
      </div>
    <ConfirmDialog {...dialogProps} />
    </div>
  </>
  )
}
