'use client'

import { formatCurrency } from '@/lib/compensation'
import type { PayrollItemDetail } from '@/lib/payroll/types'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'

interface PayStubBreakdownProps {
  detail: PayrollItemDetail
}

// ─── Change Indicator ───
function ChangeIndicator({ current, previous }: { current: number; previous?: number }) {
  if (previous == null || previous === 0) return null
  const diff = current - previous
  if (diff === 0) return <Minus className="h-3 w-3 text-[#999] inline" />
  const pct = ((diff / previous) * 100).toFixed(1)
  if (diff > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-[#059669] font-medium ml-1">
        <ArrowUp className="h-3 w-3" />
        {pct}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-[#EF4444] font-medium ml-1">
      <ArrowDown className="h-3 w-3" />
      {Math.abs(Number(pct))}%
    </span>
  )
}

export default function PayStubBreakdown({ detail }: PayStubBreakdownProps) {
  const {
    earnings, deductions, overtime, grossPay, totalDeductions, netPay,
    customAllowances, customDeductions, previousMonth,
  } = detail

  const prevEarnings = previousMonth?.earnings
  const prevDeductions = previousMonth?.deductions

  // 비율 바 계산
  const netRatio = grossPay > 0 ? (netPay / grossPay) * 100 : 0
  const deductionRatio = 100 - netRatio

  const earningItems = [
    { label: '기본급', value: earnings.baseSalary, prev: prevEarnings?.baseSalary },
    { label: '고정초과근무수당', value: earnings.fixedOvertimeAllowance, prev: prevEarnings?.fixedOvertimeAllowance },
    { label: '식비', value: earnings.mealAllowance, prev: prevEarnings?.mealAllowance },
    { label: '교통비', value: earnings.transportAllowance, prev: prevEarnings?.transportAllowance },
    { label: '연장근무수당', value: earnings.overtimePay, prev: prevEarnings?.overtimePay },
    { label: '야간근무수당', value: earnings.nightShiftPay, prev: prevEarnings?.nightShiftPay },
    { label: '휴일근무수당', value: earnings.holidayPay, prev: prevEarnings?.holidayPay },
    { label: '상여금', value: earnings.bonuses, prev: prevEarnings?.bonuses },
    { label: '기타수당', value: earnings.otherEarnings, prev: prevEarnings?.otherEarnings },
  ].filter((i) => i.value > 0)

  const deductionItems = [
    { label: '국민연금', value: deductions.nationalPension, prev: prevDeductions?.nationalPension },
    { label: '건강보험', value: deductions.healthInsurance, prev: prevDeductions?.healthInsurance },
    { label: '장기요양보험', value: deductions.longTermCare, prev: prevDeductions?.longTermCare },
    { label: '고용보험', value: deductions.employmentInsurance, prev: prevDeductions?.employmentInsurance },
    { label: '소득세', value: deductions.incomeTax, prev: prevDeductions?.incomeTax },
    { label: '지방소득세', value: deductions.localIncomeTax, prev: prevDeductions?.localIncomeTax },
    { label: '기타공제', value: deductions.otherDeductions, prev: prevDeductions?.otherDeductions },
  ].filter((i) => i.value > 0)

  return (
    <div className="space-y-6">
      {/* 실수령/공제 비율 바 */}
      <div>
        <div className="flex justify-between text-xs text-[#666] mb-1">
          <span>실수령 {netRatio.toFixed(1)}%</span>
          <span>공제 {deductionRatio.toFixed(1)}%</span>
        </div>
        <div className="h-3 rounded-full bg-[#E8E8E8] overflow-hidden flex">
          <div
            className="bg-[#5E81F4] transition-all"
            style={{ width: `${netRatio}%` }}
          />
          <div
            className="bg-[#999] transition-all"
            style={{ width: `${deductionRatio}%` }}
          />
        </div>
      </div>

      {/* 실수령액 + 전월비교 */}
      <div className="text-center py-4 bg-[#EDF1FE] rounded-xl">
        <p className="text-xs text-[#5E81F4] mb-1">실수령액</p>
        <p className="text-3xl font-bold text-[#4B6DE0]">
          {formatCurrency(netPay)}
          <ChangeIndicator current={netPay} previous={previousMonth?.netPay} />
        </p>
        {previousMonth && (
          <p className="text-xs text-[#666] mt-1">
            전월 {formatCurrency(previousMonth.netPay)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 지급항목 */}
        <div>
          <h4 className="text-sm font-semibold text-[#1A1A1A] mb-3 pb-2 border-b border-[#E8E8E8]">
            지급항목
          </h4>
          <div className="space-y-2">
            {earningItems.map((item) => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-[#555]">{item.label}</span>
                <span className="font-medium text-[#1A1A1A]">
                  {formatCurrency(item.value)}
                  <ChangeIndicator current={item.value} previous={item.prev} />
                </span>
              </div>
            ))}

            {/* 사용자 정의 수당 */}
            {customAllowances && customAllowances.length > 0 && (
              <>
                <div className="border-t border-dashed border-[#E8E8E8] pt-2 mt-2">
                  <p className="text-xs text-[#999] mb-1.5">추가 수당</p>
                </div>
                {customAllowances.map((item) => (
                  <div key={item.code} className="flex justify-between text-sm">
                    <span className="text-[#555] flex items-center gap-1">
                      {item.name}
                      {item.isTaxExempt && (
                        <span className="inline-flex items-center px-1 py-0 rounded text-[10px] bg-[#D1FAE5] text-[#059669] border border-[#A7F3D0]">
                          비과세
                        </span>
                      )}
                    </span>
                    <span className="font-medium text-[#1A1A1A]">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </>
            )}

            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-[#E8E8E8]">
              <span className="text-[#333]">총 지급액</span>
              <span className="text-[#059669]">
                {formatCurrency(grossPay)}
                <ChangeIndicator current={grossPay} previous={previousMonth?.grossPay} />
              </span>
            </div>
          </div>
        </div>

        {/* 공제항목 */}
        <div>
          <h4 className="text-sm font-semibold text-[#1A1A1A] mb-3 pb-2 border-b border-[#E8E8E8]">
            공제항목
          </h4>
          <div className="space-y-2">
            {deductionItems.map((item) => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-[#555]">{item.label}</span>
                <span className="font-medium text-[#DC2626]">
                  -{formatCurrency(item.value)}
                </span>
              </div>
            ))}

            {/* 사용자 정의 공제 */}
            {customDeductions && customDeductions.length > 0 && (
              <>
                <div className="border-t border-dashed border-[#E8E8E8] pt-2 mt-2">
                  <p className="text-xs text-[#999] mb-1.5">추가 공제</p>
                </div>
                {customDeductions.map((item) => (
                  <div key={item.code} className="flex justify-between text-sm">
                    <span className="text-[#555]">
                      {item.name}
                      <span className="text-[10px] text-[#999] ml-1">
                        ({item.category === 'STATUTORY' ? '법정' : '선택'})
                      </span>
                    </span>
                    <span className="font-medium text-[#DC2626]">
                      -{formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </>
            )}

            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-[#E8E8E8]">
              <span className="text-[#333]">총 공제액</span>
              <span className="text-[#DC2626]">
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
          <h4 className="text-sm font-semibold text-[#1A1A1A] mb-3 pb-2 border-b border-[#E8E8E8]">
            초과근무 상세
          </h4>
          <div className="bg-[#FAFAFA] rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#555]">통상시급</span>
              <span className="font-medium">{formatCurrency(overtime.hourlyWage)}</span>
            </div>
            {overtime.weekdayOTHours > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#555]">평일 연장 (×1.5)</span>
                <span className="font-medium">{overtime.weekdayOTHours}시간</span>
              </div>
            )}
            {overtime.weekendHours > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#555]">휴일근로 (×1.5)</span>
                <span className="font-medium">{overtime.weekendHours}시간</span>
              </div>
            )}
            {overtime.holidayHours > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#555]">공휴일근로 (×2.0)</span>
                <span className="font-medium">{overtime.holidayHours}시간</span>
              </div>
            )}
            {overtime.nightHours > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#555]">야간근로 (×0.5)</span>
                <span className="font-medium">{overtime.nightHours}시간</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-[#D4D4D4]">
              <span>합계</span>
              <span>{overtime.totalOvertimeHours}시간</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
