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

const formSchema = z.object({
  termKey: z.string().min(1, '용어 키는 필수입니다'),
  labelKo: z.string().min(1, '한국어 라벨은 필수입니다'),
  labelEn: z.string().optional(),
  labelLocal: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export function TermsClient({ user: _user }: { user: SessionUser }) {
  const { toast } = useToast()
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
      toast({ title: '오류', description: '용어 목록을 불러올 수 없습니다.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, toast])

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
      toast({ title: '성공', description: '용어가 저장되었습니다.' })
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
      await apiClient.delete(`/api/v1/settings/terms/${deleteTarget.id}`)
      toast({ title: '성공', description: '용어가 삭제되었습니다.' })
      setDeleteTarget(null)
      fetchItems()
    } catch {
      toast({ title: '오류', description: '삭제 중 오류가 발생했습니다.', variant: 'destructive' })
    }
  }

  const columns: DataTableColumn<TermOverrideLocal>[] = [
    { key: 'termKey', header: '용어 키', render: (row) => <span className="font-mono text-sm">{row.termKey}</span> },
    { key: 'labelKo', header: '한국어' },
    { key: 'labelEn', header: '영어', render: (row) => row.labelEn ?? '-' },
    { key: 'labelLocal', header: '현지어', render: (row) => row.labelLocal ?? '-' },
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
        title="용어 설정"
        description="시스템 용어를 법인에 맞게 커스터마이징합니다."
        actions={
          <Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> 용어 추가</Button>
        }
      />

      <DataTable<TermOverrideLocal>
        columns={columns}
        data={items}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage="등록된 용어 오버라이드가 없습니다."
        rowKey={(row) => row.id}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '용어 수정' : '용어 추가'}</DialogTitle>
            <DialogDescription>시스템 용어를 커스터마이징합니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>용어 키</Label>
              <Input {...register('termKey')} placeholder="employee, department 등" disabled={!!editing} />
              {errors.termKey && <p className="text-xs text-destructive">{errors.termKey.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>한국어</Label>
              <Input {...register('labelKo')} placeholder="사원, 부서 등" />
              {errors.labelKo && <p className="text-xs text-destructive">{errors.labelKo.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>영어</Label>
              <Input {...register('labelEn')} placeholder="Employee, Department 등" />
            </div>
            <div className="space-y-2">
              <Label>현지어</Label>
              <Input {...register('labelLocal')} placeholder="현지 언어 라벨" />
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

      {/* Delete AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>용어 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.termKey}&quot; 용어 오버라이드를 삭제하시겠습니까?
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
