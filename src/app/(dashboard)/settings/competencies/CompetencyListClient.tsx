'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Competency Library Client
// 역량 라이브러리 관리 (CRUD via Dialog)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Target, Plus, Pencil, Trash2, Loader2, Search, Check, X } from 'lucide-react'

import type { SessionUser, PaginationInfo } from '@/types'
import { apiClient } from '@/lib/api'
import { ko } from '@/lib/i18n/ko'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ─── Local types ─────────────────────────────────────────

interface CompetencyLocal {
  id: string
  companyId: string | null
  name: string
  category: string
  description: string | null
  behavioralIndicators: string[] | null
  isActive: boolean
  createdAt: string
  company: { id: string; name: string } | null
}

// ─── Form schema ─────────────────────────────────────────

const formSchema = z.object({
  name: z.string().min(1, '역량명은 필수입니다.'),
  category: z.string().min(1, '카테고리는 필수입니다.'),
  description: z.string().optional(),
  behavioralIndicatorsText: z.string().optional(),
  isActive: z.boolean().default(true),
})

type FormData = z.infer<typeof formSchema>

// ─── Active filter options ───────────────────────────────

type ActiveFilter = 'all' | 'active' | 'inactive'

const ACTIVE_FILTER_OPTIONS: { value: ActiveFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '활성' },
  { value: 'inactive', label: '비활성' },
]

// ─── Component ───────────────────────────────────────────

