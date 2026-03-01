'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Terms Override Client
// 용어 커스터마이징: DataTable + 편집 Dialog
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

interface TermOverrideLocal {
  [key: string]: unknown
  id: string
  termKey: string
  labelKo: string
  labelEn: string | null
  labelLocal: string | null
  createdAt: string
}

export function TermsClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const { toast } = useToast()

  const formSchema = z.object({
    termKey: z.string().min(1, t('termKeyRequired')),
    labelKo: z.string().min(1, t('koreanRequired')),
    labelEn: z.string().optional(),
    labelLocal: z.string().optional(),
  })

  type FormData = z.infer<typeof formSchema>

  const [items, setItems] = useState<TermOverrideLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationInfo | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TermOverrideLocal | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TermOverrideLocal | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<TermOverrideLocal>('/api/v1/settings/terms', { page, limit: 20 })
      setItems(res.data)
      setPagination(res.pagination)
    } catch {
      toast({ title: tc('error'), description: t('termLoadError'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, toast, t, tc])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openCreate = () => {
    setEditing(null)
    reset({ termKey: '', labelKo: '', labelEn: '', labelLocal: '' })
    setDialogOpen(true)
  }

  const openEdit = (row: TermOverrideLocal) => {
    setEditing(row)
    reset({ termKey: row.termKey, labelKo: row.labelKo, labelEn: row.labelEn ?? '', labelLocal: row.labelLocal ?? '' })
    setDialogOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      if (editing) {
        await apiClient.put(`/api/v1/settings/terms/${editing.id}`, data)
      } else {
        await apiClient.post('/api/v1/settings/terms', data)
      }
      toast({ title: tc('success'), description: t('termSaved') })
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
      await apiClient.delete(`/api/v1/settings/terms/${deleteTarget.id}`)
      toast({ title: tc('success'), description: t('termDeleted') })
      setDeleteTarget(null)
      fetchItems()
    } catch {
      toast({ title: tc('error'), description: t('deleteError'), variant: 'destructive' })
    }
  }

  const columns: DataTableColumn<TermOverrideLocal>[] = [
    { key: 'termKey', header: t('termKey'), render: (row) => <span className="font-mono text-sm">{row.termKey}</span> },
    { key: 'labelKo', header: t('korean') },
    { key: 'labelEn', header: t('english'), render: (row) => row.labelEn ?? '-' },
    { key: 'labelLocal', header: t('localLang'), render: (row) => row.labelLocal ?? '-' },
    {
      key: 'actions', header: t('manage'),
      render: (row) => (
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
        title={t('termsTitle')}
        description={t('termsDesc')}
        actions={
          <Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> {t('addTerm')}</Button>
        }
      />

      <DataTable<TermOverrideLocal>
        columns={columns}
        data={items}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage={t('noTerms')}
        rowKey={(row) => row.id}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('editTerm') : t('addTerm')}</DialogTitle>
            <DialogDescription>{t('termDialogDesc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('termKey')}</Label>
              <Input {...register('termKey')} placeholder={t('termKeyPlaceholder')} disabled={!!editing} />
              {errors.termKey && <p className="text-xs text-destructive">{errors.termKey.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('korean')}</Label>
              <Input {...register('labelKo')} placeholder={t('koreanPlaceholder')} />
              {errors.labelKo && <p className="text-xs text-destructive">{errors.labelKo.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('english')}</Label>
              <Input {...register('labelEn')} placeholder={t('englishPlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('localLang')}</Label>
              <Input {...register('labelLocal')} placeholder={t('localLangPlaceholder')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{tc('cancel')}</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? tc('edit') : tc('add')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('termDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.termKey}&quot; {t('termDeleteConfirm', { key: '' })}
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
