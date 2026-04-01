'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Calibration 9-Block Grid
// @dnd-kit 기반 드래그&드롭 + 다중 선택 지원 9-블록 매트릭스
// ═══════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Grid3X3, GripVertical, Check } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { blockCodeToNum, blockNumToCode } from '../hooks/useBatchAdjustmentState'
import type { PendingChange } from '../hooks/useBatchAdjustmentState'

// ─── Types ──────────────────────────────────────────────────

interface EvalItem {
  id: string
  employeeId: string
  performanceScore: number | null
  competencyScore: number | null
  emsBlock: string | null
  employee: {
    id: string; name: string; employeeCode: string
    department: { name: string } | null
    jobGrade: { name: string } | null
  }
}

interface Props {
  evaluations: EvalItem[]
  batchMode: boolean
  pendingChanges: Map<string, PendingChange>
  selectedIds: Set<string>
  readinessMap: Record<string, string>
  onToggleSelect: (employeeId: string) => void
  onEmployeeChipClick: (ev: EvalItem) => void
  onAdjEmployeeClick: (ev: EvalItem) => void
  onDragMove: (employeeId: string, fromBlock: number, toBlock: number) => void
  onSelectAllInBlock: (blockNum: number) => void
}

// ─── Constants ──────────────────────────────────────────────

const BLOCK_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: '1A', color: 'bg-destructive/10 text-destructive' },
  2: { label: '2A', color: 'bg-amber-500/15 text-amber-700' },
  3: { label: '3A', color: 'bg-emerald-500/15 text-emerald-700' },
  4: { label: '1B', color: 'bg-amber-500/15 text-amber-700' },
  5: { label: '2B', color: 'bg-primary/10 text-primary/90' },
  6: { label: '3B', color: 'bg-emerald-500/15 text-emerald-700' },
  7: { label: '1C', color: 'bg-indigo-500/15 text-primary/90' },
  8: { label: '2C', color: 'bg-emerald-500/15 text-emerald-700' },
  9: { label: '3C', color: 'bg-primary/10 text-primary/90' },
}

// rows = competency (high to low), cols = performance (low to high)
const GRID_LAYOUT = [
  [7, 8, 9],
  [4, 5, 6],
  [1, 2, 3],
]

// ─── Droppable Block ────────────────────────────────────────

function DroppableBlock({
  blockNum,
  children,
  count,
  batchMode,
  onSelectAll,
}: {
  blockNum: number
  children: React.ReactNode
  count: number
  batchMode: boolean
  onSelectAll: () => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `block-${blockNum}` })
  const blockInfo = BLOCK_LABELS[blockNum]

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-2xl p-2 min-h-[80px] transition-colors',
        count > 0 ? 'bg-card' : 'bg-background',
        isOver && batchMode && 'ring-2 ring-primary bg-primary/5',
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full', blockInfo?.color ?? '')}>
          {blockInfo?.label ?? blockNum}
        </span>
        <div className="flex items-center gap-1">
          {batchMode && count > 0 && (
            <button
              onClick={onSelectAll}
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
              title="전체 선택"
            >
              all
            </button>
          )}
          <span className="text-xs text-muted-foreground">{count}명</span>
        </div>
      </div>
      <div className="space-y-0.5">
        {children}
      </div>
    </div>
  )
}

// ─── Draggable Employee Chip ────────────────────────────────

