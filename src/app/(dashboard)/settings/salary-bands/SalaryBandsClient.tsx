'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Salary Bands Settings Client
// 급여 밴드 관리 (CRUD via Dialog)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'

import type { SessionUser, PaginationInfo, RefOption } from '@/types'
import { apiClient } from '@/lib/api'
import { ko } from '@/lib/i18n/ko'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { useToast } from '@/hooks/use-toast'

// ─── Local interfaces ────────────────────────────────────

interface SalaryBandLocal {
  id: string
  companyId: string
  jobGradeId: string
  jobCategoryId: string | null
  currency: string
  minSalary: number
  midSalary: number
  maxSalary: number
  effectiveFrom: string
  effectiveTo: string | null
  createdAt: string
  jobGrade?: { id: string; name: string }
  jobCategory?: { id: string; name: string } | null
}

// ─── Form schema ─────────────────────────────────────────

const formSchema = z
  .object({
    jobGradeId: z.string().min(1, '직급을 선택하세요'),
    jobCategoryId: z.string().optional(),
    currency: z.string().min(1, '통화를 선택하세요'),
    minSalary: z.coerce.number().positive('최소 급여는 양수여야 합니다'),
    midSalary: z.coerce.number().positive('중간값은 양수여야 합니다'),
    maxSalary: z.coerce.number().positive('최대 급여는 양수여야 합니다'),
    effectiveFrom: z.string().min(1, '적용 시작일은 필수입니다'),
  })
  .refine((d) => d.minSalary < d.midSalary && d.midSalary < d.maxSalary, {
    message: '최소 < 중간값 < 최대 순서여야 합니다.',
    path: ['midSalary'],
  })

type FormData = z.infer<typeof formSchema>

// ─── Constants ───────────────────────────────────────────

const CURRENCIES = ['KRW', 'USD', 'CNY', 'PLN', 'MXN', 'RUB', 'VND'] as const

const CURRENCY_LABELS: Record<string, string> = {
  KRW: 'KRW (원)',
  USD: 'USD ($)',
  CNY: 'CNY (¥)',
  PLN: 'PLN (zł)',
  MXN: 'MXN ($)',
  RUB: 'RUB (₽)',
  VND: 'VND (₫)',
}

const COMPA_LEGEND = [
  { label: 'Compa < 0.80', color: 'bg-red-500', desc: '시장 대비 매우 낮음' },
  { label: '0.80 ~ 0.90', color: 'bg-orange-400', desc: '시장 대비 낮음' },
  { label: '0.90 ~ 1.10', color: 'bg-emerald-500', desc: '적정 범위' },
  { label: '1.10 ~ 1.20', color: 'bg-blue-400', desc: '시장 대비 높음' },
  { label: 'Compa > 1.20', color: 'bg-purple-500', desc: '시장 대비 매우 높음' },
]

// ─── Number formatter ────────────────────────────────────

