'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, Shield, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TABLE_STYLES } from '@/lib/styles'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface Props { companyId: string | null }

interface LoaTypeRow {
  id: string
  code: string
  name: string
  nameEn: string | null
  category: string
  maxDurationDays: number | null
  payType: string
  payRate: number | null
  paySource: string | null
  eligibilityMonths: number | null
  countsAsService: boolean
  countsAsAttendance: boolean
  splittable: boolean
  maxSplitCount: number | null
  requiresProof: boolean
  proofDescription: string | null
  advanceNoticeDays: number | null
  reinstatementGuaranteed: boolean
  sortOrder: number
  isActive: boolean
}

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  STATUTORY: 'common.statutory',
  CONTRACTUAL: 'common.contractual',
}

const CATEGORY_COLORS: Record<string, string> = {
  STATUTORY: 'bg-primary/10 text-primary',
  CONTRACTUAL: 'bg-muted text-muted-foreground',
}

const PAY_TYPE_LABEL_KEYS: Record<string, string> = {
  PAID: 'loaTypes.payTypePaid',
  UNPAID: 'loaTypes.payTypeUnpaid',
  PARTIAL: 'loaTypes.payTypePartial',
  INSURANCE: 'loaTypes.payTypeInsurance',
  MIXED: 'loaTypes.payTypeMixed',
}

interface EditForm {
  name: string
  nameEn: string
  category: string
  maxDurationDays: string
  payType: string
  payRate: string
  eligibilityMonths: string
  countsAsService: boolean
  countsAsAttendance: boolean
  splittable: boolean
  maxSplitCount: string
  requiresProof: boolean
  proofDescription: string
  advanceNoticeDays: string
  reinstatementGuaranteed: boolean
}

const emptyForm: EditForm = {
  name: '', nameEn: '', category: 'CONTRACTUAL',
  maxDurationDays: '', payType: 'UNPAID', payRate: '',
  eligibilityMonths: '', countsAsService: false, countsAsAttendance: false,
  splittable: false, maxSplitCount: '', requiresProof: false,
  proofDescription: '', advanceNoticeDays: '', reinstatementGuaranteed: false,
}

