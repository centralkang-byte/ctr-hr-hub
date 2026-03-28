'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import { TABLE_STYLES } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────
// Note: AllowanceRecord schema does NOT have isTaxable or startDate/endDate.
// It uses yearMonth (String e.g. "2025-03") for period tracking.

interface CompensationData {
  latestComp: {
    newBaseSalary: number
    currency: string
    effectiveDate: string
    changeType: string
    compaRatio: number | null
  } | null
  salaryBand: {
    minSalary: number
    midSalary: number
    maxSalary: number
    currency: string
  } | null
  allowances: Array<{
    id: string
    allowanceType: string
    amount: number
    currency: string
    yearMonth: string
  }>
  jobGrade: { id: string; name: string } | null
}

interface CompensationTabProps {
  employeeId: string
}

// ─── Helpers ────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

// ─── Allowance type label map ────────────────────────────────

const ALLOWANCE_TYPE_LABELS: Record<string, string> = {
  OVERTIME_ALLOWANCE: '초과근무수당',
  NIGHT_SHIFT: '야간근무수당',
  HOLIDAY_ALLOWANCE: '휴일수당',
  HAZARD: '위험수당',
  POSITION: '직책수당',
  FAMILY: '가족수당',
  MEAL_ALLOWANCE: '식대',
  TRANSPORT_ALLOWANCE: '교통수당',
  OTHER: '기타수당',
}

function getAllowanceLabel(type: string): string {
  return ALLOWANCE_TYPE_LABELS[type] ?? type
}

// ─── Band Position Bar ───────────────────────────────────────

function SalaryBandBar({
  current,
  min,
  mid,
  max,
  currency,
}: {
  current: number
  min: number
  mid: number
  max: number
  currency: string
}) {
  const range = max - min
  const pct = range > 0 ? Math.max(0, Math.min(100, ((current - min) / range) * 100)) : 0

  return (
    <div className="mt-2">
      <div className="relative h-3 rounded-full bg-[#E8E8E8]">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#D1FAE5] via-[#5E81F4] to-[#D1FAE5]" />
        {/* mid marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white/80"
          style={{ left: `${range > 0 ? ((mid - min) / range) * 100 : 50}%` }}
        />
        {/* current position dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-[#1A1A1A] border-2 border-white shadow-md"
          style={{ left: `calc(${pct}% - 10px)` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-[#999]">
        <span>최소 {formatCurrency(min, currency)}</span>
        <span className="text-[#666]">중간 {formatCurrency(mid, currency)}</span>
        <span>최대 {formatCurrency(max, currency)}</span>
      </div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────

export function CompensationTab({ employeeId }: CompensationTabProps) {
  const [data, setData] = useState<CompensationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    apiClient
      .get<CompensationData>(`/api/v1/employees/${employeeId}/compensation`)
      .then((res) => setData(res.data))
      .catch(() => setError('급여 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [employeeId])

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded-lg bg-[#E8E8E8]" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-[#B91C1C] py-4 text-center">{error}</p>
  }

  if (!data?.latestComp) {
    return (
      <div className="flex flex-col items-center py-12 text-[#999]">
        <span className="text-3xl mb-2">💰</span>
        <p className="text-sm">등록된 급여 정보가 없습니다.</p>
      </div>
    )
  }

  const { latestComp, salaryBand, allowances, jobGrade } = data
  const effectiveDateStr = new Date(latestComp.effectiveDate).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
  })

  const totalAllowances = allowances.reduce((sum, a) => sum + a.amount, 0)
  const currency = latestComp.currency

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-[#1A1A1A]">
          급여 정보 ({effectiveDateStr} 기준)
        </h3>
        <span className="text-xs text-[#999] rounded-full bg-[#F5F5F5] px-2.5 py-1">
          HR Admin 전용
        </span>
      </div>

      {/* 급여 테이블 */}
      <div className={TABLE_STYLES.wrapper}>
        <table className={TABLE_STYLES.table}>
          <thead>
            <tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>
                항목
              </th>
              <th className={TABLE_STYLES.headerCellRight}>
                금액
              </th>
              <th className={TABLE_STYLES.headerCell}>
                지급 월
              </th>
            </tr>
          </thead>
          <tbody>
            {/* 기본급 */}
            <tr className={TABLE_STYLES.row}>
              <td className="px-4 py-3 text-sm font-medium text-[#1A1A1A]">기본급</td>
              <td className="px-4 py-3 text-right text-sm font-mono tabular-nums text-[#1A1A1A]">
                {formatCurrency(latestComp.newBaseSalary, currency)}
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-xs text-[#047857] bg-[#D1FAE5] rounded-full px-2 py-0.5">
                  기본
                </span>
              </td>
            </tr>

            {/* 수당 항목 — yearMonth 기반 (isTaxable 없음) */}
            {allowances.map((a) => (
              <tr key={a.id} className="border-t border-[#F5F5F5]">
                <td className="px-4 py-3 text-sm text-[#555]">
                  {getAllowanceLabel(a.allowanceType)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-mono tabular-nums text-[#555]">
                  {formatCurrency(a.amount, a.currency)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-xs text-[#B45309] bg-[#FEF3C7] rounded-full px-2 py-0.5">
                    {a.yearMonth}
                  </span>
                </td>
              </tr>
            ))}

            {/* 합계 */}
            <tr className="border-t-2 border-[#E8E8E8] bg-[#FAFAFA]">
              <td className="px-4 py-3 text-sm font-bold text-[#1A1A1A]">연봉 합계</td>
              <td className="px-4 py-3 text-right text-base font-bold font-mono tabular-nums text-[#1A1A1A]">
                {formatCurrency(latestComp.newBaseSalary + totalAllowances, currency)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* 연봉 밴드 위치 */}
      {salaryBand && (
        <div className="rounded-xl border border-[#E8E8E8] p-5">
          <h4 className="text-sm font-semibold text-[#1A1A1A] mb-1">
            연봉밴드 위치
            {jobGrade && (
              <span className="ml-2 text-[#999] font-normal">({jobGrade.name})</span>
            )}
          </h4>
          <SalaryBandBar
            current={latestComp.newBaseSalary}
            min={salaryBand.minSalary}
            mid={salaryBand.midSalary}
            max={salaryBand.maxSalary}
            currency={salaryBand.currency}
          />
          {latestComp.compaRatio !== null && (
            <p className="mt-3 text-xs text-[#666]">
              Compa-ratio:{' '}
              <span className="font-semibold text-[#1A1A1A]">
                {((latestComp.compaRatio as number) * 100).toFixed(1)}%
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
