// ═══════════════════════════════════════════════════════════
// CTR HR Hub — OrgChangesClient (Client Component)
// 조직개편 관리: 이력 목록 + 단건 변경 실행 + before/after diff
// ═══════════════════════════════════════════════════════════

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/PageHeader'
import { apiClient } from '@/lib/api'
import { ROLE } from '@/lib/constants'
import type { SessionUser, RefOption, PaginationInfo, SortDirection } from '@/types'

// ─── Types ─────────────────────────────────────────────────

type OrgChangeType = 'CREATE' | 'MERGE' | 'SPLIT' | 'RENAME' | 'CLOSE' | 'RESTRUCTURE'

type HistoryRow = {
  id: string
  changeType: OrgChangeType
  effectiveDate: string
  affectedDepartmentId: string | null
  fromData: Record<string, unknown> | null
  toData: Record<string, unknown> | null
  reason: string | null
  approvedBy: string | null
  createdAt: string
  approver: { id: string; name: string } | null
}

const CHANGE_TYPE_COLORS: Record<OrgChangeType, string> = {
  CREATE: 'bg-green-100 text-green-800',
  MERGE: 'bg-blue-100 text-blue-800',
  SPLIT: 'bg-purple-100 text-purple-800',
  RENAME: 'bg-yellow-100 text-yellow-800',
  CLOSE: 'bg-red-100 text-red-800',
  RESTRUCTURE: 'bg-ctr-gray-100 text-ctr-gray-800',
}

// ─── JSON Diff Viewer ───────────────────────────────────────

