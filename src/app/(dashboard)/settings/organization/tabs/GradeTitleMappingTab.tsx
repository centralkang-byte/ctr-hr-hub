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
import { cn } from '@/lib/utils'

interface Props { companyId: string | null }

interface GradeTitleMappingRow {
  id: string
  companyId: string
  jobGrade: {
    id: string
    code: string
    name: string
    nameEn: string | null
    gradeType: string
    rankOrder: number
  }
  employeeTitle: {
    id: string
    code: string
    name: string
    nameEn: string | null
    isExecutive: boolean
    rankOrder: number
  }
}

const GRADE_TYPE_LABEL_KEYS: Record<string, string> = {
  STAFF: 'gradeTitleMappings.gradeTypeStaff',
  SPECIALIST: 'gradeTitleMappings.gradeTypeSpecialist',
  EXECUTIVE: 'gradeTitleMappings.gradeTypeExecutive',
}

const GRADE_TYPE_COLORS: Record<string, string> = {
  STAFF: 'bg-primary/10 text-primary',
  SPECIALIST: 'bg-purple-500/15 text-purple-700',
  EXECUTIVE: 'bg-amber-500/15 text-amber-700',
}

const GRADE_TYPE_PREFIX: Record<string, string> = {
  STAFF: 'L',
  SPECIALIST: 'S',
  EXECUTIVE: 'E',
}

