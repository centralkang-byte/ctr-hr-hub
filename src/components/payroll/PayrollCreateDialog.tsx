'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiClient } from '@/lib/api'
import { BUTTON_VARIANTS } from '@/lib/styles'

const RUN_TYPE_LABEL_KEYS: Record<string, string> = {
  MONTHLY: 'createDialog.monthly',
  BONUS: 'createDialog.bonus',
  SEVERANCE: 'createDialog.severance',
  SPECIAL: 'createDialog.special',
}

interface PayrollCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export default function PayrollCreateDialog({ open, onOpenChange, onCreated }: PayrollCreateDialogProps) {
  const t = useTranslations('payroll')
  const tc = useTranslations('common')
  const [loading, setLoading] = useState(false)
  const [runType, setRunType] = useState('MONTHLY')

  const now = new Date()
  const defaultYearMonth = format(now, 'yyyy-MM')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const yearMonth = (form.get('yearMonth') as string) || defaultYearMonth
    const [year, month] = yearMonth.split('-').map(Number)
    const periodDate = new Date(year, month - 1, 1)

    try {
      await apiClient.post('/api/v1/payroll/runs', {
        name: form.get('name') || `${yearMonth} ${t(RUN_TYPE_LABEL_KEYS[runType])}`,
        runType,
        yearMonth,
        periodStart: startOfMonth(periodDate).toISOString(),
        periodEnd: endOfMonth(periodDate).toISOString(),
        payDate: form.get('payDate') || undefined,
      })
      onOpenChange(false)
      onCreated()
    } catch {
      // error handled by apiClient
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('createDialog.title')}</DialogTitle>
          <DialogDescription>{t('createDialog.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="yearMonth">{t('createDialog.payPeriod')}</Label>
            <Input
              id="yearMonth"
              name="yearMonth"
              type="month"
              defaultValue={defaultYearMonth}
              required
            />
          </div>
          <div>
            <Label htmlFor="runType">{t('createDialog.runType')}</Label>
            <Select value={runType} onValueChange={setRunType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RUN_TYPE_LABEL_KEYS).map(([value, labelKey]) => (
                  <SelectItem key={value} value={value}>
                    {t(labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="name">{t('createDialog.runName')}</Label>
            <Input
              id="name"
              name="name"
              placeholder={`${defaultYearMonth} ${t(RUN_TYPE_LABEL_KEYS[runType])}`}
            />
          </div>
          <div>
            <Label htmlFor="payDate">{t('createDialog.payDate')}</Label>
            <Input id="payDate" name="payDate" type="date" />
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
              {loading ? t('createDialog.creating') : t('createDialog.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
