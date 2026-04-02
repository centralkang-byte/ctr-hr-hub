'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TABLE_STYLES } from '@/lib/styles'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface Props { companyId: string | null }

interface JobGrade {
  id: string
  code: string
  name: string
  nameEn: string | null
  rankOrder: number
  gradeType: string
  minPromotionYears: number | null
  companyId: string
}

const GRADE_TYPE_LABEL_KEYS: Record<string, string> = {
  STAFF: 'jobGrades.gradeTypeStaff',
  SPECIALIST: 'jobGrades.gradeTypeSpecialist',
  EXECUTIVE: 'jobGrades.gradeTypeExecutive',
}

const GRADE_TYPE_COLORS: Record<string, string> = {
  STAFF: 'bg-primary/10 text-primary',
  SPECIALIST: 'bg-purple-500/15 text-purple-700',
  EXECUTIVE: 'bg-amber-500/15 text-amber-700',
}

export function JobGradesTab({ companyId }: Props) {
  const t = useTranslations('settings')
  const [grades, setGrades] = useState<JobGrade[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<JobGrade>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ code: '', name: '', nameEn: '', gradeType: 'STAFF', minPromotionYears: '' })

  const fetchGrades = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('gradeType', filter)
    const res = await fetch(`/api/v1/settings/job-grades?${params}`)
    const json = await res.json()
    if (json.data) setGrades(json.data)
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchGrades() }, [fetchGrades])

  const handleAdd = async () => {
    if (!addForm.code || !addForm.name) {
      toast({ title: t('common.codeAndNameRequired'), variant: 'destructive' })
      return
    }
    const maxRank = grades.length > 0 ? Math.max(...grades.map(g => g.rankOrder)) + 1 : 1
    const res = await fetch('/api/v1/settings/job-grades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...addForm,
        rankOrder: maxRank,
        minPromotionYears: addForm.minPromotionYears ? Number(addForm.minPromotionYears) : null,
      }),
    })
    if (res.ok) {
      toast({ title: t('common.addSuccess', { name: '' }) })
      setShowAdd(false)
      setAddForm({ code: '', name: '', nameEn: '', gradeType: 'STAFF', minPromotionYears: '' })
      fetchGrades()
    } else {
      const err = await res.json()
      toast({ title: t('common.addFailed'), description: err.error?.message, variant: 'destructive' })
    }
  }

  const handleUpdate = async (id: string) => {
    const res = await fetch(`/api/v1/settings/job-grades?id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    if (res.ok) {
      toast({ title: t('common.updateSuccess') })
      setEditingId(null)
      fetchGrades()
    } else {
      const err = await res.json()
      toast({ title: t('common.updateFailed'), description: err.error?.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.deleteConfirm', { name: t('jobGrades.title') }))) return
    const res = await fetch(`/api/v1/settings/job-grades?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: t('common.deleteSuccess') })
      fetchGrades()
    } else {
      const err = await res.json()
      toast({ title: t('common.deleteFailed'), description: err.error?.message, variant: 'destructive' })
    }
  }

  const startEdit = (g: JobGrade) => {
    setEditingId(g.id)
    setEditForm({ name: g.name, nameEn: g.nameEn, gradeType: g.gradeType, minPromotionYears: g.minPromotionYears })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('jobGrades.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('jobGrades.description', { count: grades.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              <SelectItem value="STAFF">{t('jobGrades.gradeTypeStaff')}</SelectItem>
              <SelectItem value="SPECIALIST">{t('jobGrades.gradeTypeSpecialist')}</SelectItem>
              <SelectItem value="EXECUTIVE">{t('jobGrades.gradeTypeExecutive')}</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-4 w-4" /> {t('common.add')}
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <p className="text-sm font-medium">{t('jobGrades.addNew')}</p>
          <div className="grid grid-cols-5 gap-2">
            <Input placeholder={t('jobGrades.codePlaceholder')} value={addForm.code} onChange={e => setAddForm(p => ({ ...p, code: e.target.value }))} />
            <Input placeholder={t('jobGrades.namePlaceholder')} value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} />
            <Input placeholder={t('jobGrades.nameEnPlaceholder')} value={addForm.nameEn} onChange={e => setAddForm(p => ({ ...p, nameEn: e.target.value }))} />
            <Select value={addForm.gradeType} onValueChange={v => setAddForm(p => ({ ...p, gradeType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="STAFF">{t('jobGrades.gradeTypeStaff')}</SelectItem>
                <SelectItem value="SPECIALIST">{t('jobGrades.gradeTypeSpecialist')}</SelectItem>
                <SelectItem value="EXECUTIVE">{t('jobGrades.gradeTypeExecutive')}</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder={t('jobGrades.minPromotionPlaceholder')} type="number" value={addForm.minPromotionYears} onChange={e => setAddForm(p => ({ ...p, minPromotionYears: e.target.value }))} />
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
              <th className={TABLE_STYLES.headerCell} style={{ width: 40 }}></th>
              <th className={TABLE_STYLES.headerCell}>{t('jobGrades.colCode')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('jobGrades.colName')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('jobGrades.colNameEn')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('jobGrades.colType')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('jobGrades.colMinPromotion')}</th>
              <th className={TABLE_STYLES.headerCell} style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</td></tr>
            ) : grades.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">{t('jobGrades.emptyState')}</td></tr>
            ) : grades.map((g) => (
              <tr key={g.id} className={TABLE_STYLES.row}>
                <td className={TABLE_STYLES.cell}><GripVertical className="h-4 w-4 text-muted-foreground" /></td>
                <td className={`${TABLE_STYLES.cell} font-medium text-primary`}>{g.code}</td>
                <td className={TABLE_STYLES.cell}>
                  {editingId === g.id ? (
                    <Input className="h-7 text-sm" value={editForm.name ?? ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
                  ) : g.name}
                </td>
                <td className={`${TABLE_STYLES.cell} text-muted-foreground`}>
                  {editingId === g.id ? (
                    <Input className="h-7 text-sm" value={editForm.nameEn ?? ''} onChange={e => setEditForm(p => ({ ...p, nameEn: e.target.value }))} />
                  ) : g.nameEn ?? '—'}
                </td>
                <td className={TABLE_STYLES.cell}>
                  <span className={cn('inline-block rounded px-2 py-0.5 text-xs font-medium', GRADE_TYPE_COLORS[g.gradeType] ?? 'bg-muted text-muted-foreground')}>
                    {t(GRADE_TYPE_LABEL_KEYS[g.gradeType] ?? g.gradeType)}
                  </span>
                </td>
                <td className={`${TABLE_STYLES.cell} text-center text-muted-foreground`}>
                  {g.minPromotionYears != null ? t('jobGrades.yearsUnit', { count: g.minPromotionYears }) : '—'}
                </td>
                <td className={TABLE_STYLES.cell}>
                  {editingId === g.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleUpdate(g.id)}>{t('common.save')}</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingId(null)}>{t('common.cancel')}</Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDelete(g.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
