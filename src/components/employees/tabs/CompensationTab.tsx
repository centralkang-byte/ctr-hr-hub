'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiClient } from '@/lib/api'
import { TABLE_STYLES } from '@/lib/styles'
import PayBandChart from '@/components/compensation/PayBandChart'

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
  OVERTIME_ALLOWANCE: 'allowanceOvertime',
  NIGHT_SHIFT: 'allowanceNightShift',
  HOLIDAY_ALLOWANCE: 'allowanceHoliday',
  HAZARD: 'allowanceHazard',
  POSITION: 'allowancePosition',
  FAMILY: 'allowanceFamily',
  MEAL_ALLOWANCE: 'allowanceMeal',
  TRANSPORT_ALLOWANCE: 'allowanceTransport',
  OTHER: 'allowanceOther',
}

function getAllowanceLabel(type: string, t: (key: string) => string): string {
  return ALLOWANCE_TYPE_LABELS[type] ? t(ALLOWANCE_TYPE_LABELS[type]) : type
}

// ─── Component ──────────────────────────────────────────────

export function CompensationTab({ employeeId }: CompensationTabProps) {
  const t = useTranslations('employee')
  const [data, setData] = useState<CompensationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    apiClient
      .get<CompensationData>(`/api/v1/employees/${employeeId}/compensation`)
      .then((res) => setData(res.data))
      .catch(() => setError(t('compensationLoadError')))
      .finally(() => setLoading(false))
  }, [employeeId, t])

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded-lg bg-border" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive py-4 text-center">{error}</p>
  }

  if (!data?.latestComp) {
    return (
      <div className="flex flex-col items-center py-12 text-muted-foreground">
        <span className="text-3xl mb-2">💰</span>
        <p className="text-sm">{t('compensationNoData')}</p>
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
        <h3 className="text-base font-bold text-foreground">
          {t('compensationInfoAsOf', { date: effectiveDateStr })}
        </h3>
        <span className="text-xs text-muted-foreground rounded-full bg-muted px-2.5 py-1">
          {t('compensationHrOnly')}
        </span>
      </div>

      {/* 급여 테이블 */}
      <div className={TABLE_STYLES.wrapper}>
        <table className={TABLE_STYLES.table}>
          <thead>
            <tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>
                {t('compensationItem')}
              </th>
              <th className={TABLE_STYLES.headerCellRight}>
                {t('compensationAmount')}
              </th>
              <th className={TABLE_STYLES.headerCell}>
                {t('compensationPayMonth')}
              </th>
            </tr>
          </thead>
          <tbody>
            {/* 기본급 */}
            <tr className={TABLE_STYLES.row}>
              <td className="px-4 py-3 text-sm font-medium text-foreground">{t('compensationBaseSalary')}</td>
              <td className="px-4 py-3 text-right text-sm font-mono tabular-nums text-foreground">
                {formatCurrency(latestComp.newBaseSalary, currency)}
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-xs text-emerald-700 bg-emerald-500/15 rounded-full px-2 py-0.5">
                  {t('compensationBaseLabel')}
                </span>
              </td>
            </tr>

            {/* 수당 항목 — yearMonth 기반 (isTaxable 없음) */}
            {allowances.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {getAllowanceLabel(a.allowanceType, t)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-mono tabular-nums text-muted-foreground">
                  {formatCurrency(a.amount, a.currency)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-xs text-amber-700 bg-amber-500/15 rounded-full px-2 py-0.5">
                    {a.yearMonth}
                  </span>
                </td>
              </tr>
            ))}

            {/* 합계 */}
            <tr className="border-t-2 border-border bg-background">
              <td className="px-4 py-3 text-sm font-bold text-foreground">{t('compensationAnnualTotal')}</td>
              <td className="px-4 py-3 text-right text-base font-bold font-mono tabular-nums text-foreground">
                {formatCurrency(latestComp.newBaseSalary + totalAllowances, currency)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* 연봉 밴드 위치 */}
      {salaryBand && (
        <div className="rounded-xl border border-border p-5">
          <h4 className="text-sm font-semibold text-foreground mb-1">
            {t('compensationBandPosition')}
            {jobGrade && (
              <span className="ml-2 text-muted-foreground font-normal">({jobGrade.name})</span>
            )}
          </h4>
          <PayBandChart
            currentSalary={latestComp.newBaseSalary}
            minSalary={salaryBand.minSalary}
            midSalary={salaryBand.midSalary}
            maxSalary={salaryBand.maxSalary}
          />
          {latestComp.compaRatio !== null && (
            <p className="mt-3 text-xs text-muted-foreground">
              Compa-ratio:{' '}
              <span className="font-semibold text-foreground">
                {((latestComp.compaRatio as number) * 100).toFixed(1)}%
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
