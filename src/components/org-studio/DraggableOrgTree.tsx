'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — DraggableOrgTree
// Hierarchical department tree with full HTML5 Drag-and-Drop
// and real-time diff calculation
// ═══════════════════════════════════════════════════════════

import { useState, useCallback } from 'react'
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Users,
  User,
  Building2,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────

export interface OrgNode {
  id: string
  name: string
  manager: string
  headcount: number
  estSalaryCost: number // monthly KRW (mock)
  level: number
  children?: OrgNode[]
}

export interface MoveAction {
  nodeId: string
  nodeName: string
  fromParentId: string | null
  fromParentName: string
  toParentId: string
  toParentName: string
  headcount: number
  estSalaryCost: number
}

export interface SimulationDiff {
  headcountChange: number
  costChange: number
  deptCountChange: number
  moves: MoveAction[]
}

interface DraggableOrgTreeProps {
  selectedNode: OrgNode | null
  onSelectNode: (node: OrgNode | null) => void
  onDiffChange: (diff: SimulationDiff) => void
  tree: OrgNode[]
  onTreeChange: (tree: OrgNode[]) => void
}

// ─── Mock Data ──────────────────────────────────────────────

export const INITIAL_MOCK_TREE: OrgNode[] = [
  {
    id: 'ceo',
    name: '경영본부 (HQ)',
    manager: '이정훈 대표이사',
    headcount: 8,
    estSalaryCost: 64_000_000,
    level: 0,
    children: [
      {
        id: 'engineering',
        name: '개발본부',
        manager: '박준혁 CTO',
        headcount: 45,
        estSalaryCost: 360_000_000,
        level: 1,
        children: [
          {
            id: 'frontend',
            name: '프론트엔드팀',
            manager: '김지수 팀장',
            headcount: 12,
            estSalaryCost: 96_000_000,
            level: 2,
          },
          {
            id: 'backend',
            name: '백엔드팀',
            manager: '최민준 팀장',
            headcount: 18,
            estSalaryCost: 144_000_000,
            level: 2,
          },
          {
            id: 'devops',
            name: 'DevOps팀',
            manager: '이서연 팀장',
            headcount: 7,
            estSalaryCost: 56_000_000,
            level: 2,
          },
          {
            id: 'qa',
            name: 'QA팀',
            manager: '정하늘 팀장',
            headcount: 8,
            estSalaryCost: 64_000_000,
            level: 2,
          },
        ],
      },
      {
        id: 'sales',
        name: '영업본부',
        manager: '최영호 CSO',
        headcount: 32,
        estSalaryCost: 256_000_000,
        level: 1,
        children: [
          {
            id: 'domestic',
            name: '국내영업팀',
            manager: '오지민 팀장',
            headcount: 15,
            estSalaryCost: 120_000_000,
            level: 2,
          },
          {
            id: 'global',
            name: '글로벌영업팀',
            manager: '한승우 팀장',
            headcount: 17,
            estSalaryCost: 136_000_000,
            level: 2,
          },
        ],
      },
      {
        id: 'hr',
        name: '인사팀',
        manager: '김상우 CHO',
        headcount: 14,
        estSalaryCost: 112_000_000,
        level: 1,
        children: [
          {
            id: 'hr-ops',
            name: 'HR 운영팀',
            manager: '이미래 팀장',
            headcount: 7,
            estSalaryCost: 56_000_000,
            level: 2,
          },
          {
            id: 'talent',
            name: '인재개발팀',
            manager: '박소희 팀장',
            headcount: 7,
            estSalaryCost: 56_000_000,
            level: 2,
          },
        ],
      },
      {
        id: 'finance',
        name: '재무팀',
        manager: '손태양 CFO',
        headcount: 10,
        estSalaryCost: 80_000_000,
        level: 1,
      },
    ],
  },
]

// ─── Tree Helpers ─────────────────────────────────────────────

/** Find a node by id in the tree */
function findNode(id: string, nodes: OrgNode[]): OrgNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNode(id, node.children)
      if (found) return found
    }
  }
  return null
}

/** Find the parent id of a node */
function findParentId(targetId: string, nodes: OrgNode[], parentId: string | null = null): string | null {
  for (const node of nodes) {
    if (node.id === targetId) return parentId
    if (node.children) {
      const found = findParentId(targetId, node.children, node.id)
      if (found !== undefined) return found
    }
  }
  return undefined as unknown as null
}

/** Check if candidateAncestorId is an ancestor of (or equal to) nodeId */
function isAncestorOrSelf(nodeId: string, candidateAncestorId: string, nodes: OrgNode[]): boolean {
  if (nodeId === candidateAncestorId) return true
  const node = findNode(candidateAncestorId, nodes)
  if (!node || !node.children) return false
  return node.children.some((child) => isAncestorOrSelf(nodeId, child.id, nodes))
}

