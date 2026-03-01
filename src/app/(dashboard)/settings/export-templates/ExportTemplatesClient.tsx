'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Export Templates Client
// 내보내기 설정: DataTable + columns 편집 Dialog
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

interface ColumnDef {
  key: string
  label: string
  width?: number
}

interface ExportTemplateLocal {
  [key: string]: unknown
  id: string
  entityType: string
  name: string
  columns: ColumnDef[]
  fileFormat: string
  isDefault: boolean
  createdAt: string
}

export function ExportTemplatesClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const { toast } = useToast()

  const ENTITY_TYPES = [
    { value: '', label: t('entityAll') },
    { value: 'EMPLOYEE', label: t('entityEmployee') },
    { value: 'ATTENDANCE', label: t('entityAttendance') },
    { value: 'LEAVE', label: t('entityLeave') },
    { value: 'PAYROLL', label: t('entityPayroll') },
    { value: 'PERFORMANCE', label: t('entityPerformance') },
  ]

  const formSchema = z.object({
    entityType: z.string().min(1, t('entityTypeRequired')),
    name: z.string().min(1, t('nameRequired')),
    fileFormat: z.enum(['XLSX', 'CSV']),
    isDefault: z.boolean(),
  })

  type FormData = z.infer<typeof formSchema>

  const [items, setItems] = useState<ExportTemplateLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [filterEntityType, setFilterEntityType] = useState('')
  const [pagination, setPagination] = useState<PaginationInfo | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ExportTemplateLocal | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ExportTemplateLocal | null>(null)
  const [columns, setColumns] = useState<ColumnDef[]>([{ key: '', label: '' }])

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (filterEntityType) params.entityType = filterEntityType
      const res = await apiClient.getList<ExportTemplateLocal>('/api/v1/settings/export-templates', params)
      setItems(res.data)
      setPagination(res.pagination)
    } catch {
      toast({ title: tc('error'), description: t('exportLoadError'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, filterEntityType, toast, t, tc])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openCreate = () => {
    setEditing(null)
    reset({ entityType: filterEntityType || '', name: '', fileFormat: 'XLSX', isDefault: false })
    setColumns([{ key: '', label: '' }])
    setDialogOpen(true)
  }

  const openEdit = (row: ExportTemplateLocal) => {
    setEditing(row)
    reset({ entityType: row.entityType, name: row.name, fileFormat: row.fileFormat as 'XLSX' | 'CSV', isDefault: row.isDefault })
    setColumns(row.columns as ColumnDef[])
    setDialogOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    const validColumns = columns.filter((c) => c.key && c.label)
    if (validColumns.length === 0) {
      toast({ title: tc('error'), description: t('minOneColumn'), variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const payload = { ...data, columns: validColumns }
      if (editing) {
        await apiClient.put(`/api/v1/settings/export-templates/${editing.id}`, payload)
      } else {
        await apiClient.post('/api/v1/settings/export-templates', payload)
      }
      toast({ title: tc('success'), description: t('exportSaved') })
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
      await apiClient.delete(`/api/v1/settings/export-templates/${deleteTarget.id}`)
      toast({ title: tc('success'), description: t('exportDeleted') })
      setDeleteTarget(null)
      fetchItems()
    } catch {
      toast({ title: tc('error'), description: t('deleteError'), variant: 'destructive' })
    }
  }

  const tableColumns: DataTableColumn<ExportTemplateLocal>[] = [
    { key: 'entityType', header: t('entity'), render: (row) => <span className="text-xs font-medium">{row.entityType}</span> },
    { key: 'name', header: t('name') },
    { key: 'columns', header: t('columns'), render: (row) => t('columnCount', { count: (row.columns as ColumnDef[]).length }) },
    { key: 'fileFormat', header: t('formatLabel'), render: (row) => row.fileFormat },
    {
      key: 'isDefault', header: t('default'),
      render: (row) => row.isDefault ? (
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{t('default')}</span>
      ) : '-',
    },
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
        title={t('exportTitle')}
        description={t('exportDesc')}
        actions={<Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> {t('addTemplate')}</Button>}
      />

      <div className="flex items-center gap-3">
        <Label className="text-sm">{t('entityFilter')}</Label>
        <Select value={filterEntityType} onValueChange={(v) => { setFilterEntityType(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t('entityAll')} /></SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map((et) => <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable<ExportTemplateLocal>
        columns={tableColumns}
        data={items}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage={t('noExportTemplates')}
        rowKey={(row) => row.id}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('editTemplate') : t('addTemplate')}</DialogTitle>
            <DialogDescription>{t('exportDialogDesc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('entityType')}</Label>
                <Select value={watch('entityType')} onValueChange={(v) => setValue('entityType', v)} disabled={!!editing}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.filter((et) => et.value).map((et) => <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('name')}</Label>
                <Input {...register('name')} placeholder={t('defaultEmployeeList')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('fileFormat')}</Label>
                <Select value={watch('fileFormat')} onValueChange={(v) => setValue('fileFormat', v as 'XLSX' | 'CSV')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XLSX">XLSX</SelectItem>
                    <SelectItem value="CSV">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center gap-2">
                  <Switch checked={watch('isDefault')} onCheckedChange={(v) => setValue('isDefault', v)} />
                  <Label>{t('defaultTemplate')}</Label>
                </div>
              </div>
            </div>

            {/* Columns editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('columns')}</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setColumns((prev) => [...prev, { key: '', label: '' }])}>
                  <Plus className="mr-1 h-4 w-4" /> {t('addColumn')}
                </Button>
              </div>
              {columns.map((col, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={col.key}
                    onChange={(e) => {
                      const next = [...columns]
                      next[i] = { ...next[i], key: e.target.value }
                      setColumns(next)
                    }}
                    placeholder={t('columnKeyPlaceholder')}
                    className="w-32"
                  />
                  <Input
                    value={col.label}
                    onChange={(e) => {
                      const next = [...columns]
                      next[i] = { ...next[i], label: e.target.value }
                      setColumns(next)
                    }}
                    placeholder={t('columnLabelPlaceholder')}
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setColumns((prev) => prev.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
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

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('exportDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot; {t('exportDeleteConfirm', { name: '' })}
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
