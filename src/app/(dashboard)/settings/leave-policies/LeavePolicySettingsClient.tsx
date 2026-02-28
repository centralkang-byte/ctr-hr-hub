'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Policy Settings Client
// 휴가 정책 관리 (CRUD via Dialog)
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

interface LeavePolicyLocal {
  id: string
  companyId: string
  name: string
  leaveType: string
  defaultDays: number
  isPaid: boolean
  carryOverAllowed: boolean
  maxCarryOverDays: number | null
  minTenureMonths: number | null
  minUnit: string
  isActive: boolean
  createdAt: string
}

// ─── Form schema ─────────────────────────────────────────

const formSchema = z.object({
  name: z.string().min(1, '정책명은 필수입니다'),
  leaveType: z.string().min(1, '휴가 유형은 필수입니다'),
  defaultDays: z.coerce.number().int().min(0).max(365),
  isPaid: z.boolean(),
  carryOverAllowed: z.boolean(),
  maxCarryOverDays: z.coerce.number().int().min(0).max(365).optional(),
  minTenureMonths: z.coerce.number().int().min(0).optional(),
  minUnit: z.enum(['FULL_DAY', 'HALF_DAY', 'QUARTER_DAY']),
})

type FormData = z.infer<typeof formSchema>

// ─── Min unit label map ─────────────────────────────────

const minUnitLabels: Record<string, string> = {
  FULL_DAY: ko.leave.fullDay,
  HALF_DAY: ko.leave.halfDay,
  QUARTER_DAY: ko.leave.quarterDay,
}

// ─── Leave type label map ───────────────────────────────

const leaveTypeLabels: Record<string, string> = {
  ANNUAL: ko.leave.annual,
  SICK: ko.leave.sick,
  MATERNITY: ko.leave.maternity,
  PATERNITY: ko.leave.paternity,
  BEREAVEMENT: ko.leave.bereavement,
  SPECIAL: ko.leave.special,
  COMPENSATORY: ko.leave.compensatory,
  FAMILY_CARE: ko.leave.familyCare,
  WEDDING: ko.leave.wedding,
  MENSTRUAL: ko.leave.menstrual,
}

// ─── Component ───────────────────────────────────────────