export function GradeTitleMappingTab({ companyId }: Props) {
  const t = useTranslations('settings')
  const [mappings, setMappings] = useState<GradeTitleMappingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ titleName: '', titleNameEn: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ gradeType: 'STAFF', titleName: '', titleNameEn: '' })

  const fetchMappings = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | undefined> = {}
      if (filter !== 'all') params.gradeType = filter
      if (companyId) params.companyId = companyId
      const { data } = await apiClient.get<GradeTitleMappingRow[]>('/api/v1/settings/grade-title-mappings', params)
      setMappings(data)
    } catch {
      toast({ title: t('common.loadFailed'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [filter, companyId, t])

  useEffect(() => { fetchMappings() }, [fetchMappings])

  // 다음 grade code 자동 계산 (L1→L2→L3...)
  const getNextGradeCode = (gradeType: string) => {
    const prefix = GRADE_TYPE_PREFIX[gradeType] ?? 'L'
    const existing = mappings
      .filter(m => m.jobGrade.gradeType === gradeType)
      .map(m => {
        const num = parseInt(m.jobGrade.code.replace(prefix, ''), 10)
        return isNaN(num) ? 0 : num
      })
    const maxNum = existing.length > 0 ? Math.max(...existing) : 0
    return `${prefix}${maxNum + 1}`
  }

  const handleAdd = async () => {
    if (!addForm.titleName) {
      toast({ title: t('common.titleNameRequired'), variant: 'destructive' })
      return
    }
    const gradeCode = getNextGradeCode(addForm.gradeType)
    const maxRank = mappings.length > 0 ? Math.max(...mappings.map(m => m.jobGrade.rankOrder)) + 1 : 1

    try {
      await apiClient.post('/api/v1/settings/grade-title-mappings', {
        gradeCode,
        gradeType: addForm.gradeType,
        rankOrder: maxRank,
        titleName: addForm.titleName,
        titleNameEn: addForm.titleNameEn || undefined,
        ...(companyId ? { companyId } : {}),
      })
      toast({ title: t('common.addSuccess', { name: '' }) })
      setShowAdd(false)
      setAddForm({ gradeType: 'STAFF', titleName: '', titleNameEn: '' })
      fetchMappings()
    } catch (err) {
      toast({ title: t('common.addFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
  }

  const handleUpdate = async (id: string) => {
    try {
      await apiClient.put(`/api/v1/settings/grade-title-mappings?id=${id}`, editForm)
      toast({ title: t('common.updateSuccess') })
      setEditingId(null)
      fetchMappings()
    } catch (err) {
      toast({ title: t('common.updateFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.deleteConfirm', { name: t('gradeTitleMappings.title') }))) return
    try {
      await apiClient.delete(`/api/v1/settings/grade-title-mappings?id=${id}`)
      toast({ title: t('common.deleteSuccess') })
      fetchMappings()
    } catch (err) {
      toast({ title: t('common.deleteFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
  }

  const startEdit = (m: GradeTitleMappingRow) => {
    setEditingId(m.id)
    setEditForm({ titleName: m.employeeTitle.name, titleNameEn: m.employeeTitle.nameEn ?? '' })
  }

  // gradeType별 그룹 카운트
  const groupCounts = mappings.reduce<Record<string, number>>((acc, m) => {
    acc[m.jobGrade.gradeType] = (acc[m.jobGrade.gradeType] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('gradeTitleMappings.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('gradeTitleMappings.description', { count: mappings.length })}
            {Object.entries(groupCounts).map(([type, count]) =>
              t('gradeTitleMappings.groupCountItem', { prefix: GRADE_TYPE_PREFIX[type] ?? type, count })
            ).join('')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              <SelectItem value="STAFF">{t('gradeTitleMappings.gradeTypeStaff')}</SelectItem>
              <SelectItem value="SPECIALIST">{t('gradeTitleMappings.gradeTypeSpecialist')}</SelectItem>
              <SelectItem value="EXECUTIVE">{t('gradeTitleMappings.gradeTypeExecutive')}</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-4 w-4" /> {t('common.add')}
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <p className="text-sm font-medium">{t('gradeTitleMappings.addNew')}</p>
          <div className="grid grid-cols-4 gap-2">
            <Select value={addForm.gradeType} onValueChange={v => setAddForm(p => ({ ...p, gradeType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="STAFF">{t('gradeTitleMappings.gradeTypeStaff')}</SelectItem>
                <SelectItem value="SPECIALIST">{t('gradeTitleMappings.gradeTypeSpecialist')}</SelectItem>
                <SelectItem value="EXECUTIVE">{t('gradeTitleMappings.gradeTypeExecutive')}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center text-sm text-muted-foreground">
              {t('gradeTitleMappings.codeLabel')} <span className="ml-1 font-mono font-medium text-primary">{getNextGradeCode(addForm.gradeType)}</span> ({t('gradeTitleMappings.codeAuto')})
            </div>
            <Input placeholder={t('gradeTitleMappings.titleNamePlaceholder')} value={addForm.titleName} onChange={e => setAddForm(p => ({ ...p, titleName: e.target.value }))} />
            <Input placeholder={t('gradeTitleMappings.titleNameEnPlaceholder')} value={addForm.titleNameEn} onChange={e => setAddForm(p => ({ ...p, titleNameEn: e.target.value }))} />
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
              <th className={TABLE_STYLES.headerCell}>{t('gradeTitleMappings.colType')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('gradeTitleMappings.colGradeCode')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('gradeTitleMappings.colTitle')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('gradeTitleMappings.colTitleEn')}</th>
              <th className={TABLE_STYLES.headerCell} style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</td></tr>
            ) : mappings.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">{t('gradeTitleMappings.emptyState')}</td></tr>
            ) : mappings.map((m) => (
              <tr key={m.id} className={TABLE_STYLES.row}>
                <td className={TABLE_STYLES.cell}>
                  <span className={cn('inline-block rounded px-2 py-0.5 text-xs font-medium', GRADE_TYPE_COLORS[m.jobGrade.gradeType] ?? 'bg-muted text-muted-foreground')}>
                    {t(GRADE_TYPE_LABEL_KEYS[m.jobGrade.gradeType] ?? m.jobGrade.gradeType)}
                  </span>
                </td>
                <td className={`${TABLE_STYLES.cell} font-mono font-medium text-primary`}>{m.jobGrade.code}</td>
                <td className={TABLE_STYLES.cell}>
                  {editingId === m.id ? (
                    <Input className="h-7 text-sm" value={editForm.titleName} onChange={e => setEditForm(p => ({ ...p, titleName: e.target.value }))} />
                  ) : m.employeeTitle.name}
                </td>
                <td className={`${TABLE_STYLES.cell} text-muted-foreground`}>
                  {editingId === m.id ? (
                    <Input className="h-7 text-sm" value={editForm.titleNameEn} onChange={e => setEditForm(p => ({ ...p, titleNameEn: e.target.value }))} />
                  ) : m.employeeTitle.nameEn ?? '—'}
                </td>
                <td className={TABLE_STYLES.cell}>
                  {editingId === m.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleUpdate(m.id)}>{t('common.save')}</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingId(null)}>{t('common.cancel')}</Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDelete(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