function EmployeeChip({
  ev,
  batchMode,
  isSelected,
  isPending,
  readiness,
  onToggleSelect,
  onChipClick,
  onAdjClick,
}: {
  ev: EvalItem
  batchMode: boolean
  isSelected: boolean
  isPending: boolean
  readiness?: string
  onToggleSelect: () => void
  onChipClick: () => void
  onAdjClick: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ev.employeeId,
    disabled: !batchMode,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center gap-1 text-xs rounded-lg px-1.5 py-0.5 transition-colors',
        'bg-card',
        isDragging && 'opacity-30',
        isPending && 'ring-2 ring-primary',
        isSelected && 'bg-primary/15',
        batchMode ? 'cursor-pointer' : 'cursor-pointer hover:bg-primary/10',
      )}
      onClick={batchMode ? onToggleSelect : onChipClick}
    >
      {batchMode && (
        <>
          <div
            className={cn(
              'w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center',
              isSelected ? 'bg-primary border-primary' : 'border-border',
            )}
          >
            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
          </div>
          <span {...attributes} {...listeners} className="flex-shrink-0 cursor-grab active:cursor-grabbing">
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </span>
        </>
      )}
      <span
        className="truncate max-w-[60px]"
        title={ev.employee.name}
        onClick={(e) => {
          if (!batchMode) {
            e.stopPropagation()
            onAdjClick()
          }
        }}
      >
        {ev.employee.name}
      </span>
      {readiness === 'READY_NOW' && <span className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-500" />}
      {readiness === 'READY_1_2_YEARS' && <span className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-500" />}
      {readiness === 'READY_3_PLUS_YEARS' && <span className="flex-shrink-0 w-2 h-2 rounded-full bg-destructive" />}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────

export default function CalibrationBlockGrid({
  evaluations,
  batchMode,
  pendingChanges,
  selectedIds,
  readinessMap,
  onToggleSelect,
  onEmployeeChipClick,
  onAdjEmployeeClick,
  onDragMove,
  onSelectAllInBlock,
}: Props) {
  const t = useTranslations('performance')
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // 직원을 현재 블록으로 분류 (pending 반영)
  const getBlockGrid = useCallback(() => {
    const grid: Record<number, EvalItem[]> = {}
    for (let i = 1; i <= 9; i++) grid[i] = []

    for (const ev of evaluations) {
      const pending = pendingChanges.get(ev.employeeId)
      const blockNum = pending
        ? pending.toBlock
        : blockCodeToNum(ev.emsBlock ?? '2B')
      if (grid[blockNum]) grid[blockNum].push(ev)
    }
    return grid
  }, [evaluations, pendingChanges])

  const grid = getBlockGrid()

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const employeeId = String(active.id)
    const targetBlockStr = String(over.id).replace('block-', '')
    const targetBlock = parseInt(targetBlockStr, 10)
    if (isNaN(targetBlock)) return

    // 현재 블록 찾기
    const pending = pendingChanges.get(employeeId)
    const ev = evaluations.find((e) => e.employeeId === employeeId)
    if (!ev) return
    const fromBlock = pending ? pending.toBlock : blockCodeToNum(ev.emsBlock ?? '2B')

    onDragMove(employeeId, fromBlock, targetBlock)
  }, [evaluations, pendingChanges, onDragMove])

  const activeEmployee = activeId
    ? evaluations.find((e) => e.employeeId === activeId)
    : null

  // 모바일 감지 (md 미만에서는 DnD 비활성)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  const gridContent = (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Grid3X3 className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">EMS 9-Block Matrix</span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {GRID_LAYOUT.flat().map((blockNum) => {
          const items = grid[blockNum] ?? []
          return (
            <DroppableBlock
              key={blockNum}
              blockNum={blockNum}
              count={items.length}
              batchMode={batchMode && !isMobile}
              onSelectAll={() => onSelectAllInBlock(blockNum)}
            >
              {items.slice(0, 5).map((ev) => (
                <EmployeeChip
                  key={ev.employeeId}
                  ev={ev}
                  batchMode={batchMode && !isMobile}
                  isSelected={selectedIds.has(ev.employeeId)}
                  isPending={pendingChanges.has(ev.employeeId)}
                  readiness={readinessMap[ev.employeeId]}
                  onToggleSelect={() => onToggleSelect(ev.employeeId)}
                  onChipClick={() => onEmployeeChipClick(ev)}
                  onAdjClick={() => onAdjEmployeeClick(ev)}
                />
              ))}
              {items.length > 5 && (
                <span className="text-xs text-muted-foreground">+{items.length - 5}명</span>
              )}
            </DroppableBlock>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>{t('kr_kec84b1ea_low')}</span>
        <span>{t('kr_kec84b1ea_high')}</span>
      </div>
    </div>
  )

  if (!batchMode || isMobile) return gridContent

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {gridContent}
      <DragOverlay>
        {activeEmployee && (
          <div className="flex items-center gap-1 text-xs bg-primary text-white rounded-lg px-2 py-1 shadow-md">
            <GripVertical className="w-3 h-3" />
            {activeEmployee.employee.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
