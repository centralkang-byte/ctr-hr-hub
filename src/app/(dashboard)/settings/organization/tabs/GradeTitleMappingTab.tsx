'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TABLE_STYLES } from '@/lib/styles'
import { toast } from '@/hooks/use-toast'
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

const GRADE_TYPE_LABELS: Record<string, string> = {
  STAFF: 'L (일반)',
  SPECIALIST: 'S (전문)',
  EXECUTIVE: 'E (경영)',
}

const GRADE_TYPE_COLORS: Record<string, string> = {
  STAFF: 'bg-blue-100 text-blue-700',
  SPECIALIST: 'bg-purple-100 text-purple-700',
  EXECUTIVE: 'bg-amber-100 text-amber-700',
}

const GRADE_TYPE_PREFIX: Record<string, string> = {
  STAFF: 'L',
  SPECIALIST: 'S',
  EXECUTIVE: 'E',
}

export function GradeTitleMappingTab({ companyId }: Props) {
  const [mappings, setMappings] = useState<GradeTitleMappingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ titleName: '', titleNameEn: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ gradeType: 'STAFF', titleName: '', titleNameEn: '' })

  const fetchMappings = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('gradeType', filter)
    if (companyId) params.set('companyId', companyId)
    const res = await fetch(`/api/v1/settings/grade-title-mappings?${params}`)
    const json = await res.json()
    if (json.data) setMappings(json.data)
    setLoading(false)
  }, [filter, companyId])

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
      toast({ title: '호칭명은 필수입니다', variant: 'destructive' })
      return
    }
    const gradeCode = getNextGradeCode(addForm.gradeType)
    const maxRank = mappings.length > 0 ? Math.max(...mappings.map(m => m.jobGrade.rankOrder)) + 1 : 1

    const res = await fetch('/api/v1/settings/grade-title-mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gradeCode,
        gradeType: addForm.gradeType,
        rankOrder: maxRank,
        titleName: addForm.titleName,
        titleNameEn: addForm.titleNameEn || undefined,
        ...(companyId ? { companyId } : {}),
      }),
    })
    if (res.ok) {
      toast({ title: '직급-호칭이 추가되었습니다' })
      setShowAdd(false)
      setAddForm({ gradeType: 'STAFF', titleName: '', titleNameEn: '' })
      fetchMappings()
    } else {
      const err = await res.json()
      toast({ title: '추가 실패', description: err.error?.message, variant: 'destructive' })
    }
  }

  const handleUpdate = async (id: string) => {
    const res = await fetch(`/api/v1/settings/grade-title-mappings?id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    if (res.ok) {
      toast({ title: '수정되었습니다' })
      setEditingId(null)
      fetchMappings()
    } else {
      const err = await res.json()
      toast({ title: '수정 실패', description: err.error?.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 직급-호칭 매핑을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/v1/settings/grade-title-mappings?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: '삭제되었습니다' })
      fetchMappings()
    } else {
      const err = await res.json()
      toast({ title: '삭제 실패', description: err.error?.message, variant: 'destructive' })
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
          <h3 className="text-base font-semibold text-[#1C1D21]">직급-호칭 매핑</h3>
          <p className="text-sm text-[#8181A5]">
            {mappings.length}개 매핑
            {Object.entries(groupCounts).map(([type, count]) => (
              ` · ${GRADE_TYPE_PREFIX[type] ?? type}: ${count}개`
            )).join('')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="STAFF">L (일반)</SelectItem>
              <SelectItem value="SPECIALIST">S (전문)</SelectItem>
              <SelectItem value="EXECUTIVE">E (경영)</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-4 w-4" /> 추가
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-[#5E81F4]/20 bg-[#5E81F4]/5 p-4 space-y-3">
          <p className="text-sm font-medium">새 직급-호칭 추가</p>
          <div className="grid grid-cols-4 gap-2">
            <Select value={addForm.gradeType} onValueChange={v => setAddForm(p => ({ ...p, gradeType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="STAFF">L (일반)</SelectItem>
                <SelectItem value="SPECIALIST">S (전문)</SelectItem>
                <SelectItem value="EXECUTIVE">E (경영)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center text-sm text-[#8181A5]">
              코드: <span className="ml-1 font-mono font-medium text-[#5E81F4]">{getNextGradeCode(addForm.gradeType)}</span> (자동)
            </div>
            <Input placeholder="호칭명 (예: 매니저)" value={addForm.titleName} onChange={e => setAddForm(p => ({ ...p, titleName: e.target.value }))} />
            <Input placeholder="호칭 영문명" value={addForm.titleNameEn} onChange={e => setAddForm(p => ({ ...p, titleNameEn: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd}>저장</Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>취소</Button>
          </div>
        </div>
      )}

      <div className={TABLE_STYLES.wrapper}>
        <table className={TABLE_STYLES.table}>
          <thead className={TABLE_STYLES.header}>
            <tr>
              <th className={TABLE_STYLES.headerCell}>구분</th>
              <th className={TABLE_STYLES.headerCell}>직급 코드</th>
              <th className={TABLE_STYLES.headerCell}>호칭</th>
              <th className={TABLE_STYLES.headerCell}>호칭 영문</th>
              <th className={TABLE_STYLES.headerCell} style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-[#8181A5]">로딩 중...</td></tr>
            ) : mappings.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-[#8181A5]">등록된 매핑이 없습니다. 직급-호칭을 추가하세요.</td></tr>
            ) : mappings.map((m) => (
              <tr key={m.id} className={TABLE_STYLES.row}>
                <td className={TABLE_STYLES.cell}>
                  <span className={cn('inline-block rounded px-2 py-0.5 text-xs font-medium', GRADE_TYPE_COLORS[m.jobGrade.gradeType] ?? 'bg-gray-100 text-gray-600')}>
                    {GRADE_TYPE_LABELS[m.jobGrade.gradeType] ?? m.jobGrade.gradeType}
                  </span>
                </td>
                <td className={`${TABLE_STYLES.cell} font-mono font-medium text-[#5E81F4]`}>{m.jobGrade.code}</td>
                <td className={TABLE_STYLES.cell}>
                  {editingId === m.id ? (
                    <Input className="h-7 text-sm" value={editForm.titleName} onChange={e => setEditForm(p => ({ ...p, titleName: e.target.value }))} />
                  ) : m.employeeTitle.name}
                </td>
                <td className={`${TABLE_STYLES.cell} text-[#8181A5]`}>
                  {editingId === m.id ? (
                    <Input className="h-7 text-sm" value={editForm.titleNameEn} onChange={e => setEditForm(p => ({ ...p, titleNameEn: e.target.value }))} />
                  ) : m.employeeTitle.nameEn ?? '—'}
                </td>
                <td className={TABLE_STYLES.cell}>
                  {editingId === m.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleUpdate(m.id)}>저장</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingId(null)}>취소</Button>
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
