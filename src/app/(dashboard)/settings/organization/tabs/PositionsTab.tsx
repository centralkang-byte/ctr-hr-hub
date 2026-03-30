'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TABLE_STYLES } from '@/lib/styles'
import { toast } from '@/hooks/use-toast'

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
    const params = new URLSearchParams()
    if (companyId) params.set('companyId', companyId)
    const res = await fetch(`/api/v1/positions?${params}`)
    const json = await res.json()
    if (json.data) setPositions(json.data)
    setLoading(false)
  }, [companyId])

  const fetchGrades = useCallback(async () => {
    const res = await fetch('/api/v1/settings/job-grades')
    const json = await res.json()
    if (json.data) setGrades(json.data)
  }, [])

  useEffect(() => { fetchPositions() }, [fetchPositions])
  useEffect(() => { fetchGrades() }, [fetchGrades])

  const handleAdd = async () => {
    if (!addForm.code.trim() || !addForm.name.trim()) {
      toast({ title: '코드와 직위명은 필수입니다', variant: 'destructive' })
      return
    }
    const res = await fetch('/api/v1/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...addForm,
        companyId,
        reportsToPositionId: addForm.reportsToPositionId === NONE ? null : addForm.reportsToPositionId,
        jobGradeId: addForm.jobGradeId === NONE ? null : addForm.jobGradeId,
      }),
    })
    if (res.ok) {
      toast({ title: '직위가 추가되었습니다' })
      setShowAdd(false)
      setAddForm({ code: '', name: '', nameEn: '', reportsToPositionId: NONE, jobGradeId: NONE })
      fetchPositions()
    } else {
      const err = await res.json()
      toast({ title: '추가 실패', description: err.error?.message, variant: 'destructive' })
    }
  }

  const handleUpdate = async (id: string) => {
    const res = await fetch(`/api/v1/positions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titleKo: editForm.name,
        titleEn: editForm.nameEn || null,
        code: editForm.code,
        reportsToPositionId: editForm.reportsToPositionId === NONE ? null : editForm.reportsToPositionId,
        jobGradeId: editForm.jobGradeId === NONE ? null : editForm.jobGradeId,
      }),
    })
    if (res.ok) {
      toast({ title: '수정되었습니다' })
      setEditingId(null)
      fetchPositions()
    } else {
      const err = await res.json()
      toast({ title: '수정 실패', description: err.error?.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 직위를 삭제하시겠습니까?')) return
    const res = await fetch(`/api/v1/positions/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: '삭제되었습니다' })
      fetchPositions()
    } else {
      const err = await res.json()
      toast({ title: '삭제 실패', description: err.error?.message, variant: 'destructive' })
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
          <h3 className="text-base font-semibold text-foreground">직위 관리</h3>
          <p className="text-sm text-muted-foreground">{positions.length}개 직위 등록 · 법인별 보직(직책) 목록</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="mr-1 h-4 w-4" /> 직위 추가
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <p className="text-sm font-medium">새 직위 추가</p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="코드 (예: POS-TL)"
              value={addForm.code}
              onChange={e => setAddForm(p => ({ ...p, code: e.target.value }))}
            />
            <Input
              placeholder="직위명 (예: 팀장)"
              value={addForm.name}
              onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
            />
            <Input
              placeholder="영문명 (예: Team Lead)"
              value={addForm.nameEn}
              onChange={e => setAddForm(p => ({ ...p, nameEn: e.target.value }))}
            />
            <Select
              value={addForm.reportsToPositionId}
              onValueChange={v => setAddForm(p => ({ ...p, reportsToPositionId: v }))}
            >
              <SelectTrigger><SelectValue placeholder="상위 직위 (선택)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>없음</SelectItem>
                {positions.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={addForm.jobGradeId}
              onValueChange={v => setAddForm(p => ({ ...p, jobGradeId: v }))}
            >
              <SelectTrigger><SelectValue placeholder="연결 직급 (선택)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>없음</SelectItem>
                {grades.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name} ({g.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <th className={TABLE_STYLES.headerCell}>직위명</th>
              <th className={TABLE_STYLES.headerCell}>상위 직위</th>
              <th className={TABLE_STYLES.headerCell}>연결 직급</th>
              <th className={TABLE_STYLES.headerCell} style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">로딩 중...</td></tr>
            ) : positions.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">등록된 직위가 없습니다</td></tr>
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
                      <Input className="h-7 text-sm text-muted-foreground" placeholder="영문명" value={editForm.nameEn} onChange={e => setEditForm(f => ({ ...f, nameEn: e.target.value }))} />
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
                        <SelectItem value={NONE}>없음</SelectItem>
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
                        <SelectItem value={NONE}>없음</SelectItem>
                        {grades.map(g => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    p.jobGradeName
                      ? <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">{p.jobGradeName}</span>
                      : <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className={TABLE_STYLES.cell}>
                  {editingId === p.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleUpdate(p.id)}>저장</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingId(null)}>취소</Button>
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
