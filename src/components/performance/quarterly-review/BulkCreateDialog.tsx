'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { WdDrawer, WdField } from '@/components/shared/WdDrawer'
import { Loader2 } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

// ─── Constants ──────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const

// ─── Component ──────────────────────────────────────────────

export default function BulkCreateDialog({ open, onOpenChange, onSuccess }: Props) {
  const t = useTranslations('performance.quarterlyReview')
  const tc = useTranslations('common')

  const [year, setYear] = useState(CURRENT_YEAR)
  const [quarter, setQuarter] = useState<string>('Q1')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await apiClient.post<{ created: number }>('/api/v1/performance/quarterly-reviews/bulk-create', {
        year,
        quarter,
      })
      toast({ title: t('toast.bulkCreateSuccess', { count: res.data.created }) })
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      toast({
        title: t('toast.saveFailed'),
        description: err instanceof Error ? err.message : tc('retry'),
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <WdDrawer
      open={open}
      onClose={() => onOpenChange(false)}
      title={t('bulkCreate.title')}
      closeDisabled={creating}
      secondary={{ label: tc('cancel'), onClick: () => onOpenChange(false), disabled: creating }}
      primary={{
        label: t('bulkCreate.create'),
        onClick: handleCreate,
        disabled: creating,
        icon: creating ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined,
      }}
    >
      <p className="text-sm text-muted-foreground">{t('bulkCreate.description')}</p>

      <WdField label={t('bulkCreate.yearLabel')} htmlFor="bulk-create-year">
        <Input
          id="bulk-create-year"
          type="number"
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value) || CURRENT_YEAR)}
          min={2020}
          max={2100}
        />
      </WdField>

      <WdField label={t('bulkCreate.quarterLabel')} htmlFor="bulk-create-quarter">
        <Select value={quarter} onValueChange={setQuarter}>
          <SelectTrigger id="bulk-create-quarter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUARTERS.map((q) => (
              <SelectItem key={q} value={q}>{t(`quarter.${q}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </WdField>
    </WdDrawer>
  )
}
