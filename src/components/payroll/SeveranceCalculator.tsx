'use client'

import { useState } from 'react'
import { Calculator, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiClient } from '@/lib/api'
import { formatCurrency } from '@/lib/compensation'
import type { SeveranceDetail } from '@/lib/payroll/types'
import { BUTTON_VARIANTS } from '@/lib/styles'

interface SeveranceCalculatorProps {
  employeeId: string
  employeeName?: string
}

export default function SeveranceCalculator({
  employeeId,
  employeeName,
}: SeveranceCalculatorProps) {
  const [result, setResult] = useState<SeveranceDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const dateStr = form.get('terminationDate') as string

    try {
      const res = await apiClient.post<SeveranceDetail>(
        `/api/v1/payroll/severance/${employeeId}`,
        { terminationDate: new Date(dateStr).toISOString() },
      )
      setResult(res.data)
    } catch {
      // error handled
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="h-5 w-5 text-[#4F46E5]" />
        <h3 className="text-sm font-semibold text-[#1A1A1A]">
          퇴직금 계산{employeeName ? ` — ${employeeName}` : ''}
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-3 mb-4">
        <div className="flex-1">
          <Label htmlFor="terminationDate">퇴직 예정일</Label>
          <Input id="terminationDate" name="terminationDate" type="date" required />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className={BUTTON_VARIANTS.primary}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '계산'}
        </Button>
      </form>

      {result && (
        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[#666]">입사일</p>
              <p className="font-medium">{result.hireDate.split('T')[0]}</p>
            </div>
            <div>
              <p className="text-[#666]">퇴직일</p>
              <p className="font-medium">{result.terminationDate.split('T')[0]}</p>
            </div>
            <div>
              <p className="text-[#666]">재직일수</p>
              <p className="font-medium">{result.tenureDays}일 ({result.tenureYears}년)</p>
            </div>
            <div>
              <p className="text-[#666]">퇴직금 대상</p>
              <p className={`font-medium ${result.isEligible ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                {result.isEligible ? '해당' : '비해당 (1년 미만)'}
              </p>
            </div>
          </div>

          {/* 3개월 평균임금 테이블 */}
          {result.recentThreeMonths.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#666] mb-2">최근 3개월 급여</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FAFAFA] text-xs text-[#666]">
                    <th className="text-left px-3 py-2">월</th>
                    <th className="text-right px-3 py-2">기본급</th>
                    <th className="text-right px-3 py-2">초과근무</th>
                    <th className="text-right px-3 py-2">수당</th>
                    <th className="text-right px-3 py-2">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {result.recentThreeMonths.map((m) => (
                    <tr key={m.yearMonth} className="border-b border-[#F5F5F5]">
                      <td className="px-3 py-2">{m.yearMonth}</td>
                      <td className="text-right px-3 py-2">{formatCurrency(m.baseSalary)}</td>
                      <td className="text-right px-3 py-2">{formatCurrency(m.overtimePay)}</td>
                      <td className="text-right px-3 py-2">{formatCurrency(m.allowances)}</td>
                      <td className="text-right px-3 py-2 font-medium">{formatCurrency(m.totalPay)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#FAFAFA] font-semibold">
                    <td className="px-3 py-2" colSpan={4}>3개월 평균임금</td>
                    <td className="text-right px-3 py-2">{formatCurrency(result.averageMonthlyPay)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* 퇴직금 결과 */}
          {result.isEligible && (
            <div className="bg-[#EEF2FF] rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#555]">퇴직금</span>
                <span className="font-medium">{formatCurrency(result.severancePay)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#555]">퇴직소득세</span>
                <span className="text-[#DC2626]">-{formatCurrency(result.incomeTax)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#555]">지방소득세</span>
                <span className="text-[#DC2626]">-{formatCurrency(result.localIncomeTax)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#EEF2FF]">
                <span className="text-[#4338CA]">실지급액</span>
                <span className="text-[#4338CA]">{formatCurrency(result.netSeverancePay)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
