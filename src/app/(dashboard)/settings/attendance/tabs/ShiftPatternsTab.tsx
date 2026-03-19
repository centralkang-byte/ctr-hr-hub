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
import { useTranslations } from 'next-intl'

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

export function ShiftPatternsTab({
  companyId }: ShiftPatternsTabProps) {
  const t = useTranslations('settings')
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
          <h3 className="text-base font-semibold text-[#1C1D21]">{t('shiftWork_ked8ca8ed')}</h3>
          <p className="text-sm text-[#8181A5]">
            {t('kr_keab590eb_keab7bceb_ked8ca8ed_')}
          </p>
        </div>
        <Button className={BUTTON_VARIANTS.primary}>
          <Plus className="mr-2 h-4 w-4" />
          {t('kr_kec8388_ked8ca8ed_add')}
        </Button>
      </div>

      {/* Table */}
      {patterns.length > 0 ? (
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>{t('kr_kecbd94eb')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_ked8ca8ed')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_kec9ca0ed')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_keab590eb_kec8898')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_keca3bcea_kec9dbc')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_keca1b0_kec8898')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('status')}</th>
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
          <p className="text-sm font-medium text-[#1C1D21]">{t('register_keb909c_keab590eb_ked8ca8ed_kec9786ec')}</p>
          <p className="mt-1 text-xs text-[#8181A5]">
            {t('shiftWork_keab080_ked9584ec_kebb295ec_ked8ca8ed_kecb694ea')}
          </p>
        </div>
      )}
    </div>
  )
}
