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

const ENUM_GROUPS = [
  { value: '', label: '전체' },
  { value: 'EMPLOYMENT_TYPE', label: '고용유형' },
  { value: 'EMPLOYMENT_STATUS', label: '재직상태' },
  { value: 'LEAVE_TYPE', label: '휴가유형' },
  { value: 'DEPARTMENT_TYPE', label: '부서유형' },
  { value: 'POSITION_TYPE', label: '직책유형' },
  { value: 'SKILL_LEVEL', label: '스킬레벨' },
  { value: 'DOCUMENT_TYPE', label: '문서유형' },
]

const createSchema = z.object({
  enumGroup: z.string().min(1, 'ENUM 그룹은 필수입니다'),
  optionKey: z.string().min(1, '옵션 키는 필수입니다'),
  label: z.string().min(1, '라벨은 필수입니다'),
  color: z.string().optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int(),
})

const updateSchema = z.object({
  label: z.string().min(1, '라벨은 필수입니다'),
  color: z.string().optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
})

type CreateFormData = z.infer<typeof createSchema>
type UpdateFormData = z.infer<typeof updateSchema>

export function EnumManagementClient({ user: _user }: { user: SessionUser }) {
  const { toast } = useToast()
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
      toast({ title: '오류', description: 'ENUM 목록을 불러올 수 없습니다.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, filterGroup, toast])

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
      toast({ title: '성공', description: 'ENUM 옵션이 추가되었습니다.' })
      setDialogOpen(false)
      fetchItems()
    } catch {
      toast({ title: '오류', description: '저장 중 오류가 발생했습니다.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const onUpdateSubmit = async (data: UpdateFormData) => {
    if (!editing) return
    setSaving(true)
    try {
      await apiClient.put(`/api/v1/settings/enums/${editing.id}`, data)
      toast({ title: '성공', description: 'ENUM 옵션이 수정되었습니다.' })
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
      await apiClient.delete(`/api/v1/settings/enums/${deleteTarget.id}`)
      toast({ title: '성공', description: 'ENUM 옵션이 삭제되었습니다.' })
      setDeleteTarget(null)
      fetchItems()
    } catch {
      toast({ title: '오류', description: '삭제 중 오류가 발생했습니다.', variant: 'destructive' })
    }
  }

  const columns: DataTableColumn<EnumOptionLocal>[] = [
    { key: 'enumGroup', header: '그룹', render: (row) => <span className="font-mono text-xs">{row.enumGroup}</span> },
    { key: 'optionKey', header: '키', render: (row) => <span className="font-mono text-xs">{row.optionKey}</span> },
    { key: 'label', header: '라벨' },
    {
      key: 'color', header: '색상',
      render: (row) => row.color ? (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded" style={{ backgroundColor: row.color }} />
          <span className="text-xs">{row.color}</span>
        </div>
      ) : '-',
    },
    { key: 'sortOrder', header: '순서', render: (row) => row.sortOrder },
    {
      key: 'isActive', header: '활성',
      render: (row) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {row.isActive ? '활성' : '비활성'}
        </span>
      ),
    },
    {
      key: 'actions', header: '관리',
      render: (row) => row.isSystem ? (
        <span className="text-xs text-muted-foreground">시스템</span>
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
        title="ENUM 관리"
        description="시스템에서 사용하는 열거형 옵션을 관리합니다."
        actions={<Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> 옵션 추가</Button>}
      />

      <div className="flex items-center gap-3">
        <Label className="text-sm">그룹 필터:</Label>
        <Select value={filterGroup} onValueChange={(v) => { setFilterGroup(v); setPage(1) }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="전체" /></SelectTrigger>
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
        emptyMessage="등록된 ENUM 옵션이 없습니다."
        rowKey={(row) => row.id}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'ENUM 옵션 수정' : 'ENUM 옵션 추가'}</DialogTitle>
            <DialogDescription>열거형 옵션을 설정합니다.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>라벨</Label>
                <Input {...updateForm.register('label')} />
                {updateForm.formState.errors.label && <p className="text-xs text-destructive">{updateForm.formState.errors.label.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>색상</Label>
                  <Input {...updateForm.register('color')} placeholder="#FF0000" />
                </div>
                <div className="space-y-2">
                  <Label>순서</Label>
                  <Input type="number" {...updateForm.register('sortOrder')} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={updateForm.watch('isActive')}
                  onCheckedChange={(v) => updateForm.setValue('isActive', v)}
                />
                <Label>활성</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}수정
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>ENUM 그룹</Label>
                <Select value={createForm.watch('enumGroup')} onValueChange={(v) => createForm.setValue('enumGroup', v)}>
                  <SelectTrigger><SelectValue placeholder="그룹 선택" /></SelectTrigger>
                  <SelectContent>
                    {ENUM_GROUPS.filter((g) => g.value).map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>옵션 키</Label>
                  <Input {...createForm.register('optionKey')} placeholder="FULL_TIME" />
                </div>
                <div className="space-y-2">
                  <Label>라벨</Label>
                  <Input {...createForm.register('label')} placeholder="정규직" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>색상</Label>
                  <Input {...createForm.register('color')} placeholder="#2563EB" />
                </div>
                <div className="space-y-2">
                  <Label>순서</Label>
                  <Input type="number" {...createForm.register('sortOrder')} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}추가
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ENUM 옵션 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.label}&quot; 옵션을 삭제하시겠습니까?
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