export function LeavePolicySettingsClient({ user }: { user: SessionUser }) {
  void user // reserved for permission checks

  // ─── State ───
  const [policies, setPolicies] = useState<LeavePolicyLocal[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | undefined>()
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LeavePolicyLocal | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<LeavePolicyLocal | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ─── Form ───
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<z.input<typeof formSchema>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: '',
      leaveType: '',
      defaultDays: 0,
      isPaid: true,
      carryOverAllowed: false,
      maxCarryOverDays: undefined,
      minTenureMonths: undefined,
      minUnit: 'FULL_DAY',
    },
  })

  const carryOverAllowed = watch('carryOverAllowed')

  // ─── Fetch ───
  const fetchPolicies = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<LeavePolicyLocal>('/api/v1/leave/policies', {
        page,
        limit: 50,
      })
      setPolicies(res.data)
      setPagination(res.pagination)
    } catch {
      setPolicies([])
      setPagination(undefined)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void fetchPolicies()
  }, [fetchPolicies])

  // ─── Open dialog ───
  const openCreate = () => {
    setEditing(null)
    reset({
      name: '',
      leaveType: '',
      defaultDays: 0,
      isPaid: true,
      carryOverAllowed: false,
      maxCarryOverDays: undefined,
      minTenureMonths: undefined,
      minUnit: 'FULL_DAY',
    })
    setDialogOpen(true)
  }

  const openEdit = (row: LeavePolicyLocal) => {
    setEditing(row)
    reset({
      name: row.name,
      leaveType: row.leaveType,
      defaultDays: row.defaultDays,
      isPaid: row.isPaid,
      carryOverAllowed: row.carryOverAllowed,
      maxCarryOverDays: row.maxCarryOverDays ?? undefined,
      minTenureMonths: row.minTenureMonths ?? undefined,
      minUnit: row.minUnit as 'FULL_DAY' | 'HALF_DAY' | 'QUARTER_DAY',
    })
    setDialogOpen(true)
  }

  // ─── Submit ───
  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      const payload = {
        ...data,
        maxCarryOverDays: data.carryOverAllowed ? data.maxCarryOverDays : undefined,
      }
      if (editing) {
        await apiClient.put(`/api/v1/leave/policies/${editing.id}`, payload)
      } else {
        await apiClient.post('/api/v1/leave/policies', payload)
      }
      setDialogOpen(false)
      fetchPolicies()
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete ───
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiClient.delete(`/api/v1/leave/policies/${deleteTarget.id}`)
      setDeleteTarget(null)
      fetchPolicies()
    } finally {
      setDeleting(false)
    }
  }

  // ─── Columns ───
  const columns: DataTableColumn<LeavePolicyLocal>[] = [
    {
      key: 'name',
      header: '정책명',
    },
    {
      key: 'leaveType',
      header: '휴가 유형',
      render: (row: LeavePolicyLocal) => (
        <Badge variant="outline">
          {leaveTypeLabels[row.leaveType] ?? row.leaveType}
        </Badge>
      ),
    },
    {
      key: 'defaultDays',
      header: '기본 부여일',
      render: (row: LeavePolicyLocal) => `${row.defaultDays}일`,
    },
    {
      key: 'isPaid',
      header: ko.leave.isPaid,
      render: (row: LeavePolicyLocal) =>
        row.isPaid ? (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">유급</Badge>
        ) : (
          <Badge variant="secondary">무급</Badge>
        ),
    },
    {
      key: 'carryOverAllowed',
      header: ko.leave.carryOver,
      render: (row: LeavePolicyLocal) =>
        row.carryOverAllowed ? (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">허용</Badge>
        ) : (
          <Badge variant="secondary">불가</Badge>
        ),
    },
    {
      key: 'minUnit',
      header: ko.leave.minUnit,
      render: (row: LeavePolicyLocal) =>
        minUnitLabels[row.minUnit] ?? row.minUnit,
    },
    {
      key: 'actions',
      header: ko.common.actions,
      render: (row: LeavePolicyLocal) => (
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
        title={ko.leave.policySettings}
        description="휴가 정책을 등록하고 관리합니다."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            {ko.common.create}
          </Button>
        }
      />

      {/* ─── DataTable ─── */}
      <DataTable
        columns={columns as unknown as DataTableColumn<Record<string, unknown>>[]}
        data={policies as unknown as Record<string, unknown>[]}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage={ko.common.noData}
        rowKey={(row) => (row as unknown as LeavePolicyLocal).id}
      />

      {/* ─── Create / Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? `${ko.leave.policy} ${ko.common.edit}`
                : `${ko.leave.policy} ${ko.common.create}`}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? '휴가 정책 정보를 수정합니다.'
                : '새 휴가 정책을 등록합니다.'}
            </DialogDescription>
          </DialogHeader>

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
            {/* name */}
            <div className="space-y-2">
              <Label htmlFor="policy-name">정책명</Label>
              <Input
                id="policy-name"
                placeholder="예: 연차휴가"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* leaveType */}
            <div className="space-y-2">
              <Label htmlFor="policy-leaveType">휴가 유형</Label>
              <Input
                id="policy-leaveType"
                placeholder="예: ANNUAL, SICK"
                {...register('leaveType')}
              />
              {errors.leaveType && (
                <p className="text-sm text-destructive">
                  {errors.leaveType.message}
                </p>
              )}
            </div>

            {/* defaultDays */}
            <div className="space-y-2">
              <Label htmlFor="policy-defaultDays">기본 부여일</Label>
              <Input
                id="policy-defaultDays"
                type="number"
                min={0}
                max={365}
                {...register('defaultDays')}
              />
              {errors.defaultDays && (
                <p className="text-sm text-destructive">
                  {errors.defaultDays.message}
                </p>
              )}
            </div>

            {/* isPaid */}
            <Controller
              control={control}
              name="isPaid"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="policy-isPaid"
                    checked={field.value}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                  />
                  <Label
                    htmlFor="policy-isPaid"
                    className="cursor-pointer"
                  >
                    {ko.leave.isPaid}
                  </Label>
                </div>
              )}
            />

            {/* carryOverAllowed */}
            <Controller
              control={control}
              name="carryOverAllowed"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="policy-carryOver"
                    checked={field.value}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                  />
                  <Label
                    htmlFor="policy-carryOver"
                    className="cursor-pointer"
                  >
                    {ko.leave.carryOver}
                  </Label>
                </div>
              )}
            />

            {/* maxCarryOverDays (conditional) */}
            {carryOverAllowed && (
              <div className="space-y-2">
                <Label htmlFor="policy-maxCarryOver">
                  {ko.leave.maxCarryOver}
                </Label>
                <Input
                  id="policy-maxCarryOver"
                  type="number"
                  min={0}
                  max={365}
                  {...register('maxCarryOverDays')}
                />
                {errors.maxCarryOverDays && (
                  <p className="text-sm text-destructive">
                    {errors.maxCarryOverDays.message}
                  </p>
                )}
              </div>
            )}

            {/* minTenureMonths */}
            <div className="space-y-2">
              <Label htmlFor="policy-minTenure">최소 근속 개월수</Label>
              <Input
                id="policy-minTenure"
                type="number"
                min={0}
                placeholder="선택 사항"
                {...register('minTenureMonths')}
              />
              {errors.minTenureMonths && (
                <p className="text-sm text-destructive">
                  {errors.minTenureMonths.message}
                </p>
              )}
            </div>

            {/* minUnit */}
            <div className="space-y-2">
              <Label>{ko.leave.minUnit}</Label>
              <Controller
                control={control}
                name="minUnit"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={ko.common.selectPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL_DAY">
                        {ko.leave.fullDay}
                      </SelectItem>
                      <SelectItem value="HALF_DAY">
                        {ko.leave.halfDay}
                      </SelectItem>
                      <SelectItem value="QUARTER_DAY">
                        {ko.leave.quarterDay}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.minUnit && (
                <p className="text-sm text-destructive">
                  {errors.minUnit.message}
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
            <AlertDialogTitle>휴가 정책 삭제</AlertDialogTitle>
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