/** Remove a node from the tree by id, returns [updatedTree, removedNode] */
function removeNode(id: string, nodes: OrgNode[]): [OrgNode[], OrgNode | null] {
  let removed: OrgNode | null = null
  const result = nodes.filter((node) => {
    if (node.id === id) {
      removed = node
      return false
    }
    return true
  }).map((node) => {
    if (node.children) {
      const [newChildren, removedChild] = removeNode(id, node.children)
      if (removedChild) removed = removedChild
      return { ...node, children: newChildren }
    }
    return node
  })
  return [result, removed]
}

/** Set level recursively */
function setLevels(node: OrgNode, level: number): OrgNode {
  return {
    ...node,
    level,
    children: node.children?.map((child) => setLevels(child, level + 1)),
  }
}

/** Insert a node as a child of targetId */
function insertNode(nodeToInsert: OrgNode, targetId: string, nodes: OrgNode[]): OrgNode[] {
  return nodes.map((node) => {
    if (node.id === targetId) {
      const newChild = setLevels(nodeToInsert, node.level + 1)
      return { ...node, children: [...(node.children ?? []), newChild] }
    }
    if (node.children) {
      return { ...node, children: insertNode(nodeToInsert, targetId, node.children) }
    }
    return node
  })
}

/** Count totals for the toolbar */
function countNodes(nodes: OrgNode[]): { total: number; depts: number; cost: number } {
  let total = 0
  let depts = nodes.length
  let cost = 0
  for (const node of nodes) {
    total += node.headcount
    cost += node.estSalaryCost
    if (node.children) {
      const sub = countNodes(node.children)
      total += sub.total
      depts += sub.depts
      cost += sub.cost
    }
  }
  return { total, depts, cost }
}

function formatKRW(amount: number): string {
  if (amount >= 100_000_000) return `${(amount / 100_000_000).toFixed(1)}억원`
  if (amount >= 10_000) return `${(amount / 10_000).toFixed(0)}만원`
  return `${amount.toLocaleString()}원`
}

const LEVEL_INDENT = ['', 'pl-6', 'pl-12']
const LEVEL_ACCENT = [
  'border-l-4 border-[#5E81F4]',
  'border-l-4 border-[#6EE7B7]',
  'border-l-4 border-[#FCD34D]',
]

// ─── OrgNodeCard ─────────────────────────────────────────────

interface OrgNodeCardProps {
  node: OrgNode
  selectedNodeId: string | null
  draggingId: string | null
  dragOverId: string | null
  onSelect: (node: OrgNode) => void
  onDragStart: (e: React.DragEvent, node: OrgNode) => void
  onDragOver: (e: React.DragEvent, node: OrgNode) => void
  onDrop: (e: React.DragEvent, node: OrgNode) => void
  onDragEnd: () => void
}

