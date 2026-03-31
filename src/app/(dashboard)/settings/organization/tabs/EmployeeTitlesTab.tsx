'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TABLE_STYLES } from '@/lib/styles'
import { toast } from '@/hooks/use-toast'
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
  const [titles, setTitles] = useState<EmployeeTitle[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<EmployeeTitle>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ code: '', name: '', nameEn: '', isExecutive: false })

  const fetchTitles = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/v1/settings/employee-titles')
    const json = await res.json()
    if (json.data) setTitles(json.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchTitles() }, [fetchTitles])

  const handleAdd = async () => {
    if (!addForm.code || !addForm.name) {
      toast({ title: '코드와 이름은 필수입니다', variant: 'destructive' })
      return
    }
    const maxRank = titles.length > 0 ? Math.max(...titles.map(t => t.rankOrder)) + 1 : 1
    const res = await fetch('/api/v1/settings/employee-titles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...addForm, rankOrder: maxRank }),
    })
    if (res.ok) {
      toast({ title: '호칭이 추가되었습니다' })
      setShowAdd(false)
      setAddForm({ code: '', name: '', nameEn: '', isExecutive: false })
      fetchTitles()
    } else {
      const err = await res.json()
      toast({ title: '추가 실패', description: err.error?.message, variant: 'destructive' })
    }
  }

  const handleUpdate = async (id: string) => {
    const res = await fetch(`/api/v1/settings/employee-titles?id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    if (res.ok) {
      toast({ title: '수정되었습니다' })
      setEditingId(null)
      fetchTitles()
    } else {
      const err = await res.json()
      toast({ title: '수정 실패', description: err.error?.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 호칭을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/v1/settings/employee-titles?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: '삭제되었습니다' })
      fetchTitles()
    } else {
      const err = await res.json()
      toast({ title: '삭제 실패', description: err.error?.message, variant: 'destructive' })
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
          <h3 className="text-base font-semibold text-foreground">호칭 관리</h3>
          <p className="text-sm text-muted-foreground">{titles.length}개 호칭 등록 · 직급과 독립적으로 관리</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="mr-1 h-4 w-4" /> 추가
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <p className="text-sm font-medium">새 호칭 추가</p>
          <div className="grid grid-cols-4 gap-2">
            <Input placeholder="코드 (예: CEO)" value={addForm.code} onChange={e => setAddForm(p => ({ ...p, code: e.target.value }))} />
            <Input placeholder="이름 (예: 대표이사)" value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} />
            <Input placeholder="영문명 (예: CEO)" value={addForm.nameEn} onChange={e => setAddForm(p => ({ ...p, nameEn: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={addForm.isExecutive} onChange={e => setAddForm(p => ({ ...p, isExecutive: e.target.checked }))} />
              임원급
            </label>
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
              <th className={TABLE_STYLES.headerCell}>코드</th>
              <th className={TABLE_STYLES.headerCell}>호칭</th>
              <th className={TABLE_STYLES.headerCell}>영문명</th>
              <th className={TABLE_STYLES.headerCell}>구분</th>
              <th className={TABLE_STYLES.headerCell} style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">로딩 중...</td></tr>
            ) : titles.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">등록된 호칭이 없습니다</td></tr>
            ) : titles.map((t) => (
              <tr key={t.id} className={TABLE_STYLES.row}>
                <td className={`${TABLE_STYLES.cell} font-medium text-primary`}>{t.code}</td>
                <td className={TABLE_STYLES.cell}>
                  {editingId === t.id ? (
                    <Input className="h-7 text-sm" value={editForm.name ?? ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
                  ) : t.name}
                </td>
                <td className={`${TABLE_STYLES.cell} text-muted-foreground`}>
                  {editingId === t.id ? (
                    <Input className="h-7 text-sm" value={editForm.nameEn ?? ''} onChange={e => setEditForm(p => ({ ...p, nameEn: e.target.value }))} />
                  ) : t.nameEn ?? '—'}
                </td>
                <td className={TABLE_STYLES.cell}>
                  <span className={cn('inline-block rounded px-2 py-0.5 text-xs font-medium', t.isExecutive ? 'bg-amber-500/15 text-amber-700' : 'bg-muted text-muted-foreground')}>
                    {t.isExecutive ? '임원급' : '일반'}
                  </span>
                </td>
                <td className={TABLE_STYLES.cell}>
                  {editingId === t.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleUpdate(t.id)}>저장</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingId(null)}>취소</Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDelete(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
