'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 시나리오 목록 Sheet
// 저장된 시나리오 목록 조회, 로드, 삭제, 비교 선택
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { Trash2, Upload, GitCompareArrows, Loader2, X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { ScenarioListItem, ScenarioDetail, SaveableMode } from './types'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoad: (scenario: ScenarioDetail) => void
  onCompare: (left: ScenarioDetail, right: ScenarioDetail) => void
}

// ─── Constants ──────────────────────────────────────────────

const MODE_LABELS: Record<SaveableMode, string> = {
  SINGLE: '개별',
  BULK: '일괄',
  DIFFERENTIAL: '차등 인상',
  HIRING: '채용',
  FX: '환율',
}

const MODE_COLORS: Record<SaveableMode, string> = {
  SINGLE: 'bg-blue-50 text-blue-600',
  BULK: 'bg-purple-50 text-purple-600',
  DIFFERENTIAL: 'bg-amber-50 text-amber-600',
  HIRING: 'bg-green-50 text-green-600',
  FX: 'bg-red-50 text-red-600',
}

// ─── Component ──────────────────────────────────────────────

export default function ScenarioListSheet({ open, onOpenChange, onLoad, onCompare }: Props) {
  const { toast } = useToast()
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [modeFilter, setModeFilter] = useState<SaveableMode | 'ALL'>('ALL')

  // 비교 선택
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)

  // 삭제
  const [deleteTarget, setDeleteTarget] = useState<ScenarioListItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchScenarios = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {}
      if (modeFilter !== 'ALL') params.mode = modeFilter
      const res = await apiClient.get<ScenarioListItem[]>('/api/v1/payroll/simulation/scenarios', params)
      setScenarios(res.data)
    } catch {
      toast({ title: '시나리오 로드 실패', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [modeFilter, toast])

  useEffect(() => {
    if (open) {
      fetchScenarios()
      setCompareIds([])
    }
  }, [open, fetchScenarios])

  // ─── 로드 ─────────────────────────────────────────────

  const handleLoad = async (id: string) => {
    try {
      const res = await apiClient.get<ScenarioDetail>(`/api/v1/payroll/simulation/scenarios/${id}`)
      onLoad(res.data)
      onOpenChange(false)
      toast({ title: '시나리오를 불러왔습니다' })
    } catch {
      toast({ title: '불러오기 실패', variant: 'destructive' })
    }
  }

  // ─── 삭제 ─────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await apiClient.delete(`/api/v1/payroll/simulation/scenarios/${deleteTarget.id}`)
      setScenarios(prev => prev.filter(s => s.id !== deleteTarget.id))
      setCompareIds(prev => prev.filter(id => id !== deleteTarget.id))
      toast({ title: '삭제되었습니다' })
    } catch {
      toast({ title: '삭제 실패', variant: 'destructive' })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  // ─── 비교 선택 토글 ──────────────────────────────────

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  // 비교 가능 여부: 2개 선택 + 같은 모드
  const canCompare = compareIds.length === 2 && (() => {
    const a = scenarios.find(s => s.id === compareIds[0])
    const b = scenarios.find(s => s.id === compareIds[1])
    return a && b && a.mode === b.mode
  })()

  const handleCompare = async () => {
    if (!canCompare) return
    try {
      setComparing(true)
      const res = await apiClient.get<ScenarioDetail[]>(
        '/api/v1/payroll/simulation/scenarios',
        { ids: compareIds.join(',') },
      )
      const [left, right] = res.data
      if (left && right) {
        onCompare(left, right)
        onOpenChange(false)
      }
    } catch {
      toast({ title: '비교 데이터 로드 실패', variant: 'destructive' })
    } finally {
      setComparing(false)
    }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[420px] sm:w-[480px] p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-[#F0F0F3]">
            <SheetTitle className="text-[#1C1D21]">저장된 시나리오</SheetTitle>
          </SheetHeader>

          {/* ─── 모드 필터 ───── */}
          <div className="px-6 py-3 border-b border-[#F0F0F3] flex gap-1.5 flex-wrap">
            {(['ALL', 'SINGLE', 'BULK', 'DIFFERENTIAL', 'HIRING', 'FX'] as const).map(m => (
              <button key={m} onClick={() => setModeFilter(m)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-full transition-colors',
                  modeFilter === m
                    ? 'bg-[#5E81F4] text-white'
                    : 'bg-[#F5F5FA] text-[#8181A5] hover:text-[#1C1D21]',
                )}>
                {m === 'ALL' ? '전체' : MODE_LABELS[m]}
              </button>
            ))}
          </div>

          {/* ─── 비교 바 ───── */}
          {compareIds.length > 0 && (
            <div className="px-6 py-2.5 bg-[#F5F5FA] border-b border-[#F0F0F3] flex items-center justify-between">
              <span className="text-xs text-[#8181A5]">
                비교: {compareIds.length}/2 선택
                {compareIds.length === 2 && !canCompare && (
                  <span className="text-red-500 ml-1">(같은 모드만 비교 가능)</span>
                )}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setCompareIds([])}
                  className="text-xs text-[#8181A5] hover:text-[#1C1D21]">초기화</button>
                <button onClick={handleCompare} disabled={!canCompare || comparing}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg',
                    'bg-[#5E81F4] text-white hover:bg-[#4A6DE0] disabled:opacity-50',
                  )}>
                  {comparing ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitCompareArrows className="w-3 h-3" />}
                  비교
                </button>
              </div>
            </div>
          )}

          {/* ─── 목록 ───── */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-[#8181A5]" />
              </div>
            ) : scenarios.length === 0 ? (
              <p className="text-center text-sm text-[#8181A5] py-12">저장된 시나리오가 없습니다</p>
            ) : (
              scenarios.map(s => {
                const isSelected = compareIds.includes(s.id)
                return (
                  <div key={s.id}
                    className={cn(
                      'border rounded-lg p-3 transition-colors',
                      isSelected ? 'border-[#5E81F4] bg-[#5E81F4]/5' : 'border-[#F0F0F3] hover:border-[#D0D0D8]',
                    )}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', MODE_COLORS[s.mode])}>
                            {MODE_LABELS[s.mode]}
                          </span>
                          <span className="text-xs text-[#8181A5]">{fmtDate(s.createdAt)}</span>
                        </div>
                        <p className="text-sm font-medium text-[#1C1D21] truncate">{s.title}</p>
                        {s.description && (
                          <p className="text-xs text-[#8181A5] mt-0.5 line-clamp-1">{s.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2.5">
                      <button onClick={() => toggleCompare(s.id)}
                        className={cn(
                          'px-2 py-1 text-xs rounded transition-colors',
                          isSelected
                            ? 'bg-[#5E81F4] text-white'
                            : 'bg-[#F5F5FA] text-[#8181A5] hover:text-[#1C1D21]',
                        )}>
                        {isSelected ? <X className="w-3 h-3 inline" /> : <GitCompareArrows className="w-3 h-3 inline" />}
                        {' '}비교
                      </button>
                      <button onClick={() => handleLoad(s.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-[#F5F5FA] text-[#8181A5] hover:text-[#1C1D21] rounded">
                        <Upload className="w-3 h-3" /> 불러오기
                      </button>
                      <button onClick={() => setDeleteTarget(s)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-[#F5F5FA] text-red-400 hover:text-red-600 rounded ml-auto">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── 삭제 확인 ───── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="시나리오 삭제"
        description={`"${deleteTarget?.title}" 시나리오를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel={deleting ? '삭제 중...' : '삭제'}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  )
}
