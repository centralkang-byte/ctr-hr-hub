'use client'

import { useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/compensation'
import { TYPOGRAPHY } from '@/lib/styles'
import { cn } from '@/lib/utils'
import type { PayrollItemDetail } from '@/lib/payroll/types'

interface PayStubBreakdownProps {
  detail: PayrollItemDetail
}

// ─── Module-scope earning/deduction field configs ───
const EARNING_FIELDS = [
  { labelKey: 'basePay', field: 'baseSalary' },
  { labelKey: 'stub.fixedOT', field: 'fixedOvertimeAllowance' },
  { labelKey: 'stub.mealAllowance', field: 'mealAllowance' },
  { labelKey: 'stub.transportAllowance', field: 'transportAllowance' },
  { labelKey: 'overtimePay', field: 'overtimePay' },
  { labelKey: 'stub.nightShiftPay', field: 'nightShiftPay' },
  { labelKey: 'stub.holidayPay', field: 'holidayPay' },
  { labelKey: 'bonusPay', field: 'bonuses' },
  { labelKey: 'stub.otherEarnings', field: 'otherEarnings' },
] as const

const DEDUCTION_FIELDS = [
  { labelKey: 'nationalPension', field: 'nationalPension' },
  { labelKey: 'healthInsurance', field: 'healthInsurance' },
  { labelKey: 'stub.longTermCare', field: 'longTermCare' },
  { labelKey: 'employmentInsurance', field: 'employmentInsurance' },
  { labelKey: 'incomeTax', field: 'incomeTax' },
  { labelKey: 'localTax', field: 'localIncomeTax' },
  { labelKey: 'stub.otherDeductions', field: 'otherDeductions' },
] as const

// ─── Change Indicator ───
function ChangeIndicator({ current, previous }: { current: number; previous?: number }) {
  if (previous == null || previous === 0) return null
  const diff = current - previous
  if (diff === 0) return <Minus className="h-3 w-3 text-muted-foreground inline" />
  const pct = ((diff / previous) * 100).toFixed(1)
  if (diff > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] text-[#006b39] font-medium ml-1 tabular-nums">
        <ArrowUp className="h-3 w-3" />
        {pct}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] text-destructive font-medium ml-1 tabular-nums">
      <ArrowDown className="h-3 w-3" />
      {Math.abs(Number(pct))}%
    </span>
  )
}

