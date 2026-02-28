'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Holiday Settings Client
// 공휴일 관리 (CRUD via Dialog)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'

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

// ─── Local interface (matching API response) ─────────────

interface HolidayLocal {
  id: string
  companyId: string
  name: string
  date: string
  isSubstitute: boolean
  year: number
  createdAt: string
}

// ─── Form schema ─────────────────────────────────────────

const formSchema = z.object({
  name: z.string().min(1, '공휴일명은 필수입니다'),
  date: z.string().min(1, '날짜는 필수입니다'),
  isSubstitute: z.boolean().default(false),
})

type FormData = z.infer<typeof formSchema>

// ─── Year options ────────────────────────────────────────

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: currentYear - 2024 + 2 }, (_, i) => 2024 + i)

// ─── Component ───────────────────────────────────────────

export function HolidaySettingsClient({ user }: { user: SessionUser }) {
  // ─── State ───
  const [holidays, setHolidays] = useState<HolidayLocal[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | undefined>()
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(currentYear)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<HolidayLocal | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<HolidayLocal | null>(null)
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
    defaultValues: { name: '', date: '', isSubstitute: false },
  })

  // ─── Fetch ───
  const fetchHolidays = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<HolidayLocal>('/api/v1/holidays', {
        page,
        limit: 50,
        year: selectedYear,
      })
      setHolidays(res.data)
      setPagination(res.pagination)
    } catch {
      setHolidays([])
      setPagination(undefined)
    } finally {
      setLoading(false)
    }
  }, [page, selectedYear])

  useEffect(() => {
    void fetchHolidays()
  }, [fetchHolidays])

  // Reset page when year changes
  useEffect(() => {
    setPage(1)
  }, [selectedYear])

  // ─── Open dialog ───
  const openCreate = () => {
    setEditing(null)
    reset({ name: '', date: '', isSubstitute: false })
    setDialogOpen(true)
  }

  const openEdit = (row: HolidayLocal) => {
    setEditing(row)
    reset({
      name: row.name,
      date: row.date.slice(0, 10), // yyyy-MM-dd
      isSubstitute: row.isSubstitute,
    })
    setDialogOpen(true)
  }

  // ─── Submit ───
  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      const year = new Date(data.date).getFullYear()
      const payload = { ...data, year }
      if (editing) {
        await apiClient.put(`/api/v1/holidays/${editing.id}`, payload)
      } else {
        await apiClient.post('/api/v1/holidays', payload)
      }
      setDialogOpen(false)
      fetchHolidays()
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete ───
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiClient.delete(`/api/v1/holidays/${deleteTarget.id}`)
      setDeleteTarget(null)
      fetchHolidays()
    } finally {
      setDeleting(false)
    }
  }

  // ─── Columns ───
  const columns: DataTableColumn<HolidayLocal>[] = [
    {
      key: 'name',
      header: ko.holiday.name,
    },
    {
      key: 'date',
      header: ko.holiday.date,
      render: (row: HolidayLocal) => {
        const d = new Date(row.date)
        return d.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          weekday: 'short',
        })
      },
    },
    {
      key: 'isSubstitute',
      header: ko.holiday.isSubstitute,
      render: (row: HolidayLocal) =>
        row.isSubstitute ? <Badge variant="outline">대체공휴일</Badge> : null,
    },
    {
      key: 'actions',
      header: ko.common.actions,
      render: (row: HolidayLocal) => (
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
        title={ko.holiday.settings}
        description="회사 공휴일을 등록하고 관리합니다."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            {ko.common.create}
          </Button>
        }
      />

      {/* ─── Year filter ─── */}
      <div className="flex items-center gap-3">
        <Label>{ko.holiday.year}</Label>
        <Select
          value={String(selectedYear)}
          onValueChange={(v) => setSelectedYear(Number(v))}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}년
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── DataTable ─── */}
      <DataTable
        columns={columns as unknown as DataTableColumn<Record<string, unknown>>[]}
        data={holidays as unknown as Record<string, unknown>[]}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage={ko.holiday.noHolidays}
        rowKey={(row) => (row as unknown as HolidayLocal).id}
      />

      {/* ─── Create / Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? `${ko.holiday.name} ${ko.common.edit}`
                : `${ko.holiday.name} ${ko.common.create}`}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? '공휴일 정보를 수정합니다.'
                : '새 공휴일을 등록합니다.'}
            </DialogDescription>
          </DialogHeader>

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
            {/* name */}
            <div className="space-y-2">
              <Label htmlFor="holiday-name">{ko.holiday.name}</Label>
              <Input
                id="holiday-name"
                placeholder="예: 설날"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* date */}
            <div className="space-y-2">
              <Label htmlFor="holiday-date">{ko.holiday.date}</Label>
              <Input
                id="holiday-date"
                type="date"
                {...register('date')}
              />
              {errors.date && (
                <p className="text-sm text-destructive">
                  {errors.date.message}
                </p>
              )}
            </div>

            {/* isSubstitute */}
            <Controller
              control={control}
              name="isSubstitute"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="holiday-substitute"
                    checked={field.value}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                  />
                  <Label
                    htmlFor="holiday-substitute"
                    className="cursor-pointer"
                  >
                    {ko.holiday.isSubstitute}
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
            <AlertDialogTitle>공휴일 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot;을(를) 삭제하시겠습니까? 이 작업은
              되돌릴 수 없습니다.
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
