'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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
import { toast } from '@/hooks/use-toast'
import { TABLE_STYLES } from '@/lib/styles'

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
  const t = useTranslations('compensation')
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
      toast({ title: t('confirmSuccess'), description: t('confirmSuccessDesc') })
      setShowConfirm(false)
      onConfirmDone()
    } catch (err) {
      toast({ title: t('confirmError'), description: err instanceof Error ? err.message : t('tryAgain'), variant: 'destructive' })
    } finally {
      setConfirming(false)
    }
  }

  if (adjustments.length === 0) {
    return (
      <div className="bg-card rounded-2xl shadow-sm p-12 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground text-sm">
          {t('emptySimulation')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ─── 요약 ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-2xl shadow-sm p-6">
          <p className="text-xs text-muted-foreground mb-1">{t('targetHeadcount')}</p>
          <p className="text-3xl font-bold text-foreground">{t('persons', { count: budget.headcount })}</p>
        </div>
        <div className="bg-card rounded-2xl shadow-sm p-6">
          <p className="text-xs text-muted-foreground mb-1">{t('totalIncrease')}</p>
          <p className="text-xl font-bold text-emerald-600">
            +{formatCurrency(budget.totalIncrease)}
          </p>
        </div>
        <div className="bg-card rounded-2xl shadow-sm p-6">
          <p className="text-xs text-muted-foreground mb-1">{t('avgIncrease')}</p>
          <p className="text-3xl font-bold text-primary">{budget.avgIncreasePct}%</p>
        </div>
        <div className="bg-card rounded-2xl shadow-sm p-6">
          <p className="text-xs text-muted-foreground mb-1">{t('effectiveDate')}</p>
          <input
            type="date"
            className="w-full px-2 py-1 border border-border/30 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-primary/20"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>
      </div>

      {/* ─── 조정 목록 ─── */}
      <div className={TABLE_STYLES.wrapper}>
        <table className={TABLE_STYLES.table}>
          <thead>
            <tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>{t('employeeName')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('department')}</th>
              <th className={TABLE_STYLES.headerCellRight}>{t('currentSalary')}</th>
              <th className={TABLE_STYLES.headerCellRight}>{t('increaseRate')}</th>
              <th className={TABLE_STYLES.headerCellRight}>{t('newSalary')}</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.map((a) => (
              <tr key={a.employeeId} className={TABLE_STYLES.row}>
                <td className="px-4 py-3 text-sm font-medium">{a.employeeName}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{a.department}</td>
                <td className="px-4 py-3 text-sm text-right">
                  {formatCurrency(a.currentSalary)}
                </td>
                <td className="px-4 py-3 text-sm text-right text-primary font-medium">
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
          className="px-6 py-2"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {t('confirmAdjustment')}
        </Button>
      </div>

      {/* ─── 확인 다이얼로그 ─── */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmDescription', { count: budget.headcount, date: effectiveDate })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={confirming}
            >
              {confirming ? t('confirming') : t('confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
