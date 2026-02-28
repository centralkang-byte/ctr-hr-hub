'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Salary Adjustment Matrix Settings Client
// 연봉 인상 매트릭스 (3x3 Grid — Performance x Compa-Ratio)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Copy, Save } from 'lucide-react'

import type { SessionUser } from '@/types'
import { apiClient } from '@/lib/api'
import { ko } from '@/lib/i18n/ko'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

// ─── Types ───────────────────────────────────────────────

interface PerformanceCycle {
  id: string
  name: string
  year: number
  half: string
  status: string
}

interface MatrixEntry {
  emsBlock: string
  minIncreasePct: number
  recommendedIncreasePct: number
  maxIncreasePct: number
}

// ─── EMS Block Mapping ──────────────────────────────────

// Performance axis (rows): High=3, Mid=2, Low=1
// Compa axis (columns): Below(C)=<0.9, At(B)=0.9~1.1, Above(A)=>1.1
const ROWS = [
  {
    key: 'high',
    label: '성과 High',
    sublabel: '(블록 7,8,9)',
    perfLevel: '3',
  },
  {
    key: 'mid',
    label: '성과 Mid',
    sublabel: '(블록 4,5,6)',
    perfLevel: '2',
  },
  {
    key: 'low',
    label: '성과 Low',
    sublabel: '(블록 1,2,3)',
    perfLevel: '1',
  },
] as const

const COLS = [
  {
    key: 'below',
    label: 'Compa < 0.9',
    compaLevel: 'C',
  },
  {
    key: 'at',
    label: '0.9 ~ 1.1',
    compaLevel: 'B',
  },
  {
    key: 'above',
    label: 'Compa > 1.1',
    compaLevel: 'A',
  },
] as const

function getEmsBlock(
  perfLevel: string,
  compaLevel: string,
): string {
  return `${perfLevel}${compaLevel}`
}

// Build default empty entries for all 9 cells
function buildDefaultEntries(): Record<string, MatrixEntry> {
  const entries: Record<string, MatrixEntry> = {}
  for (const row of ROWS) {
    for (const col of COLS) {
      const block = getEmsBlock(row.perfLevel, col.compaLevel)
      entries[block] = {
        emsBlock: block,
        minIncreasePct: 0,
        recommendedIncreasePct: 0,
        maxIncreasePct: 0,
      }
    }
  }
  return entries
}

// ─── Component ───────────────────────────────────────────

