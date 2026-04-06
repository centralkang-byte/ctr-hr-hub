'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiClient } from '@/lib/api'
import { formatCurrency } from '@/lib/compensation'
import { BUTTON_VARIANTS } from '@/lib/styles'

interface PayrollAdjustDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  runId: string
  item: {
    id: string
    employeeName: string
    baseSalary: number
    overtimePay: number
    bonus: number
    allowances: number
    deductions: number
    grossPay: number
    netPay: number
  }
  onAdjusted: () => void
}

export default function PayrollAdjustDialog({
  open,
  onOpenChange,
  runId,
  item,
  onAdjusted,
}: PayrollAdjustDialogProps) {
  const t = useTranslations('payroll')
  const tc = useTranslations('common')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const adjustmentReason = form.get('adjustmentReason') as string

    const body: Record<string, unknown> = { adjustmentReason }

    const fields = ['baseSalary', 'overtimePay', 'bonus', 'allowances', 'deductions'] as const
    for (const field of fields) {
      const val = form.get(field) as string
      if (val) body[field] = Number(val)
    }

    try {
      await apiClient.put(`/api/v1/payroll/runs/${runId}/items/${item.id}`, body)
      onOpenChange(false)
      onAdjusted()
    } catch {
      // error handled by apiClient
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('adjustDialog.title', { name: item.employeeName })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('basePay')}</Label>
              <Input name="baseSalary" type="number" defaultValue={item.baseSalary} />
              <p className="text-xs text-muted-foreground mt-0.5">{t('adjustDialog.current', { amount: formatCurrency(item.baseSalary) })}</p>
            </div>
            <div>
              <Label>{t('overtimePay')}</Label>
              <Input name="overtimePay" type="number" defaultValue={item.overtimePay} />
            </div>
            <div>
              <Label>{t('bonusPay')}</Label>
              <Input name="bonus" type="number" defaultValue={item.bonus} />
            </div>
            <div>
              <Label>{t('allowances')}</Label>
              <Input name="allowances" type="number" defaultValue={item.allowances} />
            </div>
            <div>
              <Label>{t('adjustDialog.manualDeduction')}</Label>
              <Input name="deductions" type="number" defaultValue={item.deductions} />
            </div>
          </div>
          <div>
            <Label htmlFor="adjustmentReason">{t('adjustDialog.adjustmentReason')}</Label>
            <Textarea
              id="adjustmentReason"
              name="adjustmentReason"
              required
              placeholder={t('adjustDialog.reasonPlaceholder')}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className={BUTTON_VARIANTS.primary}
            >
              {loading ? t('adjustDialog.saving') : t('adjustDialog.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