export function LoaTypesTab({ companyId }: Props) {
  const t = useTranslations('settings')
  const [types, setTypes] = useState<LoaTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>(emptyForm)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<EditForm & { code: string }>({ ...emptyForm, code: '' })

  const fetchTypes = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (companyId) params.set('companyId', companyId)
    const res = await fetch(`/api/v1/leave-of-absence/types?${params}`)
    const json = await res.json()
    if (json.data) setTypes(json.data)
    setLoading(false)
  }, [companyId])

  useEffect(() => { fetchTypes() }, [fetchTypes])

  const handleAdd = async () => {
    if (!addForm.code.trim()) {
      toast({ title: t('common.codeRequired'), variant: 'destructive' })
      return
    }
    if (!addForm.name.trim()) {
      toast({ title: t('loaTypes.typeNameRequired'), variant: 'destructive' })
      return
    }
    const res = await fetch('/api/v1/leave-of-absence/types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: addForm.code,
        name: addForm.name,
        nameEn: addForm.nameEn || undefined,
        category: addForm.category,
        maxDurationDays: addForm.maxDurationDays ? Number(addForm.maxDurationDays) : null,
        payType: addForm.payType,
        payRate: addForm.payRate ? Number(addForm.payRate) : null,
        eligibilityMonths: addForm.eligibilityMonths ? Number(addForm.eligibilityMonths) : null,
        countsAsService: addForm.countsAsService,
        countsAsAttendance: addForm.countsAsAttendance,
        splittable: addForm.splittable,
        maxSplitCount: addForm.maxSplitCount ? Number(addForm.maxSplitCount) : null,
        requiresProof: addForm.requiresProof,
        proofDescription: addForm.proofDescription || undefined,
        advanceNoticeDays: addForm.advanceNoticeDays ? Number(addForm.advanceNoticeDays) : null,
        reinstatementGuaranteed: addForm.reinstatementGuaranteed,
      }),
    })
    if (res.ok) {
      toast({ title: t('loaTypes.addSuccess') })
      setShowAdd(false)
      setAddForm({ ...emptyForm, code: '' })
      fetchTypes()
    } else {
      const err = await res.json()
      toast({ title: t('common.addFailed'), description: err.error?.message, variant: 'destructive' })
    }
  }

  const handleUpdate = async (id: string) => {
    const res = await fetch(`/api/v1/leave-of-absence/types/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        nameEn: editForm.nameEn || null,
        category: editForm.category,
        maxDurationDays: editForm.maxDurationDays ? Number(editForm.maxDurationDays) : null,
        payType: editForm.payType,
        payRate: editForm.payRate ? Number(editForm.payRate) : null,
        eligibilityMonths: editForm.eligibilityMonths ? Number(editForm.eligibilityMonths) : null,
        countsAsService: editForm.countsAsService,
        countsAsAttendance: editForm.countsAsAttendance,
        splittable: editForm.splittable,
        maxSplitCount: editForm.maxSplitCount ? Number(editForm.maxSplitCount) : null,
        requiresProof: editForm.requiresProof,
        proofDescription: editForm.proofDescription || null,
        advanceNoticeDays: editForm.advanceNoticeDays ? Number(editForm.advanceNoticeDays) : null,
        reinstatementGuaranteed: editForm.reinstatementGuaranteed,
      }),
    })
    if (res.ok) {
      toast({ title: t('common.updateSuccess') })
      setEditingId(null)
      fetchTypes()
    } else {
      const err = await res.json()
      toast({ title: t('common.updateFailed'), description: err.error?.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.deleteConfirm', { name: t('loaTypes.colTypeName') }))) return
    const res = await fetch(`/api/v1/leave-of-absence/types/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: t('common.deleteSuccess') })
      fetchTypes()
    } else {
      const err = await res.json()
      toast({ title: t('common.deleteFailed'), description: err.error?.message, variant: 'destructive' })
    }
  }

  const startEdit = (lt: LoaTypeRow) => {
    setEditingId(lt.id)
    setEditForm({
      name: lt.name,
      nameEn: lt.nameEn ?? '',
      category: lt.category,
      maxDurationDays: lt.maxDurationDays?.toString() ?? '',
      payType: lt.payType,
      payRate: lt.payRate?.toString() ?? '',
      eligibilityMonths: lt.eligibilityMonths?.toString() ?? '',
      countsAsService: lt.countsAsService,
      countsAsAttendance: lt.countsAsAttendance,
      splittable: lt.splittable,
      maxSplitCount: lt.maxSplitCount?.toString() ?? '',
      requiresProof: lt.requiresProof,
      proofDescription: lt.proofDescription ?? '',
      advanceNoticeDays: lt.advanceNoticeDays?.toString() ?? '',
      reinstatementGuaranteed: lt.reinstatementGuaranteed,
    })
  }

  const statutoryCount = types.filter(lt => lt.category === 'STATUTORY').length
  const contractualCount = types.filter(lt => lt.category === 'CONTRACTUAL').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('loaTypes.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('loaTypes.description', { total: types.length, statutory: statutoryCount, contractual: contractualCount })}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4 mr-1" /> {t('common.add')}
        </Button>
      </div>

      {/* 추가 폼 */}
      {showAdd && (
        <div className="rounded-lg border border-border p-4 space-y-3 bg-background">
          <p className="text-sm font-medium">{t('loaTypes.addNew')}</p>
          <div className="grid grid-cols-4 gap-3">
            <Input placeholder={t('loaTypes.codePlaceholder')} value={addForm.code}
              onChange={e => setAddForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
            <Input placeholder={t('loaTypes.typeNameLabel')} value={addForm.name}
              onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} />
            <Input placeholder={t('loaTypes.nameEnLabel')} value={addForm.nameEn}
              onChange={e => setAddForm(p => ({ ...p, nameEn: e.target.value }))} />
            <Select value={addForm.category} onValueChange={v => setAddForm(p => ({ ...p, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="STATUTORY">{t('common.statutory')}</SelectItem>
                <SelectItem value="CONTRACTUAL">{t('common.contractual')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Input placeholder={t('loaTypes.maxDaysLabel')} type="number" value={addForm.maxDurationDays}
              onChange={e => setAddForm(p => ({ ...p, maxDurationDays: e.target.value }))} />
            <Select value={addForm.payType} onValueChange={v => setAddForm(p => ({ ...p, payType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PAID">{t('loaTypes.payTypePaid')}</SelectItem>
                <SelectItem value="UNPAID">{t('loaTypes.payTypeUnpaid')}</SelectItem>
                <SelectItem value="PARTIAL">{t('loaTypes.payTypePartial')}</SelectItem>
                <SelectItem value="INSURANCE">{t('loaTypes.payTypeInsurance')}</SelectItem>
                <SelectItem value="MIXED">{t('loaTypes.payTypeMixed')}</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder={t('loaTypes.payRateLabel')} type="number" value={addForm.payRate}
              onChange={e => setAddForm(p => ({ ...p, payRate: e.target.value }))} />
            <Input placeholder={t('loaTypes.eligibilityLabel')} type="number" value={addForm.eligibilityMonths}
              onChange={e => setAddForm(p => ({ ...p, eligibilityMonths: e.target.value }))} />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={addForm.requiresProof} onCheckedChange={v => setAddForm(p => ({ ...p, requiresProof: v }))} />
              {t('loaTypes.requiresProof')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={addForm.reinstatementGuaranteed} onCheckedChange={v => setAddForm(p => ({ ...p, reinstatementGuaranteed: v }))} />
              {t('loaTypes.reinstatementGuaranteed')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={addForm.splittable} onCheckedChange={v => setAddForm(p => ({ ...p, splittable: v }))} />
              {t('loaTypes.splittable')}
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowAdd(false); setAddForm({ ...emptyForm, code: '' }) }}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={handleAdd}>{t('common.add')}</Button>
          </div>
        </div>
      )}

      {/* 테이블 */}
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className={TABLE_STYLES.headerCell}>{t('loaTypes.colCode')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('loaTypes.colTypeName')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('loaTypes.colCategory')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('loaTypes.colMaxDays')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('loaTypes.colPay')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('loaTypes.colEligibility')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('loaTypes.colProof')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('loaTypes.colReinstatement')}</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('loaTypes.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {types.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-sm text-muted-foreground">{t('loaTypes.emptyState')}</td></tr>
              ) : types.map(lt => (
                <tr key={lt.id} className="border-b border-border last:border-0 hover:bg-background">
                  <td className={TABLE_STYLES.cell}>
                    <span className="font-mono text-xs text-muted-foreground">{lt.code}</span>
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {editingId === lt.id ? (
                      <div className="space-y-1">
                        <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="h-7 text-sm" />
                        <Input value={editForm.nameEn} placeholder={t('loaTypes.nameEnLabel')} onChange={e => setEditForm(p => ({ ...p, nameEn: e.target.value }))} className="h-7 text-sm" />
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-foreground">{lt.name}</p>
                        {lt.nameEn && <p className="text-xs text-muted-foreground">{lt.nameEn}</p>}
                      </div>
                    )}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', CATEGORY_COLORS[lt.category] ?? 'bg-muted')}>
                      {lt.category === 'STATUTORY' && <Shield className="h-3 w-3 mr-1" />}
                      {t(CATEGORY_LABEL_KEYS[lt.category] ?? lt.category)}
                    </span>
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {editingId === lt.id ? (
                      <Input type="number" value={editForm.maxDurationDays} onChange={e => setEditForm(p => ({ ...p, maxDurationDays: e.target.value }))} className="h-7 w-20 text-sm" />
                    ) : (
                      lt.maxDurationDays ? t('loaTypes.daysUnit', { count: lt.maxDurationDays }) : t('common.unlimited')
                    )}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {editingId === lt.id ? (
                      <Select value={editForm.payType} onValueChange={v => setEditForm(p => ({ ...p, payType: v }))}>
                        <SelectTrigger className="h-7 w-24 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PAID">{t('loaTypes.payTypePaid')}</SelectItem>
                          <SelectItem value="UNPAID">{t('loaTypes.payTypeUnpaid')}</SelectItem>
                          <SelectItem value="PARTIAL">{t('loaTypes.payTypePartial')}</SelectItem>
                          <SelectItem value="INSURANCE">{t('loaTypes.payTypeInsurance')}</SelectItem>
                          <SelectItem value="MIXED">{t('loaTypes.payTypeMixed')}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span>
                        {t(PAY_TYPE_LABEL_KEYS[lt.payType] ?? lt.payType)}
                        {lt.payRate != null && <span className="text-xs text-muted-foreground"> ({lt.payRate}%)</span>}
                      </span>
                    )}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {lt.eligibilityMonths ? t('loaTypes.monthsUnit', { count: lt.eligibilityMonths }) : '—'}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {lt.requiresProof ? (
                      <FileText className="h-4 w-4 text-blue-500" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {lt.reinstatementGuaranteed ? (
                      <Shield className="h-4 w-4 text-green-500" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={cn(TABLE_STYLES.cell, 'text-right')}>
                    {editingId === lt.id ? (
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" className="h-7" onClick={() => setEditingId(null)}>{t('common.cancel')}</Button>
                        <Button size="sm" className="h-7" onClick={() => handleUpdate(lt.id)}>{t('common.save')}</Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(lt)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-destructive" onClick={() => handleDelete(lt.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