export function SalaryMatrixClient({ user }: { user: SessionUser }) {
  // ─── State ───
  const [cycles, setCycles] = useState<PerformanceCycle[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string>('')
  const [entries, setEntries] = useState<Record<string, MatrixEntry>>(
    buildDefaultEntries(),
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [sourceCycleId, setSourceCycleId] = useState<string>('')
  const [copying, setCopying] = useState(false)

  const { toast } = useToast()

  // ─── Fetch cycles ───
  useEffect(() => {
    const fetchCycles = async () => {
      try {
        const res = await apiClient.getList<PerformanceCycle>(
          '/api/v1/performance/cycles',
          { limit: 50 },
        )
        setCycles(res.data)
        if (res.data.length > 0) {
          setSelectedCycleId(res.data[0].id)
        }
      } catch {
        toast({
          title: '오류',
          description: '평가 주기 목록을 불러오는 데 실패했습니다.',
          variant: 'destructive',
        })
      }
    }
    void fetchCycles()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Fetch matrix entries for selected cycle ───
  const fetchMatrix = useCallback(async () => {
    if (!selectedCycleId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await apiClient.get<MatrixEntry[]>(
        '/api/v1/compensation/matrix',
        { cycleId: selectedCycleId },
      )
      const defaultEntries = buildDefaultEntries()
      // Merge API data into defaults
      if (Array.isArray(res.data)) {
        for (const entry of res.data) {
          defaultEntries[entry.emsBlock] = {
            emsBlock: entry.emsBlock,
            minIncreasePct: Number(entry.minIncreasePct) || 0,
            recommendedIncreasePct: Number(entry.recommendedIncreasePct) || 0,
            maxIncreasePct: Number(entry.maxIncreasePct) || 0,
          }
        }
      }
      setEntries(defaultEntries)
    } catch {
      setEntries(buildDefaultEntries())
    } finally {
      setLoading(false)
    }
  }, [selectedCycleId])

  useEffect(() => {
    void fetchMatrix()
  }, [fetchMatrix])

  // ─── Update a cell value ───
  const updateEntry = (
    emsBlock: string,
    field: 'minIncreasePct' | 'recommendedIncreasePct' | 'maxIncreasePct',
    value: string,
  ) => {
    const numValue = value === '' ? 0 : parseFloat(value)
    if (isNaN(numValue)) return
    setEntries((prev) => ({
      ...prev,
      [emsBlock]: {
        ...prev[emsBlock],
        [field]: numValue,
      },
    }))
  }

  // ─── Save matrix ───
  const handleSave = async () => {
    if (!selectedCycleId) {
      toast({
        title: '오류',
        description: '평가 주기를 선택하세요.',
        variant: 'destructive',
      })
      return
    }

    // Validate: min <= recommended <= max for all cells
    for (const entry of Object.values(entries)) {
      if (
        entry.minIncreasePct > entry.recommendedIncreasePct ||
        entry.recommendedIncreasePct > entry.maxIncreasePct
      ) {
        toast({
          title: '유효성 오류',
          description: `블록 ${entry.emsBlock}: 최소 <= 권장 <= 최대 순서여야 합니다.`,
          variant: 'destructive',
        })
        return
      }
    }

    setSaving(true)
    try {
      await apiClient.post('/api/v1/compensation/matrix', {
        cycleId: selectedCycleId,
        entries: Object.values(entries),
      })
      toast({ title: '성공', description: '연봉 인상 매트릭스가 저장되었습니다.' })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.'
      toast({ title: '오류', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ─── Copy from previous cycle ───
  const handleCopy = async () => {
    if (!sourceCycleId || !selectedCycleId) return
    if (sourceCycleId === selectedCycleId) {
      toast({
        title: '오류',
        description: '같은 주기는 복사할 수 없습니다.',
        variant: 'destructive',
      })
      return
    }
    setCopying(true)
    try {
      await apiClient.post('/api/v1/compensation/matrix/copy', {
        sourceCycleId,
        targetCycleId: selectedCycleId,
      })
      toast({
        title: '성공',
        description: '이전 주기의 매트릭스를 복사했습니다.',
      })
      setCopyDialogOpen(false)
      fetchMatrix()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '복사 중 오류가 발생했습니다.'
      toast({ title: '오류', description: message, variant: 'destructive' })
    } finally {
      setCopying(false)
    }
  }

  // ─── Get cycle display name ───
  const getCycleName = (cycle: PerformanceCycle) => {
    return cycle.name || `${cycle.year} ${cycle.half}`
  }

  // ─── Render ───
  return (
    <div className="space-y-6">
      <PageHeader
        title="연봉 인상 매트릭스"
        description="성과 등급과 Compa-Ratio 기준으로 연봉 인상률 범위를 설정합니다."
        actions={
          <div className="flex items-center gap-2">
            {/* Cycle selector */}
            <Select
              value={selectedCycleId}
              onValueChange={setSelectedCycleId}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="평가 주기 선택" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {getCycleName(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                setSourceCycleId('')
                setCopyDialogOpen(true)
              }}
              disabled={!selectedCycleId}
            >
              <Copy className="mr-1 h-4 w-4" />
              이전 연도 복사
            </Button>
          </div>
        }
      />

      {/* ─── Loading state ─── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !selectedCycleId ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">
            평가 주기가 없습니다. 먼저 성과 관리에서 평가 주기를 생성하세요.
          </p>
        </div>
      ) : (
        <>
          {/* ─── 3x3 Matrix Grid ─── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="w-[160px] p-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      성과 / Compa-Ratio
                    </th>
                    {COLS.map((col) => (
                      <th
                        key={col.key}
                        className="p-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, rowIdx) => (
                    <tr
                      key={row.key}
                      className={
                        rowIdx < ROWS.length - 1
                          ? 'border-b border-slate-100'
                          : ''
                      }
                    >
                      <td className="p-3">
                        <div>
                          <span className="text-sm font-semibold text-slate-800">
                            {row.label}
                          </span>
                          <br />
                          <span className="text-xs text-slate-400">
                            {row.sublabel}
                          </span>
                        </div>
                      </td>
                      {COLS.map((col) => {
                        const block = getEmsBlock(
                          row.perfLevel,
                          col.compaLevel,
                        )
                        const entry = entries[block]
                        return (
                          <td key={col.key} className="p-3">
                            <div className="space-y-2 min-w-[160px]">
                              {/* Min */}
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-slate-500 w-10 shrink-0">
                                  최소
                                </Label>
                                <div className="relative flex-1">
                                  <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    value={entry.minIncreasePct || ''}
                                    onChange={(e) =>
                                      updateEntry(
                                        block,
                                        'minIncreasePct',
                                        e.target.value,
                                      )
                                    }
                                    className="h-8 text-sm pr-6"
                                    placeholder="0"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                    %
                                  </span>
                                </div>
                              </div>
                              {/* Recommended */}
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-blue-600 font-semibold w-10 shrink-0">
                                  권장
                                </Label>
                                <div className="relative flex-1">
                                  <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    value={
                                      entry.recommendedIncreasePct || ''
                                    }
                                    onChange={(e) =>
                                      updateEntry(
                                        block,
                                        'recommendedIncreasePct',
                                        e.target.value,
                                      )
                                    }
                                    className="h-8 text-sm pr-6 border-blue-300 focus:ring-blue-500"
                                    placeholder="0"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                    %
                                  </span>
                                </div>
                              </div>
                              {/* Max */}
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-slate-500 w-10 shrink-0">
                                  최대
                                </Label>
                                <div className="relative flex-1">
                                  <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    value={entry.maxIncreasePct || ''}
                                    onChange={(e) =>
                                      updateEntry(
                                        block,
                                        'maxIncreasePct',
                                        e.target.value,
                                      )
                                    }
                                    className="h-8 text-sm pr-6"
                                    placeholder="0"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                    %
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ─── EMS Block Reference ─── */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 mb-2">
                EMS 블록 매핑 참조
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
                {ROWS.map((row) => (
                  <div key={row.key} className="flex gap-2">
                    {COLS.map((col) => {
                      const block = getEmsBlock(row.perfLevel, col.compaLevel)
                      return (
                        <span
                          key={block}
                          className="inline-flex items-center px-2 py-0.5 rounded bg-slate-50 border border-slate-200 font-mono"
                        >
                          {block}
                        </span>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Save Button ─── */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving || !selectedCycleId}
              className="min-w-[120px]"
            >
              {saving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              {ko.common.save}
            </Button>
          </div>
        </>
      )}

      {/* ─── Copy Dialog ─── */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>이전 연도 매트릭스 복사</DialogTitle>
            <DialogDescription>
              이전 평가 주기의 인상 매트릭스를 현재 주기로 복사합니다.
              기존 데이터가 있을 경우 덮어쓰기됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>복사 원본 주기</Label>
              <Select
                value={sourceCycleId}
                onValueChange={setSourceCycleId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="원본 주기 선택" />
                </SelectTrigger>
                <SelectContent>
                  {cycles
                    .filter((c) => c.id !== selectedCycleId)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {getCycleName(c)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>대상 주기</Label>
              <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm text-slate-700 border border-slate-200">
                {cycles.find((c) => c.id === selectedCycleId)
                  ? getCycleName(
                      cycles.find((c) => c.id === selectedCycleId)!,
                    )
                  : '-'}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCopyDialogOpen(false)}
            >
              {ko.common.cancel}
            </Button>
            <Button
              onClick={handleCopy}
              disabled={copying || !sourceCycleId}
            >
              {copying && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              복사 실행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