function OrgNodeCard({
  node,
  selectedNodeId,
  draggingId,
  dragOverId,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: OrgNodeCardProps) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children && node.children.length > 0
  const accentClass = LEVEL_ACCENT[Math.min(node.level, LEVEL_ACCENT.length - 1)]
  const isSelected = selectedNodeId === node.id
  const isDragging = draggingId === node.id
  const isDragOver = dragOverId === node.id && draggingId !== node.id

  return (
    <div className={LEVEL_INDENT[Math.min(node.level, LEVEL_INDENT.length - 1)]}>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, node)}
        onDragOver={(e) => onDragOver(e, node)}
        onDrop={(e) => onDrop(e, node)}
        onDragEnd={onDragEnd}
        className={[
          'mb-2 cursor-pointer rounded-lg border bg-white transition-all duration-150',
          accentClass,
          isDragging
            ? 'opacity-40 scale-95'
            : isDragOver
              ? 'border-[#00C853] shadow-md ring-2 ring-[#00C853]/30 bg-[#E8F5E9]'
              : isSelected
                ? 'border-[#5E81F4] shadow-sm ring-1 ring-[#5E81F4]/20'
                : 'border-[#F0F0F3] hover:border-[#5E81F4]/30 hover:shadow-sm',
        ].join(' ')}
        onClick={() => onSelect(node)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onSelect(node)}
      >
        <div className="flex items-center gap-2 px-3 py-3">
          {/* Drag handle */}
          <span
            className="flex-shrink-0 cursor-grab text-[#C7C7D2] active:cursor-grabbing"
            title="드래그하여 이동"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={16} />
          </span>

          {/* Expand toggle */}
          {hasChildren ? (
            <button
              className="flex-shrink-0 text-[#8181A5] hover:text-[#1C1D21]"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded((v) => !v)
              }}
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-[14px] flex-shrink-0" />
          )}

          {/* Icon */}
          <span className="flex-shrink-0 text-[#8181A5]">
            {node.level === 0 ? (
              <Building2 size={15} />
            ) : node.level === 1 ? (
              <Users size={15} />
            ) : (
              <User size={15} />
            )}
          </span>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-[#1C1D21]">{node.name}</p>
              <span className="flex-shrink-0 rounded-full bg-[#F5F5FA] px-2 py-0.5 text-[11px] font-medium text-[#8181A5]">
                {node.headcount}명
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-[#8181A5]">{node.manager}</p>
          </div>

          {/* Cost */}
          <div className="flex-shrink-0 text-right">
            <p className="text-xs font-semibold text-[#1C1D21]">{formatKRW(node.estSalaryCost)}</p>
            <p className="text-[10px] text-[#8181A5]">월 인건비(추정)</p>
          </div>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="ml-4 border-l border-dashed border-[#E8E8F0]">
          {node.children!.map((child) => (
            <OrgNodeCard
              key={child.id}
              node={child}
              selectedNodeId={selectedNodeId}
              draggingId={draggingId}
              dragOverId={dragOverId}
              onSelect={onSelect}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── DraggableOrgTree ────────────────────────────────────────

export function DraggableOrgTree({
  selectedNode,
  onSelectNode,
  onDiffChange,
  tree,
  onTreeChange,
}: DraggableOrgTreeProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [moves, setMoves] = useState<MoveAction[]>([])

  const stats = countNodes(tree)

  const handleDragStart = useCallback((e: React.DragEvent, node: OrgNode) => {
    setDraggingId(node.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', node.id)
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent, node: OrgNode) => {
      e.preventDefault()
      if (node.id === draggingId) return
      e.dataTransfer.dropEffect = 'move'
      setDragOverId(node.id)
    },
    [draggingId],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, targetNode: OrgNode) => {
      e.preventDefault()
      e.stopPropagation()
      const dragId = draggingId
      if (!dragId || dragId === targetNode.id) {
        setDraggingId(null)
        setDragOverId(null)
        return
      }

      // Prevent dropping a node into its own descendant
      if (isAncestorOrSelf(targetNode.id, dragId, tree)) {
        setDraggingId(null)
        setDragOverId(null)
        return
      }

      const draggedNode = findNode(dragId, tree)
      if (!draggedNode) {
        setDraggingId(null)
        setDragOverId(null)
        return
      }

      const fromParentId = findParentId(dragId, tree)
      const fromParent = fromParentId ? findNode(fromParentId, tree) : null

      // Remove the dragged node from its current position
      const [treeAfterRemove, removedNode] = removeNode(dragId, tree)
      if (!removedNode) {
        setDraggingId(null)
        setDragOverId(null)
        return
      }

      // Insert under target
      const newTree = insertNode(removedNode, targetNode.id, treeAfterRemove)
      onTreeChange(newTree)

      // Record move action
      const moveAction: MoveAction = {
        nodeId: dragId,
        nodeName: draggedNode.name,
        fromParentId: fromParentId ?? null,
        fromParentName: fromParent?.name ?? '(최상위)',
        toParentId: targetNode.id,
        toParentName: targetNode.name,
        headcount: draggedNode.headcount,
        estSalaryCost: draggedNode.estSalaryCost,
      }

      const newMoves = [...moves, moveAction]
      setMoves(newMoves)

      onDiffChange({
        headcountChange: 0,
        costChange: 0,
        deptCountChange: 0,
        moves: newMoves,
      })

      setDraggingId(null)
      setDragOverId(null)
    },
    [draggingId, tree, moves, onTreeChange, onDiffChange],
  )

  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
    setDragOverId(null)
  }, [])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#1C1D21]">조직 트리</h2>
          <p className="text-xs text-[#8181A5]">
            총 {stats.depts + 1}개 부서 · {stats.total + tree[0].headcount}명 ·{' '}
            월 {formatKRW(stats.cost + tree[0].estSalaryCost)} 추정
          </p>
        </div>
        <div className="flex items-center gap-2">
          {moves.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-[#00C853]/10 px-2.5 py-1 text-xs font-medium text-[#00A844]">
              {moves.length}개 변경됨
            </span>
          )}
          <span className="flex items-center gap-1 rounded-full bg-[#5E81F4]/10 px-2.5 py-1 text-xs font-medium text-[#5E81F4]">
            <GripVertical size={11} />
            드래그 이동 활성
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 rounded-lg border border-[#F0F0F3] bg-white px-4 py-2.5">
        <span className="text-xs font-medium text-[#8181A5]">범례</span>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-1 rounded-full bg-[#5E81F4]" />
          <span className="text-xs text-[#8181A5]">본부급</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-1 rounded-full bg-[#6EE7B7]" />
          <span className="text-xs text-[#8181A5]">부문급</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-1 rounded-full bg-[#FCD34D]" />
          <span className="text-xs text-[#8181A5]">팀급</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="h-3 w-3 rounded border-2 border-[#00C853]" />
          <span className="text-xs text-[#8181A5]">드롭 대상</span>
        </div>
      </div>

      {/* Tree */}
      <div
        className="space-y-1"
        onDragOver={(e) => e.preventDefault()}
      >
        {tree.map((node) => (
          <OrgNodeCard
            key={node.id}
            node={node}
            selectedNodeId={selectedNode?.id ?? null}
            draggingId={draggingId}
            dragOverId={dragOverId}
            onSelect={(n) => onSelectNode(selectedNode?.id === n.id ? null : n)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>
    </div>
  )
}
