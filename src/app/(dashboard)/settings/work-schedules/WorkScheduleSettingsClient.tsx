'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Work Schedule Settings Client
// 근무 스케줄 관리 (CRUD via Dialog)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'

import type { SessionUser, PaginationInfo } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

// ─── Local interfaces (matching API response) ────────────

interface WorkScheduleLocal {
  id: string
  companyId: string
  name: string
  scheduleType: string
  weeklyHours: number
  dailyConfig: unknown
  shiftConfig: unknown
  createdAt: string
}

// ─── Label / color maps ─────────────────────────────────

const SCHEDULE_TYPE_COLORS: Record<string, string> = {
  FIXED: 'bg-blue-100 text-blue-800',
  FLEXIBLE: 'bg-green-100 text-green-800',
  SHIFT: 'bg-purple-100 text-purple-800',
}

// ─── Default daily config (Mon–Sun, 09:00–18:00 weekdays) ──

const DEFAULT_DAILY_CONFIG = [
  { day: 'MON', startTime: '09:00', endTime: '18:00', breakMinutes: 60, isWorkDay: true },
  { day: 'TUE', startTime: '09:00', endTime: '18:00', breakMinutes: 60, isWorkDay: true },
  { day: 'WED', startTime: '09:00', endTime: '18:00', breakMinutes: 60, isWorkDay: true },
  { day: 'THU', startTime: '09:00', endTime: '18:00', breakMinutes: 60, isWorkDay: true },
  { day: 'FRI', startTime: '09:00', endTime: '18:00', breakMinutes: 60, isWorkDay: true },
  { day: 'SAT', startTime: null, endTime: null, breakMinutes: 0, isWorkDay: false },
  { day: 'SUN', startTime: null, endTime: null, breakMinutes: 0, isWorkDay: false },
]

// ─── Zod form schema ─────────────────────────────────────

const formSchema = z.object({
  name: z.string().min(1, '스케줄명은 필수입니다'),
  scheduleType: z.enum(['FIXED', 'FLEXIBLE', 'SHIFT']),
  weeklyHours: z.coerce.number().min(0, '0 이상 입력하세요').max(168, '168 이하 입력하세요'),
})

type FormData = z.infer<typeof formSchema>

// ─── Main Component ──────────────────────────────────────

export function WorkScheduleSettingsClient({ user }: { user: SessionUser }) {
  void user // reserved for permission checks

  const t = useTranslations('shift')
  const tc = useTranslations('common')

  // ─── Translated label maps ───
  const SCHEDULE_TYPE_LABELS: Record<string, string> = {
    FIXED: t('fixed'),
    FLEXIBLE: t('flexible'),
    SHIFT: t('shiftWork'),
  }

  // ── State ──
  const [schedules, setSchedules] = useState<WorkScheduleLocal[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | undefined>()
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WorkScheduleLocal | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<WorkScheduleLocal | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Form ──
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof formSchema>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: { name: '', scheduleType: 'FIXED', weeklyHours: 40 },
  })

  // ── Fetch ──
  const fetchSchedules = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await apiClient.getList<WorkScheduleLocal>(
        '/api/v1/work-schedules',
        { page: p, limit: 20 },
      )
      setSchedules(res.data)
      setPagination(res.pagination)
    } catch {
      // silently handle – toast can be added later
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSchedules(page)
  }, [page, fetchSchedules])

  // ── Dialog helpers ──
  const openCreate = () => {
    setEditing(null)
    reset({ name: '', scheduleType: 'FIXED', weeklyHours: 40 })
    setDialogOpen(true)
  }

  const openEdit = (row: WorkScheduleLocal) => {
    setEditing(row)
    reset({
      name: row.name,
      scheduleType: row.scheduleType as 'FIXED' | 'FLEXIBLE' | 'SHIFT',
      weeklyHours: row.weeklyHours,
    })
    setDialogOpen(true)
  }

  const openDelete = (row: WorkScheduleLocal) => {
    setDeleteTarget(row)
  }

  // ── Submit (create/update) ──
  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      if (editing) {
        await apiClient.put(`/api/v1/work-schedules/${editing.id}`, data)
      } else {
        await apiClient.post('/api/v1/work-schedules', {
          ...data,
          dailyConfig: DEFAULT_DAILY_CONFIG,
        })
      }
      setDialogOpen(false)
      void fetchSchedules(page)
    } catch {
      // error handling – toast can be added later
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ──
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiClient.delete(`/api/v1/work-schedules/${deleteTarget.id}`)
      setDeleteTarget(null)
      void fetchSchedules(page)
    } catch {
      // error handling
    } finally {
      setDeleting(false)
    }
  }

  // ── DataTable columns ──
  type Row = Record<string, unknown>
  const columns: DataTableColumn<Row>[] = [
    {
      key: 'name',
      header: t('scheduleName'),
    },
    {
      key: 'scheduleType',
      header: t('scheduleType'),
      render: (r) => {
        const row = r as unknown as WorkScheduleLocal
        return (
          <Badge
            variant="outline"
            className={SCHEDULE_TYPE_COLORS[row.scheduleType] ?? ''}
          >
            {SCHEDULE_TYPE_LABELS[row.scheduleType] ?? row.scheduleType}
          </Badge>
        )
      },
    },
    {
      key: 'weeklyHours',
      header: t('weeklyHours'),
      render: (r) => {
        const row = r as unknown as WorkScheduleLocal
        return <span>{t('hoursSuffix', { hours: row.weeklyHours })}</span>
      },
    },
    {
      key: 'actions',
      header: tc('actions'),
      render: (r) => {
        const row = r as unknown as WorkScheduleLocal
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                openEdit(row)
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                openDelete(row)
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )
      },
    },
  ]

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            {tc('create')}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={schedules as unknown as Record<string, unknown>[]}
        pagination={pagination}
        onPageChange={setPage}
        loading={loading}
        emptyMessage={t('noSchedules')}
        emptyDescription={t('noSchedulesDesc')}
        emptyAction={{ label: t('registerSchedule'), onClick: openCreate }}
        rowKey={(row) => (row as unknown as WorkScheduleLocal).id}
      />

      {/* ─── Create / Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('editTitle') : t('createTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('formDescription')}
            </DialogDescription>
          </DialogHeader>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ws-name">{t('scheduleName')}</Label>
              <Input
                id="ws-name"
                placeholder={t('exampleSchedule')}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('scheduleType')}</Label>
              <Controller
                control={control}
                name="scheduleType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectType')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED">{t('fixed')}</SelectItem>
                      <SelectItem value="FLEXIBLE">{t('flexible')}</SelectItem>
                      <SelectItem value="SHIFT">{t('shiftWork')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ws-hours">{t('weeklyHours')}</Label>
              <Input
                id="ws-hours"
                type="number"
                min={0}
                max={168}
                {...register('weeklyHours')}
              />
              {errors.weeklyHours && (
                <p className="text-sm text-destructive">
                  {errors.weeklyHours.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? tc('edit') : tc('create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation AlertDialog ─── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open: boolean) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {tc('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tc('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