export default function PayStubBreakdown({ detail }: PayStubBreakdownProps) {
  const t = useTranslations('payroll')
  const {
    earnings, deductions, overtime, grossPay, totalDeductions, netPay,
    customAllowances, customDeductions, previousMonth,
  } = detail

  const prevEarnings = previousMonth?.earnings
  const prevDeductions = previousMonth?.deductions

  // 비율 바 계산
  const netRatio = grossPay > 0 ? (netPay / grossPay) * 100 : 0
  const deductionRatio = 100 - netRatio

  const earningItems = EARNING_FIELDS
    .map((f) => ({
      labelKey: f.labelKey,
      value: (earnings as unknown as Record<string, number>)[f.field] ?? 0,
      prev: prevEarnings ? (prevEarnings as unknown as Record<string, number>)[f.field] : undefined,
    }))
    .filter((i) => i.value > 0)

  const deductionItems = DEDUCTION_FIELDS
    .map((f) => ({
      labelKey: f.labelKey,
      value: (deductions as unknown as Record<string, number>)[f.field] ?? 0,
      prev: prevDeductions ? (prevDeductions as unknown as Record<string, number>)[f.field] : undefined,
    }))
    .filter((i) => i.value > 0)

  return (
    <div className="space-y-6">
      {/* 실수령/공제 비율 바 */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{t('stub.netPayRatio', { pct: netRatio.toFixed(1) })}</span>
          <span>{t('stub.deductionRatio', { pct: deductionRatio.toFixed(1) })}</span>
        </div>
        <div className="h-3 rounded-full bg-border overflow-hidden flex">
          <div
            className="bg-primary transition-all"
            style={{ width: `${netRatio}%` }}
          />
          <div
            className="bg-border-strong transition-all"
            style={{ width: `${deductionRatio}%` }}
          />
        </div>
      </div>

      {/* 실수령액 + 전월비교 — KPI 대형 수치: Pretendard 500 + tabular-nums (mono 아님, rules/design.md) */}
      <div className="text-center py-4 bg-primary/10 rounded-xl">
        <p className="text-xs text-primary mb-1">{t('netPay')}</p>
        <p className="text-3xl font-medium tabular-nums tracking-[-0.02em] text-primary">
          {formatCurrency(netPay)}
          <ChangeIndicator current={netPay} previous={previousMonth?.netPay} />
        </p>
        {previousMonth && (
          <p className="text-xs text-muted-foreground mt-1">
            {t('stub.previousMonth', { amount: formatCurrency(previousMonth.netPay) })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 지급항목 */}
        <div>
          <h4 className={cn(TYPOGRAPHY.cardTitle, 'mb-3 pb-2 border-b border-border')}>
            {t('stub.earnings')}
          </h4>
          <div className="space-y-2">
            {earningItems.map((item) => (
              <div key={item.labelKey} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t(item.labelKey)}</span>
                <span className="font-medium font-mono tabular-nums text-foreground">
                  {formatCurrency(item.value)}
                  <ChangeIndicator current={item.value} previous={item.prev} />
                </span>
              </div>
            ))}

            {/* 사용자 정의 수당 */}
            {customAllowances && customAllowances.length > 0 && (
              <>
                <div className="border-t border-dashed border-border pt-2 mt-2">
                  <p className="text-xs text-muted-foreground mb-1.5">{t('stub.customAllowance')}</p>
                </div>
                {customAllowances.map((item) => (
                  <div key={item.code} className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      {item.name}
                      {item.isTaxExempt && (
                        <Badge variant="success">{t('stub.taxExempt')}</Badge>
                      )}
                    </span>
                    <span className="font-medium font-mono tabular-nums text-foreground">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </>
            )}

            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-border">
              <span className="text-foreground">{t('grossPay')}</span>
              <span className="font-mono tabular-nums text-[#006b39]">
                {formatCurrency(grossPay)}
                <ChangeIndicator current={grossPay} previous={previousMonth?.grossPay} />
              </span>
            </div>
          </div>
        </div>

        {/* 공제항목 */}
        <div>
          <h4 className={cn(TYPOGRAPHY.cardTitle, 'mb-3 pb-2 border-b border-border')}>
            {t('stub.deductions')}
          </h4>
          <div className="space-y-2">
            {deductionItems.map((item) => (
              <div key={item.labelKey} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t(item.labelKey)}</span>
                <span className="font-medium font-mono tabular-nums text-destructive">
                  -{formatCurrency(item.value)}
                </span>
              </div>
            ))}

            {/* 사용자 정의 공제 */}
            {customDeductions && customDeductions.length > 0 && (
              <>
                <div className="border-t border-dashed border-border pt-2 mt-2">
                  <p className="text-xs text-muted-foreground mb-1.5">{t('stub.customDeduction')}</p>
                </div>
                {customDeductions.map((item) => (
                  <div key={item.code} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.name}
                      <span className="text-[11px] text-muted-foreground ml-1">
                        ({item.category === 'STATUTORY' ? t('stub.statutory') : t('stub.voluntary')})
                      </span>
                    </span>
                    <span className="font-medium font-mono tabular-nums text-destructive">
                      -{formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </>
            )}

            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-border">
              <span className="text-foreground">{t('deductions')}</span>
              <span className="font-mono tabular-nums text-destructive">
                -{formatCurrency(totalDeductions)}
                <ChangeIndicator current={totalDeductions} previous={previousMonth?.totalDeductions} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 초과근무 상세 */}
      {overtime.totalOvertimeHours > 0 && (
        <div>
          <h4 className={cn(TYPOGRAPHY.cardTitle, 'mb-3 pb-2 border-b border-border')}>
            {t('stub.overtimeDetail')}
          </h4>
          <div className="bg-background rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('stub.hourlyWage')}</span>
              <span className="font-medium font-mono tabular-nums">{formatCurrency(overtime.hourlyWage)}</span>
            </div>
            {overtime.weekdayOTHours > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('stub.weekdayOT')}</span>
                <span className="font-medium">{t('format.hours', { n: overtime.weekdayOTHours })}</span>
              </div>
            )}
            {overtime.weekendHours > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('stub.weekendWork')}</span>
                <span className="font-medium">{t('format.hours', { n: overtime.weekendHours })}</span>
              </div>
            )}
            {overtime.holidayHours > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('stub.holidayWork')}</span>
                <span className="font-medium">{t('format.hours', { n: overtime.holidayHours })}</span>
              </div>
            )}
            {overtime.nightHours > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('stub.nightWork')}</span>
                <span className="font-medium">{t('format.hours', { n: overtime.nightHours })}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-border">
              <span>{t('stub.totalHours')}</span>
              <span>{t('format.hours', { n: overtime.totalOvertimeHours })}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
