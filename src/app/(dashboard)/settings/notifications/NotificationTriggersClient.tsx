'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Notification Triggers Settings Client
// 알림 트리거 관리 (CRUD via Dialog + Switch 토글)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { SessionUser, PaginationInfo } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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

// ─── Types ──────────────────────────────────────────────────

interface TriggerLocal {
  id: string
  eventType: string
  template: string
  channels: string[]
  isActive: boolean
  companyId: string | null
  createdAt: string
}

// ─── Component ──────────────────────────────────────────────

export function NotificationTriggersClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')

  const CHANNEL_OPTIONS = [
    { value: 'IN_APP', label: t('channelInApp') },
    { value: 'EMAIL', label: t('channelEmail') },
    { value: 'PUSH', label: t('channelPush') },
    { value: 'TEAMS', label: t('channelTeams') },
  ] as const

  // ─── Form schema ────────────────────────────────────────────

  const formSchema = z.object({
    eventType: z.string().min(1, t('eventTypeRequired2')),
    template: z.string().min(1, t('templateRequired')),
    channels: z
      .array(z.string())
      .min(1, t('minOneChannel')),
    isActive: z.boolean().default(true),
  })

  type FormData = z.infer<typeof formSchema>

  const [triggers, setTriggers] = useState<TriggerLocal[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | undefined>()
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TriggerLocal | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<TriggerLocal | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ─── Form ───
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<z.input<typeof formSchema>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: { eventType: '', template: '', channels: ['IN_APP'], isActive: true },
  })

  // ─── Fetch ───
  const fetchTriggers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<TriggerLocal>(
        '/api/v1/settings/notification-triggers',
        { page, limit: 20 },
      )
      setTriggers(res.data)
      setPagination(res.pagination)
    } catch {
      setTriggers([])
      setPagination(undefined)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void fetchTriggers()
  }, [fetchTriggers])

  // ─── Dialog open/close ───
  const openCreate = () => {
    setEditing(null)
    reset({ eventType: '', template: '', channels: ['IN_APP'], isActive: true })
    setDialogOpen(true)
  }

  const openEdit = (row: TriggerLocal) => {
    setEditing(row)
    reset({
      eventType: row.eventType,
      template: row.template,
      channels: row.channels,
      isActive: row.isActive,
    })
    setDialogOpen(true)
  }

  // ─── Submit ───
  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      if (editing) {
        await apiClient.put(
          `/api/v1/settings/notification-triggers/${editing.id}`,
          data,
        )
      } else {
        await apiClient.post('/api/v1/settings/notification-triggers', data)
      }
      setDialogOpen(false)
      fetchTriggers()
    } finally {
      setSaving(false)
    }
  }

  // ─── Toggle active ───
  const handleToggleActive = async (row: TriggerLocal) => {
    try {
      await apiClient.put(
        `/api/v1/settings/notification-triggers/${row.id}`,
        { isActive: !row.isActive },
      )
      setTriggers((prev) =>
        prev.map((tr) =>
          tr.id === row.id ? { ...tr, isActive: !tr.isActive } : tr,
        ),
      )
    } catch {
      // silent
    }
  }

  // ─── Delete ───
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiClient.delete(
        `/api/v1/settings/notification-triggers/${deleteTarget.id}`,
      )
      setDeleteTarget(null)
      fetchTriggers()
    } finally {
      setDeleting(false)
    }
  }

  // ─── Channel label helper ───
  const getChannelLabel = (ch: string) => {
    const found = CHANNEL_OPTIONS.find((o) => o.value === ch)
    return found ? found.label : ch
  }

  // ─── Columns ───
  const columns: DataTableColumn<TriggerLocal>[] = [
    {
      key: 'eventType',
      header: t('eventTypeTrigger'),
    },
    {
      key: 'template',
      header: t('templateLabel'),
      render: (row: TriggerLocal) => (
        <span className="max-w-[200px] truncate block text-sm text-slate-600">
          {row.template}
        </span>
      ),
    },
    {
      key: 'channels',
      header: t('channel'),
      render: (row: TriggerLocal) => (
        <div className="flex gap-1">
          {(row.channels as string[]).map((ch) => (
            <Badge key={ch} variant="outline" className="text-xs">
              {getChannelLabel(ch)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'isActive',
      header: t('active'),
      render: (row: TriggerLocal) => (
        <Switch
          checked={row.isActive}
          onCheckedChange={() => handleToggleActive(row)}
        />
      ),
    },
    {
      key: 'actions',
      header: t('manage'),
      render: (row: TriggerLocal) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteTarget(row)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  // ─── Render ───
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('notificationsTitle')}
        description={t('notificationsDesc')}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            {t('addTrigger')}
          </Button>
        }
      />

      {/* ─── DataTable ─── */}
      <DataTable
        columns={columns as unknown as DataTableColumn<Record<string, unknown>>[]}
        data={triggers as unknown as Record<string, unknown>[]}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage={t('noTriggers')}
        rowKey={(row) => (row as unknown as TriggerLocal).id}
      />

      {/* ─── Create / Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('editTriggerTitle') : t('addTriggerTitle')}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? t('editTriggerDesc')
                : t('addTriggerDesc')}
            </DialogDescription>
          </DialogHeader>

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
            {/* eventType */}
            <div className="space-y-2">
              <Label htmlFor="trigger-event-type">{t('eventTypeTrigger')}</Label>
              <Input
                id="trigger-event-type"
                placeholder={t('eventTypePlaceholder')}
                {...register('eventType')}
              />
              {errors.eventType && (
                <p className="text-sm text-destructive">
                  {errors.eventType.message}
                </p>
              )}
            </div>

            {/* template */}
            <div className="space-y-2">
              <Label htmlFor="trigger-template">{t('templateLabel')}</Label>
              <Textarea
                id="trigger-template"
                placeholder={t('templatePlaceholder')}
                rows={4}
                {...register('template')}
              />
              {errors.template && (
                <p className="text-sm text-destructive">
                  {errors.template.message}
                </p>
              )}
            </div>

            {/* channels */}
            <div className="space-y-2">
              <Label>{t('channel')}</Label>
              <Controller
                control={control}
                name="channels"
                render={({ field }) => (
                  <div className="flex items-center gap-4">
                    {CHANNEL_OPTIONS.map((ch) => (
                      <div key={ch.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`ch-${ch.value}`}
                          checked={(field.value as string[]).includes(ch.value)}
                          onCheckedChange={(checked) => {
                            const current = field.value as string[]
                            if (checked) {
                              field.onChange([...current, ch.value])
                            } else {
                              field.onChange(
                                current.filter((v) => v !== ch.value),
                              )
                            }
                          }}
                        />
                        <Label htmlFor={`ch-${ch.value}`} className="cursor-pointer text-sm">
                          {ch.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              />
              {errors.channels && (
                <p className="text-sm text-destructive">
                  {errors.channels.message}
                </p>
              )}
            </div>

            {/* isActive */}
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Switch
                    id="trigger-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <Label htmlFor="trigger-active" className="cursor-pointer">
                    {t('activate')}
                  </Label>
                </div>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                )}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Delete AlertDialog ─── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('triggerDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.eventType}&quot; {t('triggerDeleteConfirm', { eventType: '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              {tc('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
