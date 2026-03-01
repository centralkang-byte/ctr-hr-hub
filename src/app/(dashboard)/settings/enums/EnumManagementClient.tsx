'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Enum Management Client
// ENUM 관리: enumGroup 셀렉터 + DataTable + Dialog
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

interface EnumOptionLocal {
  [key: string]: unknown
  id: string
  enumGroup: string
  optionKey: string
  label: string
  color: string | null
  icon: string | null
  sortOrder: number
  isSystem: boolean
  isActive: boolean
}

export function EnumManagementClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const { toast } = useToast()

  const ENUM_GROUPS = [
    { value: '', label: t('groupAll') },
    { value: 'EMPLOYMENT_TYPE', label: t('groupEmploymentType') },
    { value: 'EMPLOYMENT_STATUS', label: t('groupEmploymentStatus') },
    { value: 'LEAVE_TYPE', label: t('groupLeaveType') },
    { value: 'DEPARTMENT_TYPE', label: t('groupDepartmentType') },
    { value: 'POSITION_TYPE', label: t('groupPositionType') },
    { value: 'SKILL_LEVEL', label: t('groupSkillLevel') },
    { value: 'DOCUMENT_TYPE', label: t('groupDocumentType') },
  ]

  const createSchema = z.object({
    enumGroup: z.string().min(1, t('enumGroupRequired')),
    optionKey: z.string().min(1, t('optionKeyRequired')),
    label: z.string().min(1, t('labelRequired')),
    color: z.string().optional(),
    icon: z.string().optional(),
    sortOrder: z.number().int(),
  })

  const updateSchema = z.object({
    label: z.string().min(1, t('labelRequired')),
    color: z.string().optional(),
    icon: z.string().optional(),
    sortOrder: z.number().int(),
    isActive: z.boolean(),
  })

  type CreateFormData = z.infer<typeof createSchema>
  type UpdateFormData = z.infer<typeof updateSchema>

  const [items, setItems] = useState<EnumOptionLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [filterGroup, setFilterGroup] = useState('')
  const [pagination, setPagination] = useState<PaginationInfo | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EnumOptionLocal | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EnumOptionLocal | null>(null)

  const createForm = useForm<CreateFormData>({ resolver: zodResolver(createSchema) })
  const updateForm = useForm<UpdateFormData>({ resolver: zodResolver(updateSchema) })

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (filterGroup) params.enumGroup = filterGroup
      const res = await apiClient.getList<EnumOptionLocal>('/api/v1/settings/enums', params)
      setItems(res.data)
      setPagination(res.pagination)
    } catch {
      toast({ title: tc('error'), description: t('enumLoadError'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, filterGroup, toast, t, tc])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openCreate = () => {
    setEditing(null)
    createForm.reset({ enumGroup: filterGroup || '', optionKey: '', label: '', color: '', icon: '', sortOrder: 0 })
    setDialogOpen(true)
  }

  const openEdit = (row: EnumOptionLocal) => {
    setEditing(row)
    updateForm.reset({ label: row.label, color: row.color ?? '', icon: row.icon ?? '', sortOrder: row.sortOrder, isActive: row.isActive })
    setDialogOpen(true)
  }

  const onCreateSubmit = async (data: CreateFormData) => {
    setSaving(true)
    try {
      await apiClient.post('/api/v1/settings/enums', data)
      toast({ title: tc('success'), description: t('enumAdded') })
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
      await apiClient.put(`/api/v1/settings/enums/${editing.id}`, data)
      toast({ title: tc('success'), description: t('enumUpdated') })
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
      await apiClient.delete(`/api/v1/settings/enums/${deleteTarget.id}`)
      toast({ title: tc('success'), description: t('enumDeleted') })
      setDeleteTarget(null)
      fetchItems()
    } catch {
      toast({ title: tc('error'), description: t('deleteError'), variant: 'destructive' })
    }
  }

  const columns: DataTableColumn<EnumOptionLocal>[] = [
    { key: 'enumGroup', header: t('enumGroup'), render: (row) => <span className="font-mono text-xs">{row.enumGroup}</span> },
    { key: 'optionKey', header: t('optionKey'), render: (row) => <span className="font-mono text-xs">{row.optionKey}</span> },
    { key: 'label', header: tc('label') },
    {
      key: 'color', header: t('color'),
      render: (row) => row.color ? (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded" style={{ backgroundColor: row.color }} />
          <span className="text-xs">{row.color}</span>
        </div>
      ) : '-',
    },
    { key: 'sortOrder', header: t('sortOrder'), render: (row) => row.sortOrder },
    {
      key: 'isActive', header: t('active'),
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
        title={t('enumTitle')}
        description={t('enumDesc')}
        actions={<Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> {t('addOption')}</Button>}
      />

      <div className="flex items-center gap-3">
        <Label className="text-sm">{t('groupFilter')}</Label>
        <Select value={filterGroup} onValueChange={(v) => { setFilterGroup(v); setPage(1) }}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t('groupAll')} /></SelectTrigger>
          <SelectContent>
            {ENUM_GROUPS.map((g) => (
              <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable<EnumOptionLocal>
        columns={columns}
        data={items}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage={t('noEnums')}
        rowKey={(row) => row.id}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('editEnumOption') : t('addEnumOption')}</DialogTitle>
            <DialogDescription>{t('enumDialogDesc')}</DialogDescription>
          </DialogHeader>
          {editing ? (
            <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>{tc('label')}</Label>
                <Input {...updateForm.register('label')} />
                {updateForm.formState.errors.label && <p className="text-xs text-destructive">{updateForm.formState.errors.label.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('color')}</Label>
                  <Input {...updateForm.register('color')} placeholder="#FF0000" />
                </div>
                <div className="space-y-2">
                  <Label>{t('sortOrder')}</Label>
                  <Input type="number" {...updateForm.register('sortOrder')} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={updateForm.watch('isActive')}
                  onCheckedChange={(v) => updateForm.setValue('isActive', v)}
                />
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
              <div className="space-y-2">
                <Label>{t('enumGroupLabel')}</Label>
                <Select value={createForm.watch('enumGroup')} onValueChange={(v) => createForm.setValue('enumGroup', v)}>
                  <SelectTrigger><SelectValue placeholder={t('selectGroup')} /></SelectTrigger>
                  <SelectContent>
                    {ENUM_GROUPS.filter((g) => g.value).map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('optionKey')}</Label>
                  <Input {...createForm.register('optionKey')} placeholder={t('optionKeyPlaceholder')} />
                </div>
                <div className="space-y-2">
                  <Label>{tc('label')}</Label>
                  <Input {...createForm.register('label')} placeholder={t('labelPlaceholder')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('color')}</Label>
                  <Input {...createForm.register('color')} placeholder={t('colorPlaceholder')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('sortOrder')}</Label>
                  <Input type="number" {...createForm.register('sortOrder')} />
                </div>
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
            <AlertDialogTitle>{t('enumDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.label}&quot; {t('enumDeleteConfirm', { label: '' })}
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
