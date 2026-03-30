'use client'

import { useState, useEffect, useCallback } from 'react'
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

const CATEGORY_LABELS: Record<string, string> = {
  STATUTORY: '법정',
  CONTRACTUAL: '약정',
}

const CATEGORY_COLORS: Record<string, string> = {
  STATUTORY: 'bg-primary/10 text-primary',
  CONTRACTUAL: 'bg-muted text-muted-foreground',
}

const PAY_TYPE_LABELS: Record<string, string> = {
  PAID: '유급',
  UNPAID: '무급',
  PARTIAL: '부분유급',
  INSURANCE: '보험급여',
  MIXED: '혼합',
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
      toast({ title: '코드는 필수입니다', variant: 'destructive' })
      return
    }
    if (!addForm.name.trim()) {
      toast({ title: '유형명은 필수입니다', variant: 'destructive' })
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
      toast({ title: '휴직 유형이 추가되었습니다' })
      setShowAdd(false)
      setAddForm({ ...emptyForm, code: '' })
      fetchTypes()
    } else {
      const err = await res.json()
      toast({ title: '추가 실패', description: err.error?.message, variant: 'destructive' })
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
      toast({ title: '수정되었습니다' })
      setEditingId(null)
      fetchTypes()
    } else {
      const err = await res.json()
      toast({ title: '수정 실패', description: err.error?.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 휴직 유형을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/v1/leave-of-absence/types/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: '삭제되었습니다' })
      fetchTypes()
    } else {
      const err = await res.json()
      toast({ title: '삭제 실패', description: err.error?.message, variant: 'destructive' })
    }
  }

  const startEdit = (t: LoaTypeRow) => {
    setEditingId(t.id)
    setEditForm({
      name: t.name,
      nameEn: t.nameEn ?? '',
      category: t.category,
      maxDurationDays: t.maxDurationDays?.toString() ?? '',
      payType: t.payType,
      payRate: t.payRate?.toString() ?? '',
      eligibilityMonths: t.eligibilityMonths?.toString() ?? '',
      countsAsService: t.countsAsService,
      countsAsAttendance: t.countsAsAttendance,
      splittable: t.splittable,
      maxSplitCount: t.maxSplitCount?.toString() ?? '',
      requiresProof: t.requiresProof,
      proofDescription: t.proofDescription ?? '',
      advanceNoticeDays: t.advanceNoticeDays?.toString() ?? '',
      reinstatementGuaranteed: t.reinstatementGuaranteed,
    })
  }

  const statutoryCount = types.filter(t => t.category === 'STATUTORY').length
  const contractualCount = types.filter(t => t.category === 'CONTRACTUAL').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">휴직 유형 관리</h3>
          <p className="text-sm text-muted-foreground">
            {types.length}개 유형 · 법정 {statutoryCount}개 · 약정 {contractualCount}개
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4 mr-1" /> 추가
        </Button>
      </div>

      {/* 추가 폼 */}
      {showAdd && (
        <div className="rounded-lg border border-border p-4 space-y-3 bg-background">
          <p className="text-sm font-medium">새 휴직 유형 추가</p>
          <div className="grid grid-cols-4 gap-3">
            <Input placeholder="코드 (예: SABBATICAL)" value={addForm.code}
              onChange={e => setAddForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
            <Input placeholder="유형명" value={addForm.name}
              onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} />
            <Input placeholder="영문명" value={addForm.nameEn}
              onChange={e => setAddForm(p => ({ ...p, nameEn: e.target.value }))} />
            <Select value={addForm.category} onValueChange={v => setAddForm(p => ({ ...p, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="STATUTORY">법정</SelectItem>
                <SelectItem value="CONTRACTUAL">약정</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Input placeholder="최대 일수" type="number" value={addForm.maxDurationDays}
              onChange={e => setAddForm(p => ({ ...p, maxDurationDays: e.target.value }))} />
            <Select value={addForm.payType} onValueChange={v => setAddForm(p => ({ ...p, payType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PAID">유급</SelectItem>
                <SelectItem value="UNPAID">무급</SelectItem>
                <SelectItem value="PARTIAL">부분유급</SelectItem>
                <SelectItem value="INSURANCE">보험급여</SelectItem>
                <SelectItem value="MIXED">혼합</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="급여비율 (%)" type="number" value={addForm.payRate}
              onChange={e => setAddForm(p => ({ ...p, payRate: e.target.value }))} />
            <Input placeholder="최소 근속 (개월)" type="number" value={addForm.eligibilityMonths}
              onChange={e => setAddForm(p => ({ ...p, eligibilityMonths: e.target.value }))} />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={addForm.requiresProof} onCheckedChange={v => setAddForm(p => ({ ...p, requiresProof: v }))} />
              증빙 필수
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={addForm.reinstatementGuaranteed} onCheckedChange={v => setAddForm(p => ({ ...p, reinstatementGuaranteed: v }))} />
              원직 복귀 보장
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={addForm.splittable} onCheckedChange={v => setAddForm(p => ({ ...p, splittable: v }))} />
              분할 사용
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowAdd(false); setAddForm({ ...emptyForm, code: '' }) }}>취소</Button>
            <Button size="sm" onClick={handleAdd}>추가</Button>
          </div>
        </div>
      )}

      {/* 테이블 */}
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">로딩 중...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className={TABLE_STYLES.headerCell}>코드</th>
                <th className={TABLE_STYLES.headerCell}>유형명</th>
                <th className={TABLE_STYLES.headerCell}>구분</th>
                <th className={TABLE_STYLES.headerCell}>최대일수</th>
                <th className={TABLE_STYLES.headerCell}>급여</th>
                <th className={TABLE_STYLES.headerCell}>근속요건</th>
                <th className={TABLE_STYLES.headerCell}>증빙</th>
                <th className={TABLE_STYLES.headerCell}>복귀보장</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>작업</th>
              </tr>
            </thead>
            <tbody>
              {types.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-sm text-muted-foreground">등록된 휴직 유형이 없습니다.</td></tr>
              ) : types.map(t => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-background">
                  <td className={TABLE_STYLES.cell}>
                    <span className="font-mono text-xs text-muted-foreground">{t.code}</span>
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {editingId === t.id ? (
                      <div className="space-y-1">
                        <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="h-7 text-sm" />
                        <Input value={editForm.nameEn} placeholder="영문명" onChange={e => setEditForm(p => ({ ...p, nameEn: e.target.value }))} className="h-7 text-sm" />
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-foreground">{t.name}</p>
                        {t.nameEn && <p className="text-xs text-muted-foreground">{t.nameEn}</p>}
                      </div>
                    )}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', CATEGORY_COLORS[t.category] ?? 'bg-muted')}>
                      {t.category === 'STATUTORY' && <Shield className="h-3 w-3 mr-1" />}
                      {CATEGORY_LABELS[t.category] ?? t.category}
                    </span>
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {editingId === t.id ? (
                      <Input type="number" value={editForm.maxDurationDays} onChange={e => setEditForm(p => ({ ...p, maxDurationDays: e.target.value }))} className="h-7 w-20 text-sm" />
                    ) : (
                      t.maxDurationDays ? `${t.maxDurationDays}일` : '무제한'
                    )}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {editingId === t.id ? (
                      <Select value={editForm.payType} onValueChange={v => setEditForm(p => ({ ...p, payType: v }))}>
                        <SelectTrigger className="h-7 w-24 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PAID">유급</SelectItem>
                          <SelectItem value="UNPAID">무급</SelectItem>
                          <SelectItem value="PARTIAL">부분유급</SelectItem>
                          <SelectItem value="INSURANCE">보험급여</SelectItem>
                          <SelectItem value="MIXED">혼합</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span>
                        {PAY_TYPE_LABELS[t.payType] ?? t.payType}
                        {t.payRate != null && <span className="text-xs text-muted-foreground"> ({t.payRate}%)</span>}
                      </span>
                    )}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {t.eligibilityMonths ? `${t.eligibilityMonths}개월` : '—'}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {t.requiresProof ? (
                      <FileText className="h-4 w-4 text-blue-500" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {t.reinstatementGuaranteed ? (
                      <Shield className="h-4 w-4 text-green-500" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={cn(TABLE_STYLES.cell, 'text-right')}>
                    {editingId === t.id ? (
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" className="h-7" onClick={() => setEditingId(null)}>취소</Button>
                        <Button size="sm" className="h-7" onClick={() => handleUpdate(t.id)}>저장</Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-destructive" onClick={() => handleDelete(t.id)}>
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
