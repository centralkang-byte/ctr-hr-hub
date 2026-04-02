'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TABLE_STYLES } from '@/lib/styles'
import { toast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'

interface Props { companyId: string | null }

interface Position {
  id: string
  code: string
  name: string
  nameEn: string | null
  companyId: string
  reportsToPositionId: string | null
  reportsToName: string | null
  jobGradeId: string | null
  jobGradeName: string | null
}

interface JobGrade {
  id: string
  name: string
  code: string
}

const NONE = '__none__'

export function PositionsTab({ companyId }: Props) {
  const t = useTranslations('settings')
  const [positions, setPositions] = useState<Position[]>([])
  const [grades, setGrades] = useState<JobGrade[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    name: string; nameEn: string; code: string
    reportsToPositionId: string; jobGradeId: string
  }>({ name: '', nameEn: '', code: '', reportsToPositionId: NONE, jobGradeId: NONE })
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    code: '', name: '', nameEn: '', reportsToPositionId: NONE, jobGradeId: NONE,
  })

  const fetchPositions = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | undefined> = {}
      if (companyId) params.companyId = companyId
      const { data } = await apiClient.get<Position[]>('/api/v1/positions', params)
      setPositions(data)
    } catch {
      toast({ title: t('common.loadFailed'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [companyId])

  const fetchGrades = useCallback(async () => {
    try {
      const { data } = await apiClient.get<JobGrade[]>('/api/v1/settings/job-grades')
      setGrades(data)
    } catch {
      // grades는 보조 데이터 — 실패 시 빈 배열 유지
    }
  }, [])

  useEffect(() => { fetchPositions() }, [fetchPositions])
  useEffect(() => { fetchGrades() }, [fetchGrades])

  const handleAdd = async () => {
    if (!addForm.code.trim() || !addForm.name.trim()) {
      toast({ title: t('common.codeAndPositionRequired'), variant: 'destructive' })
      return
    }
    try {
      await apiClient.post('/api/v1/positions', {
        ...addForm,
        companyId,
        reportsToPositionId: addForm.reportsToPositionId === NONE ? null : addForm.reportsToPositionId,
        jobGradeId: addForm.jobGradeId === NONE ? null : addForm.jobGradeId,
      })
      toast({ title: t('common.addSuccess', { name: '' }) })
      setShowAdd(false)
      setAddForm({ code: '', name: '', nameEn: '', reportsToPositionId: NONE, jobGradeId: NONE })
      fetchPositions()
    } catch (err) {
      toast({ title: t('common.addFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
  }

  const handleUpdate = async (id: string) => {
    try {
      await apiClient.put(`/api/v1/positions/${id}`, {
        titleKo: editForm.name,
        titleEn: editForm.nameEn || null,
        code: editForm.code,
        reportsToPositionId: editForm.reportsToPositionId === NONE ? null : editForm.reportsToPositionId,
        jobGradeId: editForm.jobGradeId === NONE ? null : editForm.jobGradeId,
      })
      toast({ title: t('common.updateSuccess') })
      setEditingId(null)
      fetchPositions()
    } catch (err) {
      toast({ title: t('common.updateFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.deleteConfirm', { name: t('positions.colName') }))) return
    try {
      await apiClient.delete(`/api/v1/positions/${id}`)
      toast({ title: t('common.deleteSuccess') })
      fetchPositions()
    } catch (err) {
      toast({ title: t('common.deleteFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
  }

  const startEdit = (p: Position) => {
    setEditingId(p.id)
    setEditForm({
      name: p.name,
      nameEn: p.nameEn ?? '',
      code: p.code,
      reportsToPositionId: p.reportsToPositionId ?? NONE,
      jobGradeId: p.jobGradeId ?? NONE,
    })
  }

  const otherPositions = (excludeId?: string) =>
    positions.filter(p => p.id !== excludeId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('positions.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('positions.description', { count: positions.length })}</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="mr-1 h-4 w-4" /> {t('positions.addNew')}
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <p className="text-sm font-medium">{t('positions.addNewForm')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder={t('positions.codePlaceholder')}
              value={addForm.code}
              onChange={e => setAddForm(p => ({ ...p, code: e.target.value }))}
            />
            <Input
              placeholder={t('positions.namePlaceholder')}
              value={addForm.name}
              onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
            />
            <Input
              placeholder={t('positions.nameEnPlaceholder')}
              value={addForm.nameEn}
              onChange={e => setAddForm(p => ({ ...p, nameEn: e.target.value }))}
            />
            <Select
              value={addForm.reportsToPositionId}
              onValueChange={v => setAddForm(p => ({ ...p, reportsToPositionId: v }))}
            >
              <SelectTrigger><SelectValue placeholder={t('positions.reportsToPlaceholder')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('common.none')}</SelectItem>
                {positions.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={addForm.jobGradeId}
              onValueChange={v => setAddForm(p => ({ ...p, jobGradeId: v }))}
            >
              <SelectTrigger><SelectValue placeholder={t('positions.linkedGradePlaceholder')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('common.none')}</SelectItem>
                {grades.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name} ({g.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd}>{t('common.save')}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>{t('common.cancel')}</Button>
          </div>
        </div>
      )}

      <div className={TABLE_STYLES.wrapper}>
        <table className={TABLE_STYLES.table}>
          <thead className={TABLE_STYLES.header}>
            <tr>
              <th className={TABLE_STYLES.headerCell}>{t('positions.colCode')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('positions.colName')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('positions.colReportsTo')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('positions.colLinkedGrade')}</th>
              <th className={TABLE_STYLES.headerCell} style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</td></tr>
            ) : positions.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">{t('positions.emptyState')}</td></tr>
            ) : positions.map((p) => (
              <tr key={p.id} className={TABLE_STYLES.row}>
                <td className={`${TABLE_STYLES.cell} font-medium text-primary`}>
                  {editingId === p.id ? (
                    <Input className="h-7 text-sm w-28" value={editForm.code} onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))} />
                  ) : p.code}
                </td>
                <td className={TABLE_STYLES.cell}>
                  {editingId === p.id ? (
                    <div className="space-y-1">
                      <Input className="h-7 text-sm" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                      <Input className="h-7 text-sm text-muted-foreground" placeholder={t('positions.nameEnPlaceholder')} value={editForm.nameEn} onChange={e => setEditForm(f => ({ ...f, nameEn: e.target.value }))} />
                    </div>
                  ) : (
                    <div>
                      <div>{p.name}</div>
                      {p.nameEn && <div className="text-xs text-muted-foreground">{p.nameEn}</div>}
                    </div>
                  )}
                </td>
                <td className={`${TABLE_STYLES.cell} text-muted-foreground`}>
                  {editingId === p.id ? (
                    <Select
                      value={editForm.reportsToPositionId}
                      onValueChange={v => setEditForm(f => ({ ...f, reportsToPositionId: v }))}
                    >
                      <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t('common.none')}</SelectItem>
                        {otherPositions(p.id).map(op => (
                          <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (p.reportsToName ?? '—')}
                </td>
                <td className={TABLE_STYLES.cell}>
                  {editingId === p.id ? (
                    <Select
                      value={editForm.jobGradeId}
                      onValueChange={v => setEditForm(f => ({ ...f, jobGradeId: v }))}
                    >
                      <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t('common.none')}</SelectItem>
                        {grades.map(g => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    p.jobGradeName
                      ? <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">{p.jobGradeName}</span>
                      : <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className={TABLE_STYLES.cell}>
                  {editingId === p.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleUpdate(p.id)}>{t('common.save')}</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingId(null)}>{t('common.cancel')}</Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
