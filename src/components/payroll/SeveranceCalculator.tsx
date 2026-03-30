'use client'

import { useState } from 'react'
import { Calculator, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiClient } from '@/lib/api'
import { formatCurrency } from '@/lib/compensation'
import type { SeveranceDetail } from '@/lib/payroll/types'
import { BUTTON_VARIANTS, TABLE_STYLES } from '@/lib/styles'

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
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
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
              <p className={`font-medium ${result.isEligible ? 'text-emerald-600' : 'text-destructive'}`}>
                {result.isEligible ? '해당' : '비해당 (1년 미만)'}
              </p>
            </div>
          </div>

          {/* 3개월 평균임금 테이블 */}
          {result.recentThreeMonths.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#666] mb-2">최근 3개월 급여</p>
              <table className={TABLE_STYLES.table}>
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    <th className={TABLE_STYLES.headerCell}>월</th>
                    <th className={TABLE_STYLES.headerCellRight}>기본급</th>
                    <th className={TABLE_STYLES.headerCellRight}>초과근무</th>
                    <th className={TABLE_STYLES.headerCellRight}>수당</th>
                    <th className={TABLE_STYLES.headerCellRight}>합계</th>
                  </tr>
                </thead>
                <tbody>
                  {result.recentThreeMonths.map((m) => (
                    <tr key={m.yearMonth} className={TABLE_STYLES.row}>
                      <td className="px-3 py-2">{m.yearMonth}</td>
                      <td className="text-right px-3 py-2">{formatCurrency(m.baseSalary)}</td>
                      <td className="text-right px-3 py-2">{formatCurrency(m.overtimePay)}</td>
                      <td className="text-right px-3 py-2">{formatCurrency(m.allowances)}</td>
                      <td className="text-right px-3 py-2 font-medium">{formatCurrency(m.totalPay)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-background font-semibold">
                    <td className="px-3 py-2" colSpan={4}>3개월 평균임금</td>
                    <td className="text-right px-3 py-2">{formatCurrency(result.averageMonthlyPay)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* 퇴직금 결과 */}
          {result.isEligible && (
            <div className="bg-primary/10 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#555]">퇴직금</span>
                <span className="font-medium">{formatCurrency(result.severancePay)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#555]">퇴직소득세</span>
                <span className="text-destructive">-{formatCurrency(result.incomeTax)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#555]">지방소득세</span>
                <span className="text-destructive">-{formatCurrency(result.localIncomeTax)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-primary/20">
                <span className="text-primary/90">실지급액</span>
                <span className="text-primary/90">{formatCurrency(result.netSeverancePay)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