function JsonDiffViewer({
  from,
  to,
  noChangeDataLabel,
  beforeLabel,
  afterLabel,
}: {
  from: Record<string, unknown> | null
  to: Record<string, unknown> | null
  noChangeDataLabel: string
  beforeLabel: string
  afterLabel: string
}) {
  if (!from && !to) return <p className="text-xs text-ctr-gray-500">{noChangeDataLabel}</p>

  const allKeys = Array.from(
    new Set([...Object.keys(from ?? {}), ...Object.keys(to ?? {})]),
  )

  return (
    <div className="text-xs font-mono space-y-0.5">
      {allKeys.map((key) => {
        const fromVal = from?.[key]
        const toVal = to?.[key]
        const changed = JSON.stringify(fromVal) !== JSON.stringify(toVal)

        return (
          <div
            key={key}
            className={`flex gap-4 px-2 py-0.5 rounded ${changed ? 'bg-yellow-50' : ''}`}
          >
            <span className="w-32 shrink-0 text-ctr-gray-500">{key}</span>
            <span className={`w-40 shrink-0 ${changed ? 'text-red-600 line-through' : 'text-ctr-gray-700'}`}>
              {fromVal !== undefined ? String(fromVal) : '—'}
            </span>
            {changed && (
              <span className="text-green-700">{toVal !== undefined ? String(toVal) : '—'}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Expandable history row ─────────────────────────────────

function ExpandableRow({
  row,
  changeTypeLabels,
  noChangeDataLabel,
  beforeAfterLabel,
  fieldLabel,
  beforeLabel,
  afterLabel,
}: {
  row: HistoryRow
  changeTypeLabels: Record<OrgChangeType, string>
  noChangeDataLabel: string
  beforeAfterLabel: string
  fieldLabel: string
  beforeLabel: string
  afterLabel: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr className="border-b border-ctr-gray-100 hover:bg-ctr-gray-50 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <td className="px-4 py-3 text-sm text-ctr-gray-700">
          {new Date(row.effectiveDate).toLocaleDateString('ko-KR')}
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CHANGE_TYPE_COLORS[row.changeType]}`}>
            {changeTypeLabels[row.changeType]}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-ctr-gray-700">
          {row.reason ?? '—'}
        </td>
        <td className="px-4 py-3 text-sm text-ctr-gray-700">
          {row.approver?.name ?? row.approvedBy ?? '—'}
        </td>
        <td className="px-4 py-3 text-ctr-gray-500">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-ctr-gray-50">
          <td colSpan={5} className="px-6 py-3">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-ctr-gray-500 uppercase tracking-wide">
                {beforeAfterLabel}
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs text-ctr-gray-500 font-mono px-2">
                <span className="w-32">{fieldLabel}</span>
                <span className="w-40">{beforeLabel}</span>
                <span>{afterLabel}</span>
              </div>
              <JsonDiffViewer
                from={row.fromData}
                to={row.toData}
                noChangeDataLabel={noChangeDataLabel}
                beforeLabel={beforeLabel}
                afterLabel={afterLabel}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Change Dialog ──────────────────────────────────────────

interface ChangeDialogProps {
  open: boolean
  onClose: () => void
  departments: RefOption[]
  companyId: string
  onSuccess: () => void
}

type FormState = {
  changeType: OrgChangeType
  effectiveDate: string
  reason: string
  // CREATE
  newDeptName: string
  newDeptCode: string
  newDeptLevel: string
  parentDeptId: string
  // RENAME / CLOSE / SPLIT
  targetDeptId: string
  newName: string
  // MERGE
  sourceDeptIds: string[]
  mergeToDeptId: string
}

const INITIAL_FORM: FormState = {
  changeType: 'CREATE',
  effectiveDate: new Date().toISOString().split('T')[0],
  reason: '',
  newDeptName: '',
  newDeptCode: '',
  newDeptLevel: '1',
  parentDeptId: '',
  targetDeptId: '',
  newName: '',
  sourceDeptIds: [],
  mergeToDeptId: '',
}

function ChangeDialog({ open, onClose, departments, companyId, onSuccess }: ChangeDialogProps) {
  const t = useTranslations('orgChanges')
  const tc = useTranslations('common')

  const CHANGE_TYPE_LABELS: Record<OrgChangeType, string> = {
    CREATE: t('createDept'),
    MERGE: t('mergeDept'),
    SPLIT: t('splitDept'),
    RENAME: t('renameDept'),
    CLOSE: t('closeDept'),
    RESTRUCTURE: t('restructure'),
  }

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  )

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    try {
      let body: Record<string, unknown> = {
        changeType: form.changeType,
        companyId,
        effectiveDate: form.effectiveDate,
        reason: form.reason || undefined,
      }

      if (form.changeType === 'CREATE') {
        body = {
          ...body,
          toData: {
            name: form.newDeptName,
            code: form.newDeptCode,
            level: Number(form.newDeptLevel),
            parentId: form.parentDeptId || null,
          },
        }
      } else if (form.changeType === 'RENAME') {
        body = {
          ...body,
          affectedDepartmentId: form.targetDeptId,
          fromData: { name: departments.find((d) => d.id === form.targetDeptId)?.name },
          toData: { name: form.newName },
        }
      } else if (form.changeType === 'CLOSE') {
        body = {
          ...body,
          affectedDepartmentId: form.targetDeptId,
          fromData: { isActive: true },
          toData: { isActive: false },
        }
      } else if (form.changeType === 'MERGE') {
        body = {
          ...body,
          affectedDepartmentId: form.mergeToDeptId,
          fromData: { sourceDepartmentIds: form.sourceDeptIds },
          toData: { targetDepartmentId: form.mergeToDeptId },
        }
      } else if (form.changeType === 'SPLIT') {
        body = {
          ...body,
          affectedDepartmentId: form.targetDeptId,
          toData: {
            newDeptName: form.newDeptName,
            newDeptCode: form.newDeptCode,
          },
        }
      }

      await apiClient.post('/api/v1/org/restructure', body)
      onSuccess()
      onClose()
      setForm(INITIAL_FORM)
    } catch {
      setError(t('processingError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('executeDialog')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Change type selector */}
          <div className="space-y-1.5">
            <Label>{t('changeType')}</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CHANGE_TYPE_LABELS) as OrgChangeType[])
                .filter((tp) => tp !== 'RESTRUCTURE')
                .map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => set('changeType', tp)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      form.changeType === tp
                        ? 'border-ctr-primary bg-ctr-primary text-white'
                        : 'border-ctr-gray-300 text-ctr-gray-700 hover:border-ctr-primary'
                    }`}
                  >
                    {CHANGE_TYPE_LABELS[tp]}
                  </button>
                ))}
            </div>
          </div>

          {/* Effective date */}
          <div className="space-y-1.5">
            <Label>{t('effectiveDate')}</Label>
            <Input
              type="date"
              value={form.effectiveDate}
              onChange={(e) => set('effectiveDate', e.target.value)}
            />
          </div>

          {/* Dynamic fields per change type */}
          {form.changeType === 'CREATE' && (
            <>
              <div className="space-y-1.5">
                <Label>{t('deptName')}</Label>
                <Input
                  value={form.newDeptName}
                  onChange={(e) => set('newDeptName', e.target.value)}
                  placeholder={t('exampleDeptName')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('code')}</Label>
                  <Input
                    value={form.newDeptCode}
                    onChange={(e) => set('newDeptCode', e.target.value)}
                    placeholder={t('exampleDeptCode')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('level')}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={form.newDeptLevel}
                    onChange={(e) => set('newDeptLevel', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t('parentDeptOptional')}</Label>
                <select
                  value={form.parentDeptId}
                  onChange={(e) => set('parentDeptId', e.target.value)}
                  className="w-full text-sm border border-ctr-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ctr-primary"
                >
                  <option value="">{t('noParent')}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {(form.changeType === 'RENAME' || form.changeType === 'CLOSE' || form.changeType === 'SPLIT') && (
            <div className="space-y-1.5">
              <Label>{t('targetDept')}</Label>
              <select
                value={form.targetDeptId}
                onChange={(e) => set('targetDeptId', e.target.value)}
                className="w-full text-sm border border-ctr-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ctr-primary"
              >
                <option value="">{tc('selectPlaceholder')}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {form.changeType === 'RENAME' && (
            <div className="space-y-1.5">
              <Label>{t('newDeptName')}</Label>
              <Input
                value={form.newName}
                onChange={(e) => set('newName', e.target.value)}
                placeholder={t('newDeptNamePlaceholder')}
              />
            </div>
          )}

          {form.changeType === 'SPLIT' && (
            <>
              <div className="space-y-1.5">
                <Label>{t('newDeptForSplit')}</Label>
                <Input
                  value={form.newDeptName}
                  onChange={(e) => set('newDeptName', e.target.value)}
                  placeholder={t('newDeptForSplitPlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('newDeptCodeForSplit')}</Label>
                <Input
                  value={form.newDeptCode}
                  onChange={(e) => set('newDeptCode', e.target.value)}
                  placeholder={t('newDeptCodePlaceholder')}
                />
              </div>
            </>
          )}

          {form.changeType === 'MERGE' && (
            <>
              <div className="space-y-1.5">
                <Label>{t('mergeSourceDepts')}</Label>
                <select
                  multiple
                  size={4}
                  value={form.sourceDeptIds}
                  onChange={(e) =>
                    set(
                      'sourceDeptIds',
                      Array.from(e.target.selectedOptions).map((o) => o.value),
                    )
                  }
                  className="w-full text-sm border border-ctr-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ctr-primary"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <p className="text-xs text-ctr-gray-500">{t('multiSelectHint')}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t('mergeTargetDept')}</Label>
                <select
                  value={form.mergeToDeptId}
                  onChange={(e) => set('mergeToDeptId', e.target.value)}
                  className="w-full text-sm border border-ctr-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ctr-primary"
                >
                  <option value="">{tc('selectPlaceholder')}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <Label>{t('reasonOptional')}</Label>
            <Input
              value={form.reason}
              onChange={(e) => set('reason', e.target.value)}
              placeholder={t('reasonPlaceholder')}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-ctr-primary hover:bg-ctr-primary/90 text-white"
          >
            {submitting ? t('processing') : t('execute')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── OrgChangesClient ───────────────────────────────────────

interface OrgChangesClientProps {
  user: SessionUser
  companies: RefOption[]
  departments: RefOption[]
}

export function OrgChangesClient({ user, companies, departments }: OrgChangesClientProps) {
  const t = useTranslations('orgChanges')
  const tc = useTranslations('common')

  const CHANGE_TYPE_LABELS: Record<OrgChangeType, string> = {
    CREATE: t('createDept'),
    MERGE: t('mergeDept'),
    SPLIT: t('splitDept'),
    RENAME: t('renameDept'),
    CLOSE: t('closeDept'),
    RESTRUCTURE: t('restructure'),
  }

  const isSuperAdmin = user.role === ROLE.SUPER_ADMIN

  const [history, setHistory] = useState<HistoryRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState<OrgChangeType | ''>('')
  const [filterCompanyId, setFilterCompanyId] = useState<string>(
    isSuperAdmin ? '' : user.companyId,
  )
  const [sortBy, setSortBy] = useState<string>('effectiveDate')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')
  const [showDialog, setShowDialog] = useState(false)

  const activeDepts = useMemo(
    () =>
      isSuperAdmin
        ? departments
        : departments,
    [departments, isSuperAdmin],
  )

  const loadHistory = useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const params: Record<string, string | number> = {
          page,
          limit: 20,
          sortBy,
          sortDir,
        }
        if (filterType) params.changeType = filterType
        if (filterCompanyId) params.companyId = filterCompanyId

        const res = await apiClient.getList<HistoryRow>('/api/v1/org/change-history', params)
        setHistory(res.data)
        setPagination(res.pagination)
      } catch {
        setHistory([])
      } finally {
        setLoading(false)
      }
    },
    [filterType, filterCompanyId, sortBy, sortDir],
  )

  useEffect(() => {
    loadHistory(1)
  }, [loadHistory])

  const handleSort = useCallback(
    (key: string) => {
      if (sortBy === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortBy(key)
        setSortDir('desc')
      }
    },
    [sortBy],
  )

  // Custom table (expandable rows) — use raw table instead of DataTable
  const companyForChange = isSuperAdmin
    ? (filterCompanyId || (companies[0]?.id ?? ''))
    : user.companyId

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button
            onClick={() => setShowDialog(true)}
            className="bg-ctr-primary hover:bg-ctr-primary/90 text-white"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {t('execute')}
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {isSuperAdmin && (
          <select
            value={filterCompanyId}
            onChange={(e) => setFilterCompanyId(e.target.value)}
            className="text-sm border border-ctr-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ctr-primary"
          >
            <option value="">{t('allCompanies')}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as OrgChangeType | '')}
          className="text-sm border border-ctr-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ctr-primary"
        >
          <option value="">{t('allTypes')}</option>
          {(Object.entries(CHANGE_TYPE_LABELS) as [OrgChangeType, string][]).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* History table — custom expandable rows */}
      <div className="rounded-lg border border-ctr-gray-200 overflow-hidden bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ctr-gray-200 bg-ctr-gray-50">
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-ctr-gray-500 uppercase tracking-wide cursor-pointer hover:text-ctr-gray-900"
                onClick={() => handleSort('effectiveDate')}
              >
                {t('effectiveDate')}
                {sortBy === 'effectiveDate' && (
                  <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-ctr-gray-500 uppercase tracking-wide">
                {t('changeType')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-ctr-gray-500 uppercase tracking-wide">
                {t('reason')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-ctr-gray-500 uppercase tracking-wide">
                {t('approver')}
              </th>
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-ctr-gray-100">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-ctr-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-ctr-gray-500">
                  {t('noHistory')}
                </td>
              </tr>
            ) : (
              history.map((row) => (
                <ExpandableRow
                  key={row.id}
                  row={row}
                  changeTypeLabels={CHANGE_TYPE_LABELS}
                  noChangeDataLabel={t('noChangeData')}
                  beforeAfterLabel={t('beforeAfterCompare')}
                  fieldLabel={t('field')}
                  beforeLabel={t('before')}
                  afterLabel={t('after')}
                />
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-ctr-gray-200">
            <p className="text-xs text-ctr-gray-500">
              {t('totalCount', { total: pagination.total })}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => loadHistory(pagination.page - 1)}
              >
                {tc('prev')}
              </Button>
              <span className="px-3 py-1 text-sm text-ctr-gray-700">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadHistory(pagination.page + 1)}
              >
                {tc('next')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Change dialog */}
      <ChangeDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        departments={activeDepts}
        companyId={companyForChange}
        onSuccess={() => loadHistory(1)}
      />
    </div>
  )
}
