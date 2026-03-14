'use client'

// ═══════════════════════════════════════════════════════════
// Tab 1: Shift Patterns — 교대근무 패턴 관리
// API: GET /api/v1/shift-patterns (existing)
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Loader2, Plus, Clock, Users } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'

interface ShiftSlot {
  name: string
  start: string
  end: string
  breakMin: number
  nightPremium?: number
}

interface ShiftPattern {
  id: string
  companyId: string
  code: string
  name: string
  patternType: string
  slots: ShiftSlot[]
  cycleDays: number
  weeklyHoursLimit: number | null
  description: string | null
  isActive: boolean
  _count?: { shiftGroups: number }
}

interface ShiftPatternsTabProps {
  companyId: string | null
}

export function ShiftPatternsTab({ companyId }: ShiftPatternsTabProps) {
  const [patterns, setPatterns] = useState<ShiftPattern[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', '50')
    // Note: API filters by user.companyId server-side; companyId prop is for future enhancement
    apiClient.get<{ data: ShiftPattern[] }>(`/api/v1/shift-patterns?${params.toString()}`)
      .then((res) => {
        const list = (res.data as unknown as { data: ShiftPattern[] })?.data ?? res.data ?? []
        setPatterns(Array.isArray(list) ? list : [])
      })
      .catch(() => setPatterns([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1C1D21]">교대근무 패턴</h3>
          <p className="text-sm text-[#8181A5]">
            교대 근무 패턴을 생성하고 조별로 배정합니다
          </p>
        </div>
        <Button className={BUTTON_VARIANTS.primary}>
          <Plus className="mr-2 h-4 w-4" />
          새 패턴 추가
        </Button>
      </div>

      {/* Table */}
      {patterns.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
          <table className="w-full">
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>코드</th>
                <th className={TABLE_STYLES.headerCell}>패턴명</th>
                <th className={TABLE_STYLES.headerCell}>유형</th>
                <th className={TABLE_STYLES.headerCell}>교대 수</th>
                <th className={TABLE_STYLES.headerCell}>주기(일)</th>
                <th className={TABLE_STYLES.headerCell}>조 수</th>
                <th className={TABLE_STYLES.headerCell}>상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F3]">
              {patterns.map((pattern) => (
                <tr key={pattern.id} className={TABLE_STYLES.rowClickable}>
                  <td className="px-4 py-3 text-sm font-mono text-[#5E81F4]">{pattern.code}</td>
                  <td className={TABLE_STYLES.cell}>{pattern.name}</td>
                  <td className={TABLE_STYLES.cellMuted}>
                    {pattern.patternType === 'FIXED' ? '고정' : pattern.patternType === 'ROTATING' ? '순환' : pattern.patternType}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-[#1C1D21]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-[#8181A5]" />
                      {Array.isArray(pattern.slots) ? pattern.slots.length : 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-[#1C1D21]">{pattern.cycleDays}일</td>
                  <td className="px-4 py-3 text-center text-sm text-[#1C1D21]">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-[#8181A5]" />
                      {pattern._count?.shiftGroups ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      pattern.isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {pattern.isActive ? '활성' : '비활성'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#F0F0F3] py-12 text-center">
          <Clock className="mx-auto mb-3 h-8 w-8 text-[#8181A5]" />
          <p className="text-sm font-medium text-[#1C1D21]">등록된 교대 패턴이 없습니다</p>
          <p className="mt-1 text-xs text-[#8181A5]">
            교대근무가 필요한 법인에서 패턴을 추가하세요
          </p>
        </div>
      )}
    </div>
  )
}
