'use client'

import { formatCurrency } from '@/lib/compensation'
import type { PayrollItemDetail } from '@/lib/payroll/types'

interface PayStubBreakdownProps {
  detail: PayrollItemDetail
}

export default function PayStubBreakdown({ detail }: PayStubBreakdownProps) {
  const { earnings, deductions, overtime, grossPay, totalDeductions, netPay } = detail

  // 비율 바 계산
  const netRatio = grossPay > 0 ? (netPay / grossPay) * 100 : 0
  const deductionRatio = 100 - netRatio

  const earningItems = [
    { label: '기본급', value: earnings.baseSalary },
    { label: '고정초과근무수당', value: earnings.fixedOvertimeAllowance },
    { label: '식비', value: earnings.mealAllowance },
    { label: '교통비', value: earnings.transportAllowance },
    { label: '연장근무수당', value: earnings.overtimePay },
    { label: '야간근무수당', value: earnings.nightShiftPay },
    { label: '휴일근무수당', value: earnings.holidayPay },
    { label: '상여금', value: earnings.bonuses },
    { label: '기타수당', value: earnings.otherEarnings },
  ].filter((i) => i.value > 0)

  const deductionItems = [
    { label: '국민연금', value: deductions.nationalPension },
    { label: '건강보험', value: deductions.healthInsurance },
    { label: '장기요양보험', value: deductions.longTermCare },
    { label: '고용보험', value: deductions.employmentInsurance },
    { label: '소득세', value: deductions.incomeTax },
    { label: '지방소득세', value: deductions.localIncomeTax },
    { label: '기타공제', value: deductions.otherDeductions },
  ].filter((i) => i.value > 0)

  return (
    <div className="space-y-6">
      {/* 실수령/공제 비율 바 */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>실수령 {netRatio.toFixed(1)}%</span>
          <span>공제 {deductionRatio.toFixed(1)}%</span>
        </div>
        <div className="h-3 rounded-full bg-slate-200 overflow-hidden flex">
          <div
            className="bg-blue-500 transition-all"
            style={{ width: `${netRatio}%` }}
          />
          <div
            className="bg-slate-400 transition-all"
            style={{ width: `${deductionRatio}%` }}
          />
        </div>
      </div>

      {/* 실수령액 */}
      <div className="text-center py-4 bg-blue-50 rounded-xl">
        <p className="text-xs text-blue-600 mb-1">실수령액</p>
        <p className="text-3xl font-bold text-blue-700">{formatCurrency(netPay)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 지급항목 */}
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-200">
            지급항목
          </h4>
          <div className="space-y-2">
            {earningItems.map((item) => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-slate-600">{item.label}</span>
                <span className="font-medium text-slate-900">{formatCurrency(item.value)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-200">
              <span className="text-slate-700">총 지급액</span>
              <span className="text-emerald-600">{formatCurrency(grossPay)}</span>
            </div>
          </div>
        </div>

        {/* 공제항목 */}
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-200">
            공제항목
          </h4>
          <div className="space-y-2">
            {deductionItems.map((item) => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-slate-600">{item.label}</span>
                <span className="font-medium text-red-600">-{formatCurrency(item.value)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-200">
              <span className="text-slate-700">총 공제액</span>
              <span className="text-red-600">-{formatCurrency(totalDeductions)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 초과근무 상세 */}
      {overtime.totalOvertimeHours > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-200">
            초과근무 상세
          </h4>
          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">통상시급</span>
              <span className="font-medium">{formatCurrency(overtime.hourlyWage)}</span>
            </div>
            {overtime.weekdayOTHours > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">평일 연장 (×1.5)</span>
                <span className="font-medium">{overtime.weekdayOTHours}시간</span>
              </div>
            )}
            {overtime.weekendHours > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">휴일근로 (×1.5)</span>
                <span className="font-medium">{overtime.weekendHours}시간</span>
              </div>
            )}
            {overtime.holidayHours > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">공휴일근로 (×2.0)</span>
                <span className="font-medium">{overtime.holidayHours}시간</span>
              </div>
            )}
            {overtime.nightHours > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">야간근로 (×0.5)</span>
                <span className="font-medium">{overtime.nightHours}시간</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-300">
              <span>합계</span>
              <span>{overtime.totalOvertimeHours}시간</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
