'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Custom Fields Client
// 커스텀 필드: entityType 탭 + DataTable + Dialog
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

interface CustomFieldLocal {
  [key: string]: unknown
  id: string
  entityType: string
  fieldKey: string
  fieldLabel: string
  fieldType: string
  options: unknown
  isRequired: boolean
  isSearchable: boolean
  isVisibleToEmployee: boolean
  sortOrder: number
  sectionLabel: string
}

const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'FILE'] as const

export function CustomFieldsClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const { toast } = useToast()

  const ENTITY_TYPES = [
    { value: '', label: t('entityAll') },
    { value: 'EMPLOYEE', label: t('entityEmployee') },
    { value: 'DEPARTMENT', label: t('entityDepartment') },
    { value: 'LEAVE', label: t('entityLeave') },
    { value: 'ATTENDANCE', label: t('entityAttendance') },
    { value: 'PERFORMANCE', label: t('entityPerformance') },
  ]

  const formSchema = z.object({
    entityType: z.string().min(1, t('entityTypeRequired')),
    fieldKey: z.string().min(1, t('fieldKeyRequired')),
    fieldLabel: z.string().min(1, t('fieldLabelRequired')),
    fieldType: z.enum(FIELD_TYPES),
    isRequired: z.boolean(),
    isSearchable: z.boolean(),
    isVisibleToEmployee: z.boolean(),
    sortOrder: z.number().int(),
    sectionLabel: z.string().optional(),
  })

  type FormData = z.infer<typeof formSchema>

  const [items, setItems] = useState<CustomFieldLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [filterEntityType, setFilterEntityType] = useState('')
  const [pagination, setPagination] = useState<PaginationInfo | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CustomFieldLocal | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomFieldLocal | null>(null)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (filterEntityType) params.entityType = filterEntityType
      const res = await apiClient.getList<CustomFieldLocal>('/api/v1/settings/custom-fields', params)
      setItems(res.data)
      setPagination(res.pagination)
    } catch {
      toast({ title: tc('error'), description: t('customFieldLoadError'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, filterEntityType, toast, t, tc])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openCreate = () => {
    setEditing(null)
    reset({ entityType: filterEntityType || '', fieldKey: '', fieldLabel: '', fieldType: 'TEXT', isRequired: false, isSearchable: false, isVisibleToEmployee: true, sortOrder: 0, sectionLabel: '' })
    setDialogOpen(true)
  }

  const openEdit = (row: CustomFieldLocal) => {
    setEditing(row)
    reset({
      entityType: row.entityType, fieldKey: row.fieldKey, fieldLabel: row.fieldLabel,
      fieldType: row.fieldType as typeof FIELD_TYPES[number],
      isRequired: row.isRequired, isSearchable: row.isSearchable,
      isVisibleToEmployee: row.isVisibleToEmployee, sortOrder: row.sortOrder,
      sectionLabel: row.sectionLabel,
    })
    setDialogOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      if (editing) {
        await apiClient.put(`/api/v1/settings/custom-fields/${editing.id}`, {
          fieldLabel: data.fieldLabel, fieldType: data.fieldType,
          isRequired: data.isRequired, isSearchable: data.isSearchable,
          isVisibleToEmployee: data.isVisibleToEmployee, sortOrder: data.sortOrder,
          sectionLabel: data.sectionLabel,
        })
      } else {
        await apiClient.post('/api/v1/settings/custom-fields', data)
      }
      toast({ title: tc('success'), description: t('customFieldSaved') })
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
      await apiClient.delete(`/api/v1/settings/custom-fields/${deleteTarget.id}`)
      toast({ title: tc('success'), description: t('customFieldDeleted') })
      setDeleteTarget(null)
      fetchItems()
    } catch {
      toast({ title: tc('error'), description: t('deleteError'), variant: 'destructive' })
    }
  }

  const columns: DataTableColumn<CustomFieldLocal>[] = [
    { key: 'entityType', header: t('entity'), render: (row) => <span className="text-xs font-medium">{row.entityType}</span> },
    { key: 'fieldKey', header: t('fieldKey'), render: (row) => <span className="font-mono text-xs">{row.fieldKey}</span> },
    { key: 'fieldLabel', header: tc('label') },
    { key: 'fieldType', header: t('fieldType'), render: (row) => <span className="text-xs">{row.fieldType}</span> },
    {
      key: 'flags', header: t('attributes'),
      render: (row) => (
        <div className="flex gap-1">
          {row.isRequired && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">{t('required')}</span>}
          {row.isSearchable && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">{t('searchable')}</span>}
        </div>
      ),
    },
    { key: 'sortOrder', header: t('sortOrder'), render: (row) => row.sortOrder },
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
        title={t('customFieldsTitle')}
        description={t('customFieldsDesc')}
        actions={<Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> {t('addField')}</Button>}
      />

      <div className="flex items-center gap-3">
        <Label className="text-sm">{t('entityTypeFilter')}</Label>
        <Select value={filterEntityType} onValueChange={(v) => { setFilterEntityType(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t('entityAll')} /></SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map((et) => (
              <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable<CustomFieldLocal>
        columns={columns}
        data={items}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage={t('noCustomFields')}
        rowKey={(row) => row.id}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t('editCustomField') : t('addCustomField')}</DialogTitle>
            <DialogDescription>{t('customFieldDialogDesc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('entityType')}</Label>
                <Select value={watch('entityType')} onValueChange={(v) => setValue('entityType', v)} disabled={!!editing}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.filter((et) => et.value).map((et) => (
                      <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('fieldKey')}</Label>
                <Input {...register('fieldKey')} placeholder={t('fieldKeyPlaceholder')} disabled={!!editing} />
                {errors.fieldKey && <p className="text-xs text-destructive">{errors.fieldKey.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('fieldLabel')}</Label>
                <Input {...register('fieldLabel')} placeholder={t('fieldLabelPlaceholder')} />
                {errors.fieldLabel && <p className="text-xs text-destructive">{errors.fieldLabel.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('fieldType')}</Label>
                <Select value={watch('fieldType')} onValueChange={(v) => setValue('fieldType', v as typeof FIELD_TYPES[number])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((ft) => <SelectItem key={ft} value={ft}>{ft}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('sectionLabel')}</Label>
                <Input {...register('sectionLabel')} placeholder={t('sectionLabelPlaceholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t('sortOrder')}</Label>
                <Input type="number" {...register('sortOrder')} />
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={watch('isRequired')} onCheckedChange={(v) => setValue('isRequired', v)} />
                <Label>{t('isRequired')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={watch('isSearchable')} onCheckedChange={(v) => setValue('isSearchable', v)} />
                <Label>{t('isSearchable')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={watch('isVisibleToEmployee')} onCheckedChange={(v) => setValue('isVisibleToEmployee', v)} />
                <Label>{t('visibleToEmployee')}</Label>
              </div>
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
            <AlertDialogTitle>{t('customFieldDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.fieldLabel}&quot; {t('customFieldDeleteConfirm', { label: '' })}
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
