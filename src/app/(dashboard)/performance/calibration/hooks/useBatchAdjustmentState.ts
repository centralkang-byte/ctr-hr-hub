'use client'

import { useCallback, useMemo, useState } from 'react'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────────

export interface PendingChange {
  employeeId: string
  employeeName: string
  fromBlock: number   // blockNumber 1-9
  toBlock: number     // blockNumber 1-9
  fromBlockCode: string  // e.g. "3C"
  toBlockCode: string
  reason?: string
}

interface EvalItem {
  id: string
  employeeId: string
  emsBlock: string | null
  employee: { id: string; name: string }
}

interface BatchResult {
  batchId: string
  totalProcessed: number
  succeeded: number
  failed: number
  results: { employeeId: string; status: 'success' | 'failed'; error?: string }[]
}

// ─── Block Helpers ──────────────────────────────────────────

const BLOCK_CODE_MAP: Record<number, string> = {
  1: '1A', 2: '2A', 3: '3A',
  4: '1B', 5: '2B', 6: '3B',
  7: '1C', 8: '2C', 9: '3C',
}

const CODE_TO_NUM: Record<string, number> = {
  '1A': 1, '2A': 2, '3A': 3,
  '1B': 4, '2B': 5, '3B': 6,
  '1C': 7, '2C': 8, '3C': 9,
}

export function blockCodeToNum(code: string): number {
  return CODE_TO_NUM[code] ?? 5
}

export function blockNumToCode(num: number): string {
  return BLOCK_CODE_MAP[num] ?? '2B'
}

// ─── Hook ───────────────────────────────────────────────────

export function useBatchAdjustmentState(
  evaluations: EvalItem[],
  sessionId: string | null,
  onSaveComplete: () => void,
) {
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  // ─── Selection ────────────────────────────────────────

  const toggleSelect = useCallback((employeeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(employeeId)) next.delete(employeeId)
      else next.add(employeeId)
      return next
    })
  }, [])

  const selectAllInBlock = useCallback((blockNum: number) => {
    const blockCode = blockNumToCode(blockNum)
    const idsInBlock = evaluations
      .filter((ev) => {
        const pending = pendingChanges.get(ev.employeeId)
        const currentCode = pending ? pending.toBlockCode : (ev.emsBlock ?? '2B')
        return currentCode === blockCode
      })
      .map((ev) => ev.employeeId)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of idsInBlock) next.add(id)
      return next
    })
  }, [evaluations, pendingChanges])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // ─── Pending Changes ─────────────────────────────────

  const moveSelected = useCallback((targetBlockNum: number) => {
    const targetCode = blockNumToCode(targetBlockNum)
    setPendingChanges((prev) => {
      const next = new Map(prev)
      for (const empId of selectedIds) {
        const ev = evaluations.find((e) => e.employeeId === empId)
        if (!ev) continue
        const existing = next.get(empId)
        const originalCode = existing ? existing.fromBlockCode : (ev.emsBlock ?? '2B')
        const originalNum = blockCodeToNum(originalCode)

        // 원래 블록으로 돌아가면 변경 제거
        if (originalNum === targetBlockNum && !existing) continue
        if (existing && existing.fromBlock === targetBlockNum) {
          next.delete(empId)
          continue
        }

        next.set(empId, {
          employeeId: empId,
          employeeName: ev.employee.name,
          fromBlock: existing ? existing.fromBlock : blockCodeToNum(ev.emsBlock ?? '2B'),
          toBlock: targetBlockNum,
          fromBlockCode: existing ? existing.fromBlockCode : (ev.emsBlock ?? '2B'),
          toBlockCode: targetCode,
        })
      }
      return next
    })
    setSelectedIds(new Set())
  }, [selectedIds, evaluations])

  const moveSingle = useCallback((employeeId: string, fromBlockNum: number, toBlockNum: number) => {
    if (fromBlockNum === toBlockNum) return
    const ev = evaluations.find((e) => e.employeeId === employeeId)
    if (!ev) return

    setPendingChanges((prev) => {
      const next = new Map(prev)
      const existing = next.get(employeeId)
      const originalNum = existing ? existing.fromBlock : fromBlockNum

      // 원래 블록으로 복귀 시 변경 제거
      if (originalNum === toBlockNum) {
        next.delete(employeeId)
        return next
      }

      next.set(employeeId, {
        employeeId,
        employeeName: ev.employee.name,
        fromBlock: originalNum,
        toBlock: toBlockNum,
        fromBlockCode: blockNumToCode(originalNum),
        toBlockCode: blockNumToCode(toBlockNum),
      })
      return next
    })
  }, [evaluations])

  const undoChange = useCallback((employeeId: string) => {
    setPendingChanges((prev) => {
      const next = new Map(prev)
      next.delete(employeeId)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setPendingChanges(new Map())
    setSelectedIds(new Set())
  }, [])

  // ─── Derived State ───────────────────────────────────

  const mergedDistribution = useMemo(() => {
    const dist: Record<number, number> = {}
    for (let i = 1; i <= 9; i++) dist[i] = 0

    for (const ev of evaluations) {
      const pending = pendingChanges.get(ev.employeeId)
      const blockNum = pending
        ? pending.toBlock
        : blockCodeToNum(ev.emsBlock ?? '2B')
      dist[blockNum] = (dist[blockNum] ?? 0) + 1
    }
    return dist
  }, [evaluations, pendingChanges])

  const hasUnsavedChanges = pendingChanges.size > 0
  const pendingCount = pendingChanges.size

  // ─── Save ────────────────────────────────────────────

  const saveBatch = useCallback(async (sharedReason: string) => {
    if (!sessionId || pendingChanges.size === 0) return

    setIsSaving(true)
    try {
      const adjustments = Array.from(pendingChanges.values()).map((p) => ({
        employeeId: p.employeeId,
        fromBlock: p.fromBlockCode,
        toBlock: p.toBlockCode,
        reason: p.reason,
      }))

      const res = await apiClient.post<BatchResult>(
        `/api/v1/performance/calibration/${sessionId}/batch-adjust`,
        { adjustments, sharedReason },
      )

      const { succeeded, failed } = res.data
      if (failed > 0) {
        // 부분 실패: 성공 항목만 제거
        const failedIds = new Set(
          res.data.results
            .filter((r) => r.status === 'failed')
            .map((r) => r.employeeId),
        )
        setPendingChanges((prev) => {
          const next = new Map(prev)
          for (const [key] of next) {
            if (!failedIds.has(key)) next.delete(key)
          }
          return next
        })
        toast({
          title: `${succeeded}건 저장, ${failed}건 실패`,
          description: '실패 항목을 확인하세요.',
          variant: 'destructive',
        })
      } else {
        setPendingChanges(new Map())
        toast({ title: `${succeeded}건 배치 조정 완료` })
      }

      onSaveComplete()
    } catch (err) {
      toast({
        title: '배치 저장 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }, [sessionId, pendingChanges, onSaveComplete])

  return {
    // Selection
    selectedIds,
    toggleSelect,
    selectAllInBlock,
    clearSelection,
    // Pending changes
    pendingChanges,
    moveSelected,
    moveSingle,
    undoChange,
    clearAll,
    // Derived
    mergedDistribution,
    hasUnsavedChanges,
    pendingCount,
    // Save
    saveBatch,
    isSaving,
  }
}
