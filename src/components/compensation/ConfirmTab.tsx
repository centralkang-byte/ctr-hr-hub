'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatCurrency, calculateBudgetSummary } from '@/lib/compensation'
import { apiClient } from '@/lib/api'

interface ConfirmTabProps {
  cycleId: string
  adjustments: Array<{
    employeeId: string
    employeeName: string
    department: string
    currentSalary: number
    newSalary: number
    changePct: number
  }>
  onConfirmDone: () => void
}

export default function ConfirmTab({ cycleId, adjustments, onConfirmDone }: ConfirmTabProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().split('T')[0],
  )

  const budget = calculateBudgetSummary(
    adjustments.map((a) => ({ currentSalary: a.currentSalary, newSalary: a.newSalary })),
  )

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      await apiClient.post('/api/v1/compensation/confirm', {
        cycleId,
        effectiveDate: new Date(effectiveDate).toISOString(),
        adjustments: adjustments.map((a) => ({
          employeeId: a.employeeId,
          newBaseSalary: a.newSalary,
          changePct: a.changePct,
          changeType: 'ANNUAL_INCREASE',
        })),
      })
      setShowConfirm(false)
      onConfirmDone()
    } catch {
      // ignore
    } finally {
      setConfirming(false)
    }
  }

  if (adjustments.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-slate-300 mb-4" />
        <p className="text-slate-500 text-sm">
          시뮬레이션 탭에서 연봉 조정을 진행한 후 확정해주세요.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ─── 요약 ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs text-slate-500 mb-1">확정 인원</p>
          <p className="text-3xl font-bold text-slate-900">{budget.headcount}명</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs text-slate-500 mb-1">총 인상액</p>
          <p className="text-xl font-bold text-emerald-600">
            +{formatCurrency(budget.totalIncrease)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs text-slate-500 mb-1">평균 인상률</p>
          <p className="text-3xl font-bold text-blue-600">{budget.avgIncreasePct}%</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs text-slate-500 mb-1">적용일</p>
          <input
            type="date"
            className="w-full px-2 py-1 border border-slate-300 rounded text-sm mt-1 focus:ring-2 focus:ring-blue-500"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>
      </div>

      {/* ─── 조정 목록 ─── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium">직원명</th>
              <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium">부서</th>
              <th className="px-4 py-3 text-right text-xs text-slate-500 font-medium">현재 연봉</th>
              <th className="px-4 py-3 text-right text-xs text-slate-500 font-medium">인상률</th>
              <th className="px-4 py-3 text-right text-xs text-slate-500 font-medium">신규 연봉</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.map((a) => (
              <tr key={a.employeeId} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium">{a.employeeName}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{a.department}</td>
                <td className="px-4 py-3 text-sm text-right">
                  {formatCurrency(a.currentSalary)}
                </td>
                <td className="px-4 py-3 text-sm text-right text-blue-600 font-medium">
                  +{a.changePct}%
                </td>
                <td className="px-4 py-3 text-sm text-right font-semibold">
                  {formatCurrency(a.newSalary)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── 확정 버튼 ─── */}
      <div className="flex justify-end">
        <Button
          onClick={() => setShowConfirm(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium text-sm"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          연봉 조정 확정
        </Button>
      </div>

      {/* ─── 확인 다이얼로그 ─── */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>연봉 조정 확정</AlertDialogTitle>
            <AlertDialogDescription>
              총 {budget.headcount}명의 연봉이 조정됩니다.
              <br />
              적용일: {effectiveDate}
              <br />
              <br />이 작업은 되돌릴 수 없습니다. 진행하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={confirming}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {confirming ? '처리 중...' : '확정'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
