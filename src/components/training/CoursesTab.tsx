'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import type { DataTableColumn } from '@/components/shared/DataTable'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { PaginationInfo } from '@/types'

// ─── Types ───────────────────────────────────────────────

type CourseRow = {
  id: string
  title: string
  description: string | null
  category: string
  isMandatory: boolean
  durationHours: number | null
  provider: string | null
  externalUrl: string | null
  isActive: boolean
  [key: string]: unknown
}

const CATEGORY_LABELS: Record<string, string> = {
  COMPLIANCE: '컴플라이언스',
  TECHNICAL: '기술',
  LEADERSHIP: '리더십',
  SAFETY_TRAINING: '안전',
  ONBOARDING_TRAINING: '온보딩',
  OTHER: '기타',
}

// ─── Component ───────────────────────────────────────────

export default function CoursesTab() {
  const { toast } = useToast()
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<CourseRow | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'TECHNICAL',
    isMandatory: false,
    durationHours: '',
    provider: '',
    externalUrl: '',
  })

  const fetchCourses = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const res = await apiClient.getList<CourseRow>('/api/v1/training/courses', {
        page: String(page),
        limit: '20',
      })
      setCourses(res.data ?? [])
      setPagination(res.pagination ?? null)
    } catch {
      toast({ title: '교육과정 로드 실패', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchCourses()
  }, [fetchCourses])

  const openCreate = () => {
    setEditingCourse(null)
    setForm({ title: '', description: '', category: 'TECHNICAL', isMandatory: false, durationHours: '', provider: '', externalUrl: '' })
    setDialogOpen(true)
  }

  const openEdit = (course: CourseRow) => {
    setEditingCourse(course)
    setForm({
      title: course.title,
      description: course.description ?? '',
      category: course.category,
      isMandatory: course.isMandatory,
      durationHours: course.durationHours?.toString() ?? '',
      provider: course.provider ?? '',
      externalUrl: course.externalUrl ?? '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        title: form.title,
        category: form.category,
        isMandatory: form.isMandatory,
        ...(form.description ? { description: form.description } : {}),
        ...(form.durationHours ? { durationHours: Number(form.durationHours) } : {}),
        ...(form.provider ? { provider: form.provider } : {}),
        ...(form.externalUrl ? { externalUrl: form.externalUrl } : {}),
      }

      if (editingCourse) {
        await apiClient.put(`/api/v1/training/courses/${editingCourse.id}`, payload)
        toast({ title: '교육과정이 수정되었습니다.' })
      } else {
        await apiClient.post('/api/v1/training/courses', payload)
        toast({ title: '교육과정이 생성되었습니다.' })
      }

      setDialogOpen(false)
      fetchCourses()
    } catch {
      toast({ title: '저장 실패', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (course: CourseRow) => {
    if (!confirm(`"${course.title}" 교육과정을 삭제하시겠습니까?`)) return
    try {
      await apiClient.delete(`/api/v1/training/courses/${course.id}`)
      toast({ title: '교육과정이 삭제되었습니다.' })
      fetchCourses()
    } catch {
      toast({ title: '삭제 실패', variant: 'destructive' })
    }
  }

  const columns: DataTableColumn<CourseRow>[] = [
    {
      key: 'title',
      header: '과정명',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.title}</span>
          {row.externalUrl && (
            <a href={row.externalUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: '분류',
      render: (row) => (
        <Badge variant="outline">{CATEGORY_LABELS[row.category] ?? row.category}</Badge>
      ),
    },
    {
      key: 'isMandatory',
      header: '필수',
      render: (row) =>
        row.isMandatory ? (
          <Badge className="bg-red-50 text-red-700 border-red-200">필수</Badge>
        ) : (
          <span className="text-slate-400 text-xs">선택</span>
        ),
    },
    {
      key: 'durationHours',
      header: '시간',
      render: (row) => (row.durationHours ? `${row.durationHours}h` : '-'),
    },
    {
      key: 'provider',
      header: '제공자',
      render: (row) => row.provider ?? '-',
    },
    {
      key: 'isActive',
      header: '상태',
      render: (row) =>
        row.isActive ? (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">활성</Badge>
        ) : (
          <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">비활성</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row)}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          과정 추가
        </Button>
      </div>

      <DataTable<CourseRow>
        columns={columns}
        data={courses}
        pagination={pagination ?? undefined}
        onPageChange={fetchCourses}
        loading={loading}
        emptyMessage="등록된 교육과정이 없습니다."
        rowKey={(row) => row.id}
      />

      {/* ─── Create/Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCourse ? '교육과정 수정' : '교육과정 추가'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">과정명 *</label>
              <input
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">설명</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">분류 *</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">교육시간 (h)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  value={form.durationHours}
                  onChange={(e) => setForm((f) => ({ ...f, durationHours: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">교육 제공자</label>
                <input
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  value={form.provider}
                  onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">외부 URL</label>
                <input
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  value={form.externalUrl}
                  onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isMandatory"
                className="w-4 h-4 rounded border-slate-300 text-blue-600"
                checked={form.isMandatory}
                onChange={(e) => setForm((f) => ({ ...f, isMandatory: e.target.checked }))}
              />
              <label htmlFor="isMandatory" className="text-sm text-slate-700">필수 교육</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving || !form.title}>
              {saving ? '저장 중...' : editingCourse ? '수정' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
