'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Email Templates Client
// 이메일 템플릿: DataTable + body textarea Dialog
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { SessionUser, PaginationInfo } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

interface EmailTemplateLocal {
  [key: string]: unknown
  id: string
  eventType: string
  channel: string
  locale: string
  subject: string
  body: string
  variables: unknown
  isActive: boolean
  isSystem: boolean
}

const EVENT_TYPES = [
  'LEAVE_REQUESTED', 'LEAVE_APPROVED', 'LEAVE_REJECTED',
  'GOAL_CREATED', 'REVIEW_STARTED', 'REVIEW_COMPLETED',
  'ONBOARDING_STARTED', 'OFFBOARDING_STARTED',
  'SALARY_CHANGED', 'PASSWORD_RESET',
]

export function EmailTemplatesClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const { toast } = useToast()

  const CHANNELS = [
    { value: '', label: t('channelAll') },
    { value: 'EMAIL', label: t('channelEmail') },
    { value: 'PUSH', label: t('channelPush') },
    { value: 'IN_APP', label: t('channelInApp') },
  ]

  const createSchema = z.object({
    eventType: z.string().min(1, t('eventTypeRequired')),
    channel: z.enum(['EMAIL', 'PUSH', 'IN_APP']),
    locale: z.string().min(2),
    subject: z.string().min(1, t('subjectRequired')),
    body: z.string().min(1, t('bodyRequired')),
    isActive: z.boolean(),
  })

  const updateSchema = z.object({
    subject: z.string().min(1, t('subjectRequired')),
    body: z.string().min(1, t('bodyRequired')),
    isActive: z.boolean(),
  })

  type CreateFormData = z.infer<typeof createSchema>
  type UpdateFormData = z.infer<typeof updateSchema>

  const [items, setItems] = useState<EmailTemplateLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [filterChannel, setFilterChannel] = useState('')
  const [pagination, setPagination] = useState<PaginationInfo | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EmailTemplateLocal | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplateLocal | null>(null)

  const createForm = useForm<CreateFormData>({ resolver: zodResolver(createSchema) })
  const updateForm = useForm<UpdateFormData>({ resolver: zodResolver(updateSchema) })

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (filterChannel) params.channel = filterChannel
      const res = await apiClient.getList<EmailTemplateLocal>('/api/v1/settings/email-templates', params)
      setItems(res.data)
      setPagination(res.pagination)
    } catch {
      toast({ title: tc('error'), description: t('templateLoadError'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, filterChannel, toast, t, tc])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openCreate = () => {
    setEditing(null)
    createForm.reset({ eventType: '', channel: 'EMAIL', locale: 'ko', subject: '', body: '', isActive: true })
    setDialogOpen(true)
  }

  const openEdit = (row: EmailTemplateLocal) => {
    setEditing(row)
    updateForm.reset({ subject: row.subject, body: row.body, isActive: row.isActive })
    setDialogOpen(true)
  }

  const onCreateSubmit = async (data: CreateFormData) => {
    setSaving(true)
    try {
      await apiClient.post('/api/v1/settings/email-templates', { ...data, variables: [] })
      toast({ title: tc('success'), description: t('templateAdded') })
      setDialogOpen(false)
      fetchItems()
    } catch {
      toast({ title: tc('error'), description: t('saveError'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const onUpdateSubmit = async (data: UpdateFormData) => {
    if (!editing) return
    setSaving(true)
    try {
      await apiClient.put(`/api/v1/settings/email-templates/${editing.id}`, data)
      toast({ title: tc('success'), description: t('templateUpdated') })
      setDialogOpen(false)
      fetchItems()
    } catch {
      toast({ title: tc('error'), description: t('saveError'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await apiClient.delete(`/api/v1/settings/email-templates/${deleteTarget.id}`)
      toast({ title: tc('success'), description: t('templateDeleted') })
      setDeleteTarget(null)
      fetchItems()
    } catch {
      toast({ title: tc('error'), description: t('deleteError'), variant: 'destructive' })
    }
  }

  const columns: DataTableColumn<EmailTemplateLocal>[] = [
    { key: 'eventType', header: t('event'), render: (row) => <span className="font-mono text-xs">{row.eventType}</span> },
    {
      key: 'channel', header: t('channel'),
      render: (row) => CHANNELS.find((c) => c.value === row.channel)?.label ?? row.channel,
    },
    { key: 'locale', header: t('localeCol'), render: (row) => row.locale.toUpperCase() },
    { key: 'subject', header: t('subject'), render: (row) => <span className="max-w-[200px] truncate block">{row.subject}</span> },
    {
      key: 'isActive', header: tc('status'),
      render: (row) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {row.isActive ? t('active') : t('inactive')}
        </span>
      ),
    },
    {
      key: 'actions', header: t('manage'),
      render: (row) => row.isSystem ? (
        <span className="text-xs text-muted-foreground">{t('system')}</span>
      ) : (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={t('emailTemplatesTitle')}
        description={t('emailTemplatesDesc')}
        actions={<Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> {t('addTemplate')}</Button>}
      />

      <div className="flex items-center gap-3">
        <Label className="text-sm">{t('channelFilter')}</Label>
        <Select value={filterChannel} onValueChange={(v) => { setFilterChannel(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t('channelAll')} /></SelectTrigger>
          <SelectContent>
            {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable<EmailTemplateLocal>
        columns={columns}
        data={items}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage={t('noTemplates')}
        rowKey={(row) => row.id}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t('editTemplate') : t('addTemplate')}</DialogTitle>
            <DialogDescription>{t('templateDialogDesc')}</DialogDescription>
          </DialogHeader>
          {editing ? (
            <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('subject')}</Label>
                <Input {...updateForm.register('subject')} />
                {updateForm.formState.errors.subject && <p className="text-xs text-destructive">{updateForm.formState.errors.subject.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('body')}</Label>
                <Textarea {...updateForm.register('body')} rows={8} className="font-mono text-sm" />
                {updateForm.formState.errors.body && <p className="text-xs text-destructive">{updateForm.formState.errors.body.message}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={updateForm.watch('isActive')} onCheckedChange={(v) => updateForm.setValue('isActive', v)} />
                <Label>{t('active')}</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{tc('cancel')}</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tc('edit')}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('eventTypeLabel')}</Label>
                  <Select value={createForm.watch('eventType')} onValueChange={(v) => createForm.setValue('eventType', v)}>
                    <SelectTrigger><SelectValue placeholder={t('select')} /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((et) => <SelectItem key={et} value={et}>{et}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('channel')}</Label>
                  <Select value={createForm.watch('channel')} onValueChange={(v) => createForm.setValue('channel', v as 'EMAIL' | 'PUSH' | 'IN_APP')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHANNELS.filter((c) => c.value).map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('subject')}</Label>
                <Input {...createForm.register('subject')} placeholder={t('subjectPlaceholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t('body')}</Label>
                <Textarea {...createForm.register('body')} rows={8} className="font-mono text-sm" placeholder={t('bodyPlaceholder')} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={createForm.watch('isActive')} onCheckedChange={(v) => createForm.setValue('isActive', v)} />
                <Label>{t('active')}</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{tc('cancel')}</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tc('add')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('templateDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.subject}&quot; {t('templateDeleteConfirm', { subject: '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{tc('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