export function CompetencyListClient({ user }: { user: SessionUser }) {
  // ─── State ───
  const [competencies, setCompetencies] = useState<CompetencyLocal[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | undefined>()
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CompetencyLocal | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<CompetencyLocal | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ─── Form ───
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<z.input<typeof formSchema>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: '',
      category: '',
      description: '',
      behavioralIndicatorsText: '',
      isActive: true,
    },
  })

  // ─── Fetch ───
  const fetchCompetencies = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page,
        limit: 20,
      }
      if (search) params.search = search
      if (activeFilter === 'active') params.isActive = 'true'
      if (activeFilter === 'inactive') params.isActive = 'false'

      const res = await apiClient.getList<CompetencyLocal>(
        '/api/v1/competencies',
        params,
      )
      setCompetencies(res.data)
      setPagination(res.pagination)
    } catch {
      setCompetencies([])
      setPagination(undefined)
    } finally {
      setLoading(false)
    }
  }, [page, search, activeFilter])

  useEffect(() => {
    void fetchCompetencies()
  }, [fetchCompetencies])

  // Reset page when filter changes
  useEffect(() => {
    setPage(1)
  }, [search, activeFilter])

  // ─── Search handler ───
  const handleSearch = () => {
    setSearch(searchInput.trim())
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // ─── Open dialog ───
  const openCreate = () => {
    setEditing(null)
    reset({
      name: '',
      category: '',
      description: '',
      behavioralIndicatorsText: '',
      isActive: true,
    })
    setDialogOpen(true)
  }

  const openEdit = (row: CompetencyLocal) => {
    setEditing(row)
    const indicators = Array.isArray(row.behavioralIndicators)
      ? row.behavioralIndicators.join('\n')
      : ''
    reset({
      name: row.name,
      category: row.category,
      description: row.description ?? '',
      behavioralIndicatorsText: indicators,
      isActive: row.isActive,
    })
    setDialogOpen(true)
  }

  // ─── Submit ───
  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      const behavioralIndicators = data.behavioralIndicatorsText
        ? data.behavioralIndicatorsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : []

      const payload = {
        name: data.name,
        category: data.category,
        description: data.description || undefined,
        behavioralIndicators,
        isActive: data.isActive,
      }

      if (editing) {
        await apiClient.put(`/api/v1/competencies/${editing.id}`, payload)
      } else {
        await apiClient.post('/api/v1/competencies', payload)
      }
      setDialogOpen(false)
      void fetchCompetencies()
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete ───
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiClient.delete(`/api/v1/competencies/${deleteTarget.id}`)
      setDeleteTarget(null)
      void fetchCompetencies()
    } finally {
      setDeleting(false)
    }
  }

  // ─── Columns ───
  const columns: DataTableColumn<CompetencyLocal>[] = [
    {
      key: 'name',
      header: '역량명',
      render: (row: CompetencyLocal) => (
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: '카테고리',
      render: (row: CompetencyLocal) => (
        <Badge variant="outline">{row.category}</Badge>
      ),
    },
    {
      key: 'description',
      header: '설명',
      render: (row: CompetencyLocal) => (
        <span className="text-sm text-muted-foreground line-clamp-1">
          {row.description ?? '-'}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: '활성상태',
      render: (row: CompetencyLocal) =>
        row.isActive ? (
          <Badge
            className="border-0"
            style={{
              backgroundColor: 'rgba(0, 200, 83, 0.1)',
              color: '#00C853',
            }}
          >
            <Check className="mr-1 h-3 w-3" />
            활성
          </Badge>
        ) : (
          <Badge
            variant="secondary"
            className="border-0"
            style={{
              backgroundColor: 'rgba(158, 158, 158, 0.1)',
              color: '#9E9E9E',
            }}
          >
            <X className="mr-1 h-3 w-3" />
            비활성
          </Badge>
        ),
    },
    {
      key: 'behavioralIndicators',
      header: '행동지표',
      render: (row: CompetencyLocal) => {
        const indicators = Array.isArray(row.behavioralIndicators)
          ? row.behavioralIndicators
          : []
        if (indicators.length === 0) return <span className="text-muted-foreground">-</span>
        return (
          <div className="flex flex-wrap gap-1">
            {indicators.slice(0, 3).map((ind, idx) => (
              <span
                key={idx}
                className="inline-flex items-center rounded px-1.5 py-0.5 text-xs"
                style={{
                  backgroundColor: 'rgba(33, 150, 243, 0.08)',
                  color: '#2196F3',
                }}
              >
                {ind}
              </span>
            ))}
            {indicators.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{indicators.length - 3}
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: ko.common.actions,
      render: (row: CompetencyLocal) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteTarget(row)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  // ─── Render ───
  return (
    <div className="space-y-6">
      <PageHeader
        title="역량 라이브러리"
        description="조직의 역량 항목을 등록하고 관리합니다."
        actions={
          <Button
            onClick={openCreate}
            style={{ backgroundColor: '#00C853', color: '#fff' }}
            className="hover:opacity-90"
          >
            <Plus className="mr-1 h-4 w-4" />
            역량 추가
          </Button>
        }
      />

      {/* ─── Filter bar ─── */}
      <div
        className="flex items-center gap-3 rounded-xl border p-4"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#E8E8E8',
        }}
      >
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="역량명, 카테고리 검색"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleSearch}>
          {ko.common.search}
        </Button>

        {/* Active filter */}
        <div className="flex items-center gap-1">
          {ACTIVE_FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={activeFilter === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter(opt.value)}
              style={
                activeFilter === opt.value
                  ? { backgroundColor: '#003876', color: '#fff' }
                  : {}
              }
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* ─── DataTable ─── */}
      <div
        className="rounded-xl border"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#E8E8E8',
        }}
      >
        <DataTable
          columns={columns as unknown as DataTableColumn<Record<string, unknown>>[]}
          data={competencies as unknown as Record<string, unknown>[]}
          loading={loading}
          pagination={pagination}
          onPageChange={setPage}
          emptyMessage="등록된 역량이 없습니다."
          rowKey={(row) => (row as unknown as CompetencyLocal).id}
        />
      </div>

      {/* ─── Create / Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]" style={{ borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {editing ? '역량 수정' : '역량 추가'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? '역량 정보를 수정합니다.'
                : '새 역량을 등록합니다.'}
            </DialogDescription>
          </DialogHeader>

          <form
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onSubmit={handleSubmit(onSubmit as any)}
            className="space-y-4"
          >
            {/* name */}
            <div className="space-y-2">
              <Label htmlFor="comp-name">역량명 *</Label>
              <Input
                id="comp-name"
                placeholder="예: 리더십"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {String(errors.name.message)}
                </p>
              )}
            </div>

            {/* category */}
            <div className="space-y-2">
              <Label htmlFor="comp-category">카테고리 *</Label>
              <Input
                id="comp-category"
                placeholder="예: 공통역량, 직무역량, 리더십역량"
                {...register('category')}
              />
              {errors.category && (
                <p className="text-sm text-destructive">
                  {String(errors.category.message)}
                </p>
              )}
            </div>

            {/* description */}
            <div className="space-y-2">
              <Label htmlFor="comp-desc">설명</Label>
              <textarea
                id="comp-desc"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="역량에 대한 설명을 입력하세요."
                {...register('description')}
              />
            </div>

            {/* behavioral indicators */}
            <div className="space-y-2">
              <Label htmlFor="comp-indicators">행동지표 (줄바꿈으로 구분)</Label>
              <textarea
                id="comp-indicators"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={
                  '예:\n팀원에게 명확한 비전을 제시한다\n변화를 주도적으로 이끈다\n갈등 상황에서 조정 역할을 수행한다'
                }
                {...register('behavioralIndicatorsText')}
              />
            </div>

            {/* isActive */}
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="comp-active"
                    checked={field.value as boolean}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                  />
                  <Label htmlFor="comp-active" className="cursor-pointer">
                    활성 상태
                  </Label>
                </div>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {ko.common.cancel}
              </Button>
              <Button
                type="submit"
                disabled={saving}
                style={{ backgroundColor: '#00C853', color: '#fff' }}
                className="hover:opacity-90"
              >
                {saving && (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                )}
                {ko.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Delete AlertDialog ─── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>역량 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot;을(를) 삭제하시겠습니까? 이
              작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ko.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              {ko.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