function formatSalary(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${currency} ${value.toLocaleString()}`
  }
}

// ─── Component ───────────────────────────────────────────

export function SalaryBandsClient({ user }: { user: SessionUser }) {
  // ─── State ───
  const [bands, setBands] = useState<SalaryBandLocal[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | undefined>()
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [filterGradeId, setFilterGradeId] = useState<string>('')
  const [filterCategoryId, setFilterCategoryId] = useState<string>('')

  const [jobGrades, setJobGrades] = useState<RefOption[]>([])
  const [jobCategories, setJobCategories] = useState<RefOption[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SalaryBandLocal | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<SalaryBandLocal | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { toast } = useToast()

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
      jobGradeId: '',
      jobCategoryId: '',
      currency: 'KRW',
      minSalary: 0,
      midSalary: 0,
      maxSalary: 0,
      effectiveFrom: '',
    },
  })

  // ─── Fetch reference data ───
  useEffect(() => {
    const fetchRefs = async () => {
      try {
        const [gradesRes, categoriesRes] = await Promise.all([
          apiClient.getList<RefOption>('/api/v1/org/grades', { limit: 200 }),
          apiClient.getList<RefOption>('/api/v1/org/job-categories', { limit: 200 }),
        ])
        setJobGrades(gradesRes.data)
        setJobCategories(categoriesRes.data)
      } catch {
        // Reference data may fail silently
      }
    }
    void fetchRefs()
  }, [])

  // ─── Fetch salary bands ───
  const fetchBands = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page,
        limit: 50,
      }
      if (filterGradeId) params.jobGradeId = filterGradeId
      if (filterCategoryId) params.jobCategoryId = filterCategoryId

      const res = await apiClient.getList<SalaryBandLocal>(
        '/api/v1/compensation/salary-bands',
        params,
      )
      setBands(res.data)
      setPagination(res.pagination)
    } catch {
      setBands([])
      setPagination(undefined)
      toast({
        title: '오류',
        description: '급여 밴드 목록을 불러오는 데 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [page, filterGradeId, filterCategoryId, toast])

  useEffect(() => {
    void fetchBands()
  }, [fetchBands])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [filterGradeId, filterCategoryId])

  // ─── Open dialog ───
  const openCreate = () => {
    setEditing(null)
    reset({
      jobGradeId: '',
      jobCategoryId: '',
      currency: 'KRW',
      minSalary: 0,
      midSalary: 0,
      maxSalary: 0,
      effectiveFrom: '',
    })
    setDialogOpen(true)
  }

  const openEdit = (row: SalaryBandLocal) => {
    setEditing(row)
    reset({
      jobGradeId: row.jobGradeId,
      jobCategoryId: row.jobCategoryId ?? '',
      currency: row.currency,
      minSalary: row.minSalary,
      midSalary: row.midSalary,
      maxSalary: row.maxSalary,
      effectiveFrom: row.effectiveFrom.slice(0, 10),
    })
    setDialogOpen(true)
  }

  // ─── Submit ───
  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      const payload = {
        ...data,
        jobCategoryId: data.jobCategoryId || undefined,
        effectiveFrom: new Date(data.effectiveFrom).toISOString(),
      }
      if (editing) {
        await apiClient.put(`/api/v1/compensation/salary-bands/${editing.id}`, payload)
        toast({ title: '성공', description: '급여 밴드가 수정되었습니다.' })
      } else {
        await apiClient.post('/api/v1/compensation/salary-bands', payload)
        toast({ title: '성공', description: '급여 밴드가 등록되었습니다.' })
      }
      setDialogOpen(false)
      fetchBands()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.'
      toast({ title: '오류', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete ───
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiClient.delete(`/api/v1/compensation/salary-bands/${deleteTarget.id}`)
      setDeleteTarget(null)
      toast({ title: '성공', description: '급여 밴드가 삭제되었습니다.' })
      fetchBands()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.'
      toast({ title: '오류', description: message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  // ─── Columns ───
  const columns: DataTableColumn<SalaryBandLocal>[] = [
    {
      key: 'jobGrade',
      header: ko.employee.jobGrade,
      render: (row: SalaryBandLocal) => row.jobGrade?.name ?? '-',
    },
    {
      key: 'jobCategory',
      header: ko.employee.jobCategory,
      render: (row: SalaryBandLocal) => row.jobCategory?.name ?? '-',
    },
    {
      key: 'minSalary',
      header: '최소',
      render: (row: SalaryBandLocal) => (
        <span className="font-mono text-sm">
          {formatSalary(row.minSalary, row.currency)}
        </span>
      ),
    },
    {
      key: 'midSalary',
      header: '중간값',
      render: (row: SalaryBandLocal) => (
        <span className="font-mono text-sm font-semibold">
          {formatSalary(row.midSalary, row.currency)}
        </span>
      ),
    },
    {
      key: 'maxSalary',
      header: '최대',
      render: (row: SalaryBandLocal) => (
        <span className="font-mono text-sm">
          {formatSalary(row.maxSalary, row.currency)}
        </span>
      ),
    },
    {
      key: 'currency',
      header: '통화',
      render: (row: SalaryBandLocal) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
          {row.currency}
        </span>
      ),
    },
    {
      key: 'effectiveFrom',
      header: '적용시작',
      render: (row: SalaryBandLocal) => {
        const d = new Date(row.effectiveFrom)
        return d.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
      },
    },
    {
      key: 'actions',
      header: ko.common.actions,
      render: (row: SalaryBandLocal) => (
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
        title="급여 밴드 관리"
        description="직급/직군별 급여 범위(밴드)를 설정하고 관리합니다."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            급여 밴드 추가
          </Button>
        }
      />

      {/* ─── Filters ─── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">{ko.employee.jobGrade}</Label>
          <Select
            value={filterGradeId}
            onValueChange={(v) => setFilterGradeId(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={ko.common.all} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{ko.common.all}</SelectItem>
              {jobGrades.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">{ko.employee.jobCategory}</Label>
          <Select
            value={filterCategoryId}
            onValueChange={(v) => setFilterCategoryId(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={ko.common.all} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{ko.common.all}</SelectItem>
              {jobCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ─── DataTable ─── */}
      <DataTable
        columns={columns as unknown as DataTableColumn<Record<string, unknown>>[]}
        data={bands as unknown as Record<string, unknown>[]}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage="등록된 급여 밴드가 없습니다."
        emptyDescription="급여 밴드를 추가하여 직급별 급여 범위를 관리하세요."
        rowKey={(row) => (row as unknown as SalaryBandLocal).id}
      />

      {/* ─── Compa-Ratio Legend ─── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Compa-Ratio 범위 기준
        </h3>
        <div className="flex flex-wrap gap-4">
          {COMPA_LEGEND.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className={`inline-block h-3 w-3 rounded-full ${item.color}`}
              />
              <span className="text-xs text-slate-600">
                {item.label} &mdash; {item.desc}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Create / Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>
              {editing ? '급여 밴드 수정' : '급여 밴드 추가'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? '급여 밴드 정보를 수정합니다.'
                : '새로운 급여 밴드를 등록합니다.'}
            </DialogDescription>
          </DialogHeader>

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
            {/* jobGradeId */}
            <div className="space-y-2">
              <Label>{ko.employee.jobGrade} *</Label>
              <Controller
                control={control}
                name="jobGradeId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="직급 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobGrades.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.jobGradeId && (
                <p className="text-sm text-destructive">
                  {errors.jobGradeId.message}
                </p>
              )}
            </div>

            {/* jobCategoryId */}
            <div className="space-y-2">
              <Label>{ko.employee.jobCategory}</Label>
              <Controller
                control={control}
                name="jobCategoryId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="직군 선택 (선택사항)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">선택 안 함</SelectItem>
                      {jobCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* currency */}
            <div className="space-y-2">
              <Label>통화 *</Label>
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="통화 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CURRENCY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.currency && (
                <p className="text-sm text-destructive">
                  {errors.currency.message}
                </p>
              )}
            </div>

            {/* Salary fields */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="minSalary">최소 급여 *</Label>
                <Input
                  id="minSalary"
                  type="number"
                  placeholder="0"
                  {...register('minSalary', { valueAsNumber: true })}
                />
                {errors.minSalary && (
                  <p className="text-xs text-destructive">
                    {errors.minSalary.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="midSalary">중간값 *</Label>
                <Input
                  id="midSalary"
                  type="number"
                  placeholder="0"
                  {...register('midSalary', { valueAsNumber: true })}
                />
                {errors.midSalary && (
                  <p className="text-xs text-destructive">
                    {errors.midSalary.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxSalary">최대 급여 *</Label>
                <Input
                  id="maxSalary"
                  type="number"
                  placeholder="0"
                  {...register('maxSalary', { valueAsNumber: true })}
                />
                {errors.maxSalary && (
                  <p className="text-xs text-destructive">
                    {errors.maxSalary.message}
                  </p>
                )}
              </div>
            </div>

            {/* effectiveFrom */}
            <div className="space-y-2">
              <Label htmlFor="effectiveFrom">적용 시작일 *</Label>
              <Input
                id="effectiveFrom"
                type="date"
                {...register('effectiveFrom')}
              />
              {errors.effectiveFrom && (
                <p className="text-sm text-destructive">
                  {errors.effectiveFrom.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {ko.common.cancel}
              </Button>
              <Button type="submit" disabled={saving}>
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
            <AlertDialogTitle>급여 밴드 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.jobGrade?.name ?? ''}{' '}
              {deleteTarget?.jobCategory?.name
                ? `/ ${deleteTarget.jobCategory.name}`
                : ''}{' '}
              급여 밴드를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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
