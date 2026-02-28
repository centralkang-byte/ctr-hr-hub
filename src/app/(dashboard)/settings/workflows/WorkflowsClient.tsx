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

const WORKFLOW_TYPES = [
  { value: '', label: '전체' },
  { value: 'LEAVE_APPROVAL', label: '휴가 승인' },
  { value: 'OVERTIME_APPROVAL', label: '초과근무 승인' },
  { value: 'EXPENSE_APPROVAL', label: '경비 승인' },
  { value: 'PROFILE_CHANGE', label: '정보변경 승인' },
  { value: 'SALARY_CHANGE', label: '급여변경 승인' },
]

const APPROVER_TYPES = [
  { value: 'DIRECT_MANAGER', label: '직속 상사' },
  { value: 'DEPARTMENT_HEAD', label: '부서장' },
  { value: 'HR_ADMIN', label: 'HR 관리자' },
  { value: 'SPECIFIC_ROLE', label: '특정 역할' },
  { value: 'SPECIFIC_EMPLOYEE', label: '특정 사원' },
]

const stepSchema = z.object({
  stepOrder: z.number().int().positive(),
  approverType: z.enum(['DIRECT_MANAGER', 'DEPARTMENT_HEAD', 'HR_ADMIN', 'SPECIFIC_ROLE', 'SPECIFIC_EMPLOYEE']),
  approverRoleId: z.string().nullable().optional(),
  approverEmployeeId: z.string().nullable().optional(),
  autoApproveAfterHours: z.number().int().positive().nullable().optional(),
  canSkip: z.boolean(),
})

const formSchema = z.object({
  workflowType: z.string().min(1, '워크플로 유형은 필수입니다'),
  name: z.string().min(1, '이름은 필수입니다'),
  isActive: z.boolean(),
  steps: z.array(stepSchema).min(1, '최소 1개의 단계가 필요합니다'),
})

type FormData = z.infer<typeof formSchema>

export function WorkflowsClient({ user: _user }: { user: SessionUser }) {
  const { toast } = useToast()
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
      toast({ title: '오류', description: '워크플로 목록을 불러올 수 없습니다.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, filterType, toast])

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
      toast({ title: '성공', description: '워크플로가 저장되었습니다.' })
      setDialogOpen(false)
      fetchItems()
    } catch {
      toast({ title: '오류', description: '저장 중 오류가 발생했습니다.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await apiClient.delete(`/api/v1/settings/workflows/${deleteTarget.id}`)
      toast({ title: '성공', description: '워크플로가 삭제되었습니다.' })
      setDeleteTarget(null)
      fetchItems()
    } catch {
      toast({ title: '오류', description: '삭제 중 오류가 발생했습니다.', variant: 'destructive' })
    }
  }

  const columns: DataTableColumn<WorkflowRuleLocal>[] = [
    {
      key: 'workflowType', header: '유형',
      render: (row) => WORKFLOW_TYPES.find((t) => t.value === row.workflowType)?.label ?? row.workflowType,
    },
    { key: 'name', header: '이름' },
    { key: 'totalSteps', header: '단계 수', render: (row) => `${row.totalSteps}단계` },
    {
      key: 'isActive', header: '상태',
      render: (row) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {row.isActive ? '활성' : '비활성'}
        </span>
      ),
    },
    {
      key: 'actions', header: '관리',
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
        title="워크플로 빌더"
        description="승인 워크플로를 구성합니다."
        actions={<Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> 워크플로 추가</Button>}
      />

      <div className="flex items-center gap-3">
        <Label className="text-sm">유형 필터:</Label>
        <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1) }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="전체" /></SelectTrigger>
          <SelectContent>
            {WORKFLOW_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
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
        emptyMessage="등록된 워크플로가 없습니다."
        rowKey={(row) => row.id}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? '워크플로 수정' : '워크플로 추가'}</DialogTitle>
            <DialogDescription>승인 단계를 구성합니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>워크플로 유형</Label>
                <Select value={watch('workflowType')} onValueChange={(v) => setValue('workflowType', v)} disabled={!!editing}>
                  <SelectTrigger><SelectValue placeholder="유형 선택" /></SelectTrigger>
                  <SelectContent>
                    {WORKFLOW_TYPES.filter((t) => t.value).map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.workflowType && <p className="text-xs text-destructive">{errors.workflowType.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>이름</Label>
                <Input {...register('name')} placeholder="기본 휴가 승인" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={watch('isActive')} onCheckedChange={(v) => setValue('isActive', v)} />
              <Label>활성</Label>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">승인 단계</Label>
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => append({ stepOrder: fields.length + 1, approverType: 'DIRECT_MANAGER', canSkip: false })}
                >
                  <Plus className="mr-1 h-4 w-4" /> 단계 추가
                </Button>
              </div>
              {errors.steps && <p className="text-xs text-destructive">{typeof errors.steps.message === 'string' ? errors.steps.message : ''}</p>}

              {fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <GripVertical className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">단계 {index + 1}</span>
                      {fields.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">승인자 유형</Label>
                        <Select
                          value={watch(`steps.${index}.approverType`)}
                          onValueChange={(v) => setValue(`steps.${index}.approverType`, v as FormData['steps'][0]['approverType'])}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {APPROVER_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">자동승인 (시간)</Label>
                        <Input
                          type="number"
                          className="h-8 text-xs"
                          {...register(`steps.${index}.autoApproveAfterHours`)}
                          placeholder="미설정"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={watch(`steps.${index}.canSkip`)}
                        onCheckedChange={(v) => setValue(`steps.${index}.canSkip`, v)}
                      />
                      <Label className="text-xs">건너뛰기 가능</Label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? '수정' : '추가'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>워크플로 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot; 워크플로를 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
