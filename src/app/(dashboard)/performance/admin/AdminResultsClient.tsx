'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { BarChart3, Download, Lock } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { TABLE_STYLES } from '@/lib/styles'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/use-toast'
import { EmployeeCell } from '@/components/common/EmployeeCell'

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

  const { confirm, dialogProps } = useConfirmDialog()

  const fetchResults = useCallback(async () => {
    if (!selectedCycleId) {
      setLoading(false)
      return
    }
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
      toast({ title: t('calibration_keb8ba8ea_ked9995ec_kec8898_kec9e88ec') })
      return
    }
    confirm({ title: t('kr_kec84b1ea_keca3bcea_ked9995ec_'), onConfirm: async () => {
      try {
        await apiClient.post(`/api/v1/performance/cycles/${selectedCycleId}/finalize`)
        toast({ title: t('kr_kec84b1ea_keca3bcea_ked9995ec') })
        // Refresh
        const res = await apiClient.getList<CycleOption>('/api/v1/performance/cycles', { page: 1, limit: 100 })
        setCycles(res.data)
      } catch {
        toast({ title: t('confirmed_kec9790_kec8ba4ed'), variant: 'destructive' })
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
          <p className="text-sm text-[#666] mt-1">{t('kr_keca084ec_kec84b1ea_keab2b0ea_')}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedDeptId}
            onChange={(e) => { setSelectedDeptId(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10"
          >
            <option value="">{t('all_department')}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select
            value={selectedCycleId}
            onChange={(e) => { setSelectedCycleId(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10"
          >
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Block distribution */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
        <h2 className="text-base font-semibold text-[#1A1A1A] flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-[#666]" />
          {t('kr_kebb894eb_kebb684ed')}
        </h2>
        <div className="flex items-end gap-2">
          {Object.entries(blockDist).sort().map(([block, count]) => (
            <div key={block} className="flex flex-col items-center">
              <span className="text-sm font-bold text-[#1A1A1A]">{count}</span>
              <div
                className="w-12 bg-[#5E81F4] rounded-t-lg mt-1"
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
              <th className={TABLE_STYLES.headerCell}>{t('kr_keca781ec')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('department')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('grade')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('kr_kec9e90ea_kec84b1ea')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('kr_keba7a4eb_kec84b1ea')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('kr_kecb59cec_kec84b1ea')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('kr_kecb59cec_kec97adeb')}</th>
              <th className={TABLE_STYLES.headerCell}>EMS</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.employee.id} className={TABLE_STYLES.header}>
                <td className="px-4 py-3">
                  <EmployeeCell
                    size="sm"
                    employee={{
                      id: r.employee.id,
                      name: r.employee.name,
                      employeeNo: r.employee.employeeCode,
                      department: r.employee.department?.name,
                      jobGrade: r.employee.jobGrade?.name,
                    }}
                  />
                </td>
                <td className="px-4 py-3 text-sm text-[#555]">{r.employee.department?.name ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-[#555]">{r.employee.jobGrade?.name ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-center text-[#666]">{r.selfEval?.performanceScore?.toFixed(1) ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-center text-[#666]">{r.managerEval.performanceScore?.toFixed(1) ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-center font-medium text-[#1A1A1A]">{r.finalResult.performanceScore?.toFixed(1) ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-center font-medium text-[#1A1A1A]">{r.finalResult.competencyScore?.toFixed(1) ?? '-'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.finalResult.calibrated ? 'bg-[#E0E7FF] text-[#4B6DE0]' : 'bg-[#EDF1FE] text-[#4B6DE0]'}`}>
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
            {t('prev')}
          </button>
          <span className="text-sm text-[#666]">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 border border-[#D4D4D4] rounded-lg text-sm text-[#666] disabled:opacity-50 hover:bg-[#FAFAFA]"
          >
            {t('next')}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#333] hover:bg-[#FAFAFA]">
            <Download className="w-4 h-4" />
            {t('kr_kec9791ec_keb8ba4ec')}
          </button>
          {cycles.find((c) => c.id === selectedCycleId)?.status === 'CALIBRATION' && (
            <button
              onClick={handleFinalize}
              className="flex items-center gap-2 px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-sm font-medium"
            >
              <Lock className="w-4 h-4" />
              {t('kr_kec84b1ea_confirmed')}
            </button>
          )}
        </div>
      </div>
    <ConfirmDialog {...dialogProps} />
    </div>
  </>
  )
}
