'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Workflows Client
// 워크플로 빌더: DataTable + steps 동적 편집 Dialog
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Loader2, GripVertical } from 'lucide-react'
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

interface WorkflowStep {
  id?: string
  stepOrder: number
  approverType: string
  approverRoleId: string | null
  approverEmployeeId: string | null
  autoApproveAfterHours: number | null
  canSkip: boolean
}

interface WorkflowRuleLocal {
  [key: string]: unknown
  id: string
  workflowType: string
  name: string
  totalSteps: number
  isActive: boolean
  conditions: unknown
  steps: WorkflowStep[]
  createdAt: string
}

const stepSchema = z.object({
  stepOrder: z.number().int().positive(),
  approverType: z.enum(['DIRECT_MANAGER', 'DEPARTMENT_HEAD', 'HR_ADMIN', 'SPECIFIC_ROLE', 'SPECIFIC_EMPLOYEE']),
  approverRoleId: z.string().nullable().optional(),
  approverEmployeeId: z.string().nullable().optional(),
  autoApproveAfterHours: z.number().int().positive().nullable().optional(),
  canSkip: z.boolean(),
})

const formSchema = z.object({
  workflowType: z.string().min(1),
  name: z.string().min(1),
  isActive: z.boolean(),
  steps: z.array(stepSchema).min(1),
})

type FormData = z.infer<typeof formSchema>

