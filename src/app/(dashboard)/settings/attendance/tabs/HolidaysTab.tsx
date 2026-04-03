'use client'

// ═══════════════════════════════════════════════════════════
// Tab 5: Holidays — 법정 공휴일 관리
// API: GET /api/v1/holidays (existing)
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Loader2, Plus, Calendar } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { formatDateWithDay } from '@/lib/format/date'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface Holiday {
  id: string
  companyId: string
  name: string
  date: string
  isSubstitute: boolean
  year: number
}

interface HolidaysTabProps {
  companyId: string | null
}

export function HolidaysTab({
  companyId }: HolidaysTabProps) {
  const t = useTranslations('settings')
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('year', String(selectedYear))
    params.set('limit', '100')
    apiClient.get<{ data: Holiday[] }>(`/api/v1/holidays?${params.toString()}`)
      .then((res) => {
        const result = res.data
        const list = (result as unknown as { data: Holiday[] })?.data ?? result ?? []
        setHolidays(Array.isArray(list) ? list : [])
      })
      .catch(() => setHolidays([]))
      .finally(() => setLoading(false))
  }, [companyId, selectedYear])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  // Group by month
  const grouped = holidays.reduce<Record<number, Holiday[]>>((acc, h) => {
    const month = new Date(h.date).getMonth() + 1
    if (!acc[month]) acc[month] = []
    acc[month].push(h)
    return acc
  }, {})

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('kr_kebb295ec_holidays')}</h3>
          <p className="text-sm text-muted-foreground">
            {selectedYear}년 공휴일 {holidays.length}일
            {!companyId && <span className="text-primary"> {t('kr_kebb295ec_kec84a0ed_ked95b4eb_')}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <Button className={BUTTON_VARIANTS.primary}>
            <Plus className="mr-2 h-4 w-4" />
            {t('holidays_add')}
          </Button>
        </div>
      </div>

      {/* Calendar list */}
      {holidays.length > 0 ? (
        <div className="space-y-4">
          {Object.entries(grouped)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([month, items]) => (
              <div key={month}>
                <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{month}월</h4>
                <div className="space-y-1">
                  {items
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((holiday) => (
                      <div
                        key={holiday.id}
                        className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:bg-muted"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">{holiday.name}</div>
                          <div className="text-xs text-muted-foreground">{formatDateWithDay(holiday.date)}</div>
                        </div>
                        {holiday.isSubstitute && (
                          <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-600">
                            {t('kr_keb8c80ec')}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Calendar className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{selectedYear}년 공휴일이 등록되지 않았습니다</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {!companyId
              ? '법인을 선택하면 해당 법인의 공휴일이 표시됩니다'
              : '공휴일을 직접 추가하거나 시드 데이터를 실행하세요'}
          </p>
        </div>
      )}
    </div>
  )
}
