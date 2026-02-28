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

// ─── Form schema ────────────────────────────────────────────

const formSchema = z.object({
  eventType: z.string().min(1, '이벤트 타입은 필수입니다'),
  template: z.string().min(1, '템플릿은 필수입니다'),
  channels: z
    .array(z.string())
    .min(1, '최소 1개 채널을 선택하세요'),
  isActive: z.boolean().default(true),
})

type FormData = z.infer<typeof formSchema>

const CHANNEL_OPTIONS = [
  { value: 'IN_APP', label: '인앱' },
  { value: 'EMAIL', label: '이메일' },
  { value: 'PUSH', label: '푸시' },
] as const

// ─── Component ──────────────────────────────────────────────

export function NotificationTriggersClient({ user }: { user: SessionUser }) {
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
        prev.map((t) =>
          t.id === row.id ? { ...t, isActive: !t.isActive } : t,
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

  // ─── Columns ───
  const columns: DataTableColumn<TriggerLocal>[] = [
    {
      key: 'eventType',
      header: '이벤트 타입',
    },
    {
      key: 'template',
      header: '템플릿',
      render: (row: TriggerLocal) => (
        <span className="max-w-[200px] truncate block text-sm text-slate-600">
          {row.template}
        </span>
      ),
    },
    {
      key: 'channels',
      header: '채널',
      render: (row: TriggerLocal) => (
        <div className="flex gap-1">
          {(row.channels as string[]).map((ch) => (
            <Badge key={ch} variant="outline" className="text-xs">
              {ch === 'IN_APP' ? '인앱' : ch === 'EMAIL' ? '이메일' : '푸시'}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'isActive',
      header: '활성',
      render: (row: TriggerLocal) => (
        <Switch
          checked={row.isActive}
          onCheckedChange={() => handleToggleActive(row)}
        />
      ),
    },
    {
      key: 'actions',
      header: '액션',
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
        title="알림 설정"
        description="알림 트리거를 설정하고 관리합니다."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            트리거 추가
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
        emptyMessage="등록된 알림 트리거가 없습니다."
        rowKey={(row) => (row as unknown as TriggerLocal).id}
      />

      {/* ─── Create / Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editing ? '알림 트리거 수정' : '알림 트리거 추가'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? '알림 트리거 정보를 수정합니다.'
                : '새 알림 트리거를 등록합니다.'}
            </DialogDescription>
          </DialogHeader>

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
            {/* eventType */}
            <div className="space-y-2">
              <Label htmlFor="trigger-event-type">이벤트 타입</Label>
              <Input
                id="trigger-event-type"
                placeholder="예: leave.approved"
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
              <Label htmlFor="trigger-template">템플릿</Label>
              <Textarea
                id="trigger-template"
                placeholder="알림 메시지 템플릿을 입력하세요..."
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
              <Label>채널</Label>
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
                    활성화
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
                취소
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                )}
                저장
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
            <AlertDialogTitle>알림 트리거 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.eventType}&quot; 트리거를 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