export function WorkflowsClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const { toast } = useToast()

  const WORKFLOW_TYPES = [
    { value: '', label: t('typeAll') },
    { value: 'LEAVE_APPROVAL', label: t('typeLeaveApproval') },
    { value: 'OVERTIME_APPROVAL', label: t('typeOvertimeApproval') },
    { value: 'EXPENSE_APPROVAL', label: t('typeExpenseApproval') },
    { value: 'PROFILE_CHANGE', label: t('typeProfileChange') },
    { value: 'SALARY_CHANGE', label: t('typeSalaryChange') },
  ]

  const APPROVER_TYPES = [
    { value: 'DIRECT_MANAGER', label: t('approverDirectManager') },
    { value: 'DEPARTMENT_HEAD', label: t('approverDeptHead') },
    { value: 'HR_ADMIN', label: t('approverHrAdmin') },
    { value: 'SPECIFIC_ROLE', label: t('approverSpecificRole') },
    { value: 'SPECIFIC_EMPLOYEE', label: t('approverSpecificEmployee') },
  ]

  const [items, setItems] = useState<WorkflowRuleLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [filterType, setFilterType] = useState('')
  const [pagination, setPagination] = useState<PaginationInfo | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WorkflowRuleLocal | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WorkflowRuleLocal | null>(null)

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { steps: [{ stepOrder: 1, approverType: 'DIRECT_MANAGER', canSkip: false }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'steps' })

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (filterType) params.workflowType = filterType
      const res = await apiClient.getList<WorkflowRuleLocal>('/api/v1/settings/workflows', params)
      setItems(res.data)
      setPagination(res.pagination)
    } catch {
      toast({ title: tc('error'), description: t('workflowLoadError'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, filterType, toast, t, tc])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openCreate = () => {
    setEditing(null)
    reset({
      workflowType: '', name: '', isActive: true,
      steps: [{ stepOrder: 1, approverType: 'DIRECT_MANAGER', canSkip: false }],
    })
    setDialogOpen(true)
  }

  const openEdit = (row: WorkflowRuleLocal) => {
    setEditing(row)
    reset({
      workflowType: row.workflowType,
      name: row.name,
      isActive: row.isActive,
      steps: row.steps.map((s) => ({
        stepOrder: s.stepOrder,
        approverType: s.approverType as FormData['steps'][0]['approverType'],
        approverRoleId: s.approverRoleId,
        approverEmployeeId: s.approverEmployeeId,
        autoApproveAfterHours: s.autoApproveAfterHours,
        canSkip: s.canSkip,
      })),
    })
    setDialogOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      const payload = {
        ...data,
        steps: data.steps.map((s, i) => ({ ...s, stepOrder: i + 1 })),
      }
      if (editing) {
        await apiClient.put(`/api/v1/settings/workflows/${editing.id}`, payload)
      } else {
        await apiClient.post('/api/v1/settings/workflows', payload)
      }
      toast({ title: tc('success'), description: t('workflowSaved') })
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
      await apiClient.delete(`/api/v1/settings/workflows/${deleteTarget.id}`)
      toast({ title: tc('success'), description: t('workflowDeleted') })
      setDeleteTarget(null)
      fetchItems()
    } catch {
      toast({ title: tc('error'), description: t('deleteError'), variant: 'destructive' })
    }
  }

  const columns: DataTableColumn<WorkflowRuleLocal>[] = [
    {
      key: 'workflowType', header: t('workflowType'),
      render: (row) => WORKFLOW_TYPES.find((wt) => wt.value === row.workflowType)?.label ?? row.workflowType,
    },
    { key: 'name', header: t('workflowName') },
    { key: 'totalSteps', header: t('stepCount', { count: '' }), render: (row) => t('stepCount', { count: row.totalSteps }) },
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
        title={t('workflowsTitle')}
        description={t('workflowsDesc')}
        actions={<Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> {t('addWorkflow')}</Button>}
      />

      <div className="flex items-center gap-3">
        <Label className="text-sm">{t('typeFilter')}</Label>
        <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1) }}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t('typeAll')} /></SelectTrigger>
          <SelectContent>
            {WORKFLOW_TYPES.map((wt) => (
              <SelectItem key={wt.value} value={wt.value}>{wt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable<WorkflowRuleLocal>
        columns={columns}
        data={items}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage={t('noWorkflows')}
        rowKey={(row) => row.id}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('editWorkflow') : t('addWorkflow')}</DialogTitle>
            <DialogDescription>{t('workflowDialogDesc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('workflowType')}</Label>
                <Select value={watch('workflowType')} onValueChange={(v) => setValue('workflowType', v)} disabled={!!editing}>
                  <SelectTrigger><SelectValue placeholder={t('selectType')} /></SelectTrigger>
                  <SelectContent>
                    {WORKFLOW_TYPES.filter((wt) => wt.value).map((wt) => (
                      <SelectItem key={wt.value} value={wt.value}>{wt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.workflowType && <p className="text-xs text-destructive">{errors.workflowType.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('name')}</Label>
                <Input {...register('name')} placeholder={t('defaultLeaveApproval')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={watch('isActive')} onCheckedChange={(v) => setValue('isActive', v)} />
              <Label>{t('active')}</Label>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t('approvalSteps')}</Label>
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => append({ stepOrder: fields.length + 1, approverType: 'DIRECT_MANAGER', canSkip: false })}
                >
                  <Plus className="mr-1 h-4 w-4" /> {t('addStep')}
                </Button>
              </div>
              {errors.steps && <p className="text-xs text-destructive">{typeof errors.steps.message === 'string' ? errors.steps.message : ''}</p>}

              {fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <GripVertical className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t('stepNumber', { index: index + 1 })}</span>
                      {fields.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{t('approverType')}</Label>
                        <Select
                          value={watch(`steps.${index}.approverType`)}
                          onValueChange={(v) => setValue(`steps.${index}.approverType`, v as FormData['steps'][0]['approverType'])}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {APPROVER_TYPES.map((at) => (
                              <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('autoApproveHours')}</Label>
                        <Input
                          type="number"
                          className="h-8 text-xs"
                          {...register(`steps.${index}.autoApproveAfterHours`)}
                          placeholder={t('notSet')}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={watch(`steps.${index}.canSkip`)}
                        onCheckedChange={(v) => setValue(`steps.${index}.canSkip`, v)}
                      />
                      <Label className="text-xs">{t('canSkip')}</Label>
                    </div>
                  </div>
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
            <AlertDialogTitle>{t('workflowDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot; {t('workflowDeleteConfirm', { name: '' })}
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
