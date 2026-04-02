'use client'

// ═══════════════════════════════════════════════════════════
// Tab: Designated Leave Days — 지정연차 관리
// API: GET/POST /api/v1/leave/designated-days
//      DELETE   /api/v1/leave/designated-days/[id]
// ═══════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Plus, CalendarDays, Trash2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BUTTON_VARIANTS } from '@/lib/styles'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface DesignatedDay {
  id: string
  companyId: string
  date: string
  name: string
  year: number
}

interface DesignatedLeaveTabProps {
  companyId: string | null
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export function DesignatedLeaveTab({ companyId }: DesignatedLeaveTabProps) {
  const t = useTranslations('settings')
  const [days, setDays] = useState<DesignatedDay[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchDays = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<DesignatedDay[]>(
        `/api/v1/leave/designated-days?year=${selectedYear}`,
      )
      setDays(res.data ?? [])
    } catch {
      setDays([])
    } finally {
      setLoading(false)
    }
  }, [selectedYear])

  useEffect(() => { fetchDays() }, [fetchDays])

  const handleCreate = async () => {
    if (!newDate || !newName.trim()) {
      toast({ title: t('common.dateAndNameRequired'), variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await apiClient.post('/api/v1/leave/designated-days', {
        date: newDate,
        name: newName.trim(),
        ...(companyId ? { companyId } : {}),
      })
      toast({ title: t('common.addSuccess', { name: '' }) })
      setDialogOpen(false)
      setNewDate('')
      setNewName('')
      void fetchDays()
    } catch (err) {
      toast({
        title: t('common.addFailed'),
        description: err instanceof Error ? err.message : t('common.retryMessage'),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/api/v1/leave/designated-days/${id}`)
      toast({ title: t('common.deleteSuccess') })
      void fetchDays()
    } catch (err) {
      toast({
        title: t('common.deleteFailed'),
        description: err instanceof Error ? err.message : t('common.retryMessage'),
        variant: 'destructive',
      })
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const month = d.getMonth() + 1
    const day = d.getDate()
    const dayOfWeek = t(`designatedLeave.dayNames.${DAY_KEYS[d.getDay()]}`)
    return `${month}/${day} (${dayOfWeek})`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  // Group by month
  const grouped = days.reduce<Record<number, DesignatedDay[]>>((acc, d) => {
    const month = new Date(d.date).getMonth() + 1
    if (!acc[month]) acc[month] = []
    acc[month].push(d)
    return acc
  }, {})

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('designatedLeave.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('designatedLeave.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 연도 선택 */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="h-9 rounded-lg border border-border px-3 text-sm bg-card"
          >
            {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
              <option key={y} value={y}>{t('designatedLeave.yearUnit', { year: y })}</option>
            ))}
          </select>
          <Button
            className={BUTTON_VARIANTS.primary}
            onClick={() => {
              setNewDate('')
              setNewName('')
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t('common.add')}
          </Button>
        </div>
      </div>

      {/* List */}
      {days.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          <CalendarDays className="mx-auto h-10 w-10 text-border mb-2" />
          <p>{t('designatedLeave.emptyState', { year: selectedYear })}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.keys(grouped).sort((a, b) => Number(a) - Number(b)).map((monthStr) => {
            const month = Number(monthStr)
            const items = grouped[month]
            return (
              <div key={month}>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">{t('designatedLeave.monthUnit', { month })}</h4>
                <div className="space-y-1">
                  {items.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-background group"
                    >
                      <div className="flex items-center gap-3">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">{d.name}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(d.date)}</span>
                      </div>
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          <div className="pt-2 border-t border-border text-sm text-muted-foreground">
            {t('designatedLeave.totalDays', { count: days.length })}
          </div>
        </div>
      )}

      {/* 추가 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('designatedLeave.addTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t('designatedLeave.dateLabel')}</label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t('designatedLeave.nameLabel')}</label>
              <Input
                placeholder={t('designatedLeave.namePlaceholder')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button
              className={BUTTON_VARIANTS.primary}
              onClick={handleCreate}
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
