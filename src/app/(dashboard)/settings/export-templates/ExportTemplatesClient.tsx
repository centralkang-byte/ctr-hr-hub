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

const ENTITY_TYPES = [
  { value: '', label: '전체' },
  { value: 'EMPLOYEE', label: '사원' },
  { value: 'ATTENDANCE', label: '근태' },
  { value: 'LEAVE', label: '휴가' },
  { value: 'PAYROLL', label: '급여' },
  { value: 'PERFORMANCE', label: '성과' },
]

const formSchema = z.object({
  entityType: z.string().min(1, '엔티티 유형은 필수입니다'),
  name: z.string().min(1, '이름은 필수입니다'),
  fileFormat: z.enum(['XLSX', 'CSV']),
  isDefault: z.boolean(),
})

type FormData = z.infer<typeof formSchema>

export function ExportTemplatesClient({ user: _user }: { user: SessionUser }) {
  const { toast } = useToast()
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
      toast({ title: '오류', description: '내보내기 템플릿 목록을 불러올 수 없습니다.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, filterEntityType, toast])

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
      toast({ title: '오류', description: '최소 1개의 컬럼이 필요합니다.', variant: 'destructive' })
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
      toast({ title: '성공', description: '내보내기 템플릿이 저장되었습니다.' })
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
      await apiClient.delete(`/api/v1/settings/export-templates/${deleteTarget.id}`)
      toast({ title: '성공', description: '내보내기 템플릿이 삭제되었습니다.' })
      setDeleteTarget(null)
      fetchItems()
    } catch {
      toast({ title: '오류', description: '삭제 중 오류가 발생했습니다.', variant: 'destructive' })
    }
  }

  const tableColumns: DataTableColumn<ExportTemplateLocal>[] = [
    { key: 'entityType', header: '엔티티', render: (row) => <span className="text-xs font-medium">{row.entityType}</span> },
    { key: 'name', header: '이름' },
    { key: 'columns', header: '컬럼 수', render: (row) => `${(row.columns as ColumnDef[]).length}개` },
    { key: 'fileFormat', header: '형식', render: (row) => row.fileFormat },
    {
      key: 'isDefault', header: '기본',
      render: (row) => row.isDefault ? (
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">기본</span>
      ) : '-',
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
        title="내보내기 설정"
        description="데이터 내보내기 템플릿을 관리합니다."
        actions={<Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> 템플릿 추가</Button>}
      />

      <div className="flex items-center gap-3">
        <Label className="text-sm">엔티티 필터:</Label>
        <Select value={filterEntityType} onValueChange={(v) => { setFilterEntityType(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="전체" /></SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable<ExportTemplateLocal>
        columns={tableColumns}
        data={items}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage="등록된 내보내기 템플릿이 없습니다."
        rowKey={(row) => row.id}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? '템플릿 수정' : '템플릿 추가'}</DialogTitle>
            <DialogDescription>내보내기 템플릿을 설정합니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>엔티티 유형</Label>
                <Select value={watch('entityType')} onValueChange={(v) => setValue('entityType', v)} disabled={!!editing}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.filter((t) => t.value).map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>이름</Label>
                <Input {...register('name')} placeholder="기본 사원 목록" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>파일 형식</Label>
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
                  <Label>기본 템플릿</Label>
                </div>
              </div>
            </div>

            {/* Columns editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>컬럼</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setColumns((prev) => [...prev, { key: '', label: '' }])}>
                  <Plus className="mr-1 h-4 w-4" /> 컬럼 추가
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
                    placeholder="키 (name)"
                    className="w-32"
                  />
                  <Input
                    value={col.label}
                    onChange={(e) => {
                      const next = [...columns]
                      next[i] = { ...next[i], label: e.target.value }
                      setColumns(next)
                    }}
                    placeholder="라벨 (이름)"
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setColumns((prev) => prev.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
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
            <AlertDialogTitle>템플릿 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot; 템플릿을 삭제하시겠습니까?
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
