'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('bulkCreate.title')}</DialogTitle>
          <DialogDescription>{t('bulkCreate.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('bulkCreate.yearLabel')}</label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || CURRENT_YEAR)}
              min={2020}
              max={2100}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('bulkCreate.quarterLabel')}</label>
            <Select value={quarter} onValueChange={setQuarter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUARTERS.map((q) => (
                  <SelectItem key={q} value={q}>{t(`quarter.${q}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            {tc('cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t('bulkCreate.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
