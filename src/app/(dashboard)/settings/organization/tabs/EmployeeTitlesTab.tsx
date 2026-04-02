'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TABLE_STYLES } from '@/lib/styles'
import { toast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Props { companyId: string | null }

interface EmployeeTitle {
  id: string
  code: string
  name: string
  nameEn: string | null
  rankOrder: number
  isExecutive: boolean
  companyId: string
}

export function EmployeeTitlesTab({ companyId }: Props) {
  const t = useTranslations('settings')
  const [titles, setTitles] = useState<EmployeeTitle[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<EmployeeTitle>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ code: '', name: '', nameEn: '', isExecutive: false })

  const fetchTitles = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await apiClient.get<EmployeeTitle[]>('/api/v1/settings/employee-titles')
      setTitles(data)
    } catch {
      toast({ title: t('common.loadFailed'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTitles() }, [fetchTitles])

  const handleAdd = async () => {
    if (!addForm.code || !addForm.name) {
      toast({ title: t('common.codeAndNameRequired'), variant: 'destructive' })
      return
    }
    const maxRank = titles.length > 0 ? Math.max(...titles.map(t => t.rankOrder)) + 1 : 1
    try {
      await apiClient.post('/api/v1/settings/employee-titles', { ...addForm, rankOrder: maxRank })
      toast({ title: t('common.addSuccess', { name: '' }) })
      setShowAdd(false)
      setAddForm({ code: '', name: '', nameEn: '', isExecutive: false })
      fetchTitles()
    } catch (err) {
      toast({ title: t('common.addFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
  }

  const handleUpdate = async (id: string) => {
    try {
      await apiClient.put(`/api/v1/settings/employee-titles?id=${id}`, editForm)
      toast({ title: t('common.updateSuccess') })
      setEditingId(null)
      fetchTitles()
    } catch (err) {
      toast({ title: t('common.updateFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.deleteConfirm', { name: t('employeeTitles.colTitle') }))) return
    try {
      await apiClient.delete(`/api/v1/settings/employee-titles?id=${id}`)
      toast({ title: t('common.deleteSuccess') })
      fetchTitles()
    } catch (err) {
      toast({ title: t('common.deleteFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
  }

  const startEdit = (t: EmployeeTitle) => {
    setEditingId(t.id)
    setEditForm({ name: t.name, nameEn: t.nameEn, isExecutive: t.isExecutive })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('employeeTitles.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('employeeTitles.description', { count: titles.length })}</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="mr-1 h-4 w-4" /> {t('common.add')}
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <p className="text-sm font-medium">{t('employeeTitles.addNew')}</p>
          <div className="grid grid-cols-4 gap-2">
            <Input placeholder={t('employeeTitles.codePlaceholder')} value={addForm.code} onChange={e => setAddForm(p => ({ ...p, code: e.target.value }))} />
            <Input placeholder={t('employeeTitles.namePlaceholder')} value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} />
            <Input placeholder={t('employeeTitles.nameEnPlaceholder')} value={addForm.nameEn} onChange={e => setAddForm(p => ({ ...p, nameEn: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={addForm.isExecutive} onChange={e => setAddForm(p => ({ ...p, isExecutive: e.target.checked }))} />
              {t('common.executive')}
            </label>
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
              <th className={TABLE_STYLES.headerCell}>{t('employeeTitles.colCode')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('employeeTitles.colTitle')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('employeeTitles.colNameEn')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('employeeTitles.colType')}</th>
              <th className={TABLE_STYLES.headerCell} style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</td></tr>
            ) : titles.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">{t('employeeTitles.emptyState')}</td></tr>
            ) : titles.map((ti) => (
              <tr key={ti.id} className={TABLE_STYLES.row}>
                <td className={`${TABLE_STYLES.cell} font-medium text-primary`}>{ti.code}</td>
                <td className={TABLE_STYLES.cell}>
                  {editingId === ti.id ? (
                    <Input className="h-7 text-sm" value={editForm.name ?? ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
                  ) : ti.name}
                </td>
                <td className={`${TABLE_STYLES.cell} text-muted-foreground`}>
                  {editingId === ti.id ? (
                    <Input className="h-7 text-sm" value={editForm.nameEn ?? ''} onChange={e => setEditForm(p => ({ ...p, nameEn: e.target.value }))} />
                  ) : ti.nameEn ?? '—'}
                </td>
                <td className={TABLE_STYLES.cell}>
                  <span className={cn('inline-block rounded px-2 py-0.5 text-xs font-medium', ti.isExecutive ? 'bg-amber-500/15 text-amber-700' : 'bg-muted text-muted-foreground')}>
                    {ti.isExecutive ? t('common.executive') : t('common.general')}
                  </span>
                </td>
                <td className={TABLE_STYLES.cell}>
                  {editingId === ti.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleUpdate(ti.id)}>{t('common.save')}</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingId(null)}>{t('common.cancel')}</Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(ti)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDelete(ti.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
