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

const ENTITY_TYPES = [
  { value: '', label: '전체' },
  { value: 'EMPLOYEE', label: '사원' },
  { value: 'DEPARTMENT', label: '부서' },
  { value: 'LEAVE', label: '휴가' },
  { value: 'ATTENDANCE', label: '근태' },
  { value: 'PERFORMANCE', label: '성과' },
]

const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'FILE'] as const

const formSchema = z.object({
  entityType: z.string().min(1, '엔티티 유형은 필수입니다'),
  fieldKey: z.string().min(1, '필드 키는 필수입니다'),
  fieldLabel: z.string().min(1, '필드 라벨은 필수입니다'),
  fieldType: z.enum(FIELD_TYPES),
  isRequired: z.boolean(),
  isSearchable: z.boolean(),
  isVisibleToEmployee: z.boolean(),
  sortOrder: z.number().int(),
  sectionLabel: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export function CustomFieldsClient({ user: _user }: { user: SessionUser }) {
  const { toast } = useToast()
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
      toast({ title: '오류', description: '커스텀 필드 목록을 불러올 수 없습니다.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, filterEntityType, toast])

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
      toast({ title: '성공', description: '커스텀 필드가 저장되었습니다.' })
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
      await apiClient.delete(`/api/v1/settings/custom-fields/${deleteTarget.id}`)
      toast({ title: '성공', description: '커스텀 필드가 삭제되었습니다.' })
      setDeleteTarget(null)
      fetchItems()
    } catch {
      toast({ title: '오류', description: '삭제 중 오류가 발생했습니다.', variant: 'destructive' })
    }
  }

  const columns: DataTableColumn<CustomFieldLocal>[] = [
    { key: 'entityType', header: '엔티티', render: (row) => <span className="text-xs font-medium">{row.entityType}</span> },
    { key: 'fieldKey', header: '필드 키', render: (row) => <span className="font-mono text-xs">{row.fieldKey}</span> },
    { key: 'fieldLabel', header: '라벨' },
    { key: 'fieldType', header: '유형', render: (row) => <span className="text-xs">{row.fieldType}</span> },
    {
      key: 'flags', header: '속성',
      render: (row) => (
        <div className="flex gap-1">
          {row.isRequired && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">필수</span>}
          {row.isSearchable && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">검색</span>}
        </div>
      ),
    },
    { key: 'sortOrder', header: '순서', render: (row) => row.sortOrder },
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
        title="커스텀 필드"
        description="엔티티별 커스텀 필드를 관리합니다."
        actions={<Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> 필드 추가</Button>}
      />

      <div className="flex items-center gap-3">
        <Label className="text-sm">엔티티 유형:</Label>
        <Select value={filterEntityType} onValueChange={(v) => { setFilterEntityType(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="전체" /></SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
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
        emptyMessage="등록된 커스텀 필드가 없습니다."
        rowKey={(row) => row.id}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '커스텀 필드 수정' : '커스텀 필드 추가'}</DialogTitle>
            <DialogDescription>커스텀 필드 정보를 입력합니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>엔티티 유형</Label>
                <Select value={watch('entityType')} onValueChange={(v) => setValue('entityType', v)} disabled={!!editing}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.filter((t) => t.value).map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>필드 키</Label>
                <Input {...register('fieldKey')} placeholder="custom_field_1" disabled={!!editing} />
                {errors.fieldKey && <p className="text-xs text-destructive">{errors.fieldKey.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>필드 라벨</Label>
                <Input {...register('fieldLabel')} placeholder="추가 정보" />
                {errors.fieldLabel && <p className="text-xs text-destructive">{errors.fieldLabel.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>필드 유형</Label>
                <Select value={watch('fieldType')} onValueChange={(v) => setValue('fieldType', v as typeof FIELD_TYPES[number])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>섹션 라벨</Label>
                <Input {...register('sectionLabel')} placeholder="추가 정보" />
              </div>
              <div className="space-y-2">
                <Label>순서</Label>
                <Input type="number" {...register('sortOrder')} />
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={watch('isRequired')} onCheckedChange={(v) => setValue('isRequired', v)} />
                <Label>필수</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={watch('isSearchable')} onCheckedChange={(v) => setValue('isSearchable', v)} />
                <Label>검색 가능</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={watch('isVisibleToEmployee')} onCheckedChange={(v) => setValue('isVisibleToEmployee', v)} />
                <Label>사원 공개</Label>
              </div>
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
            <AlertDialogTitle>커스텀 필드 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.fieldLabel}&quot; 필드를 삭제하시겠습니까? 기존 데이터는 유지됩니다.
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
