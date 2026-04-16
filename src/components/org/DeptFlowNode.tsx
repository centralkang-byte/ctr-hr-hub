// ═══════════════════════════════════════════════════════════
// CTR HR Hub — DeptFlowNode
// Phase 4 Batch 8: 리디자인된 조직도 트리 노드
// ═══════════════════════════════════════════════════════════

'use client'

import { useTranslations } from 'next-intl'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { User } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────

type DeptHead = {
  employeeId: string
  name: string
  nameEn: string | null
  title: string | null
}

type DeptNode = {
  id: string
  name: string
  nameEn: string | null
  code: string
  level: number
  sortOrder: number
  deletedAt: string | null
  parentId: string | null
  employeeCount: number
  head: DeptHead | null
  children: DeptNode[]
}

export type DeptFlowNodeData = {
  dept: DeptNode
  isRoot: boolean
  isCollapsed: boolean
  colorIndex: number
  onToggleCollapse: (deptId: string) => void
  onClick: (dept: DeptNode) => void
}

// ─── Constants ──────────────────────────────────────────────

/** 10색 순환 팔레트 (목업 추출) */
const AVATAR_PALETTE = [
  '#6366f1', // primary (violet)
  '#0ea5e9', // sky
  '#16a34a', // tertiary (green)
  '#f59e0b', // warning (amber)
  '#e11d48', // error (rose)
  '#7c3aed', // accent (purple)
  '#06b6d4', // cyan
  '#ea580c', // orange
  '#84cc16', // lime
  '#ec4899', // pink
] as const

/** 레벨별 노드 크기 (목업 일치) */
export const NODE_SIZES = {
  root:    { w: 220, h: 100 },
  level1:  { w: 200, h: 100 },
  compact: { w: 160, h: 80 },
} as const

export function getNodeSize(level: number, isRoot: boolean) {
  if (isRoot) return NODE_SIZES.root
  if (level <= 1) return NODE_SIZES.level1
  return NODE_SIZES.compact
}

// ─── Helpers ────────────────────────────────────────────────

function getAvatarColor(index: number): string {
  return AVATAR_PALETTE[index % AVATAR_PALETTE.length]
}

function getInitials(name?: string | null, nameEn?: string | null): string {
  if (name) return name.slice(0, 2)
  if (nameEn) return nameEn.slice(0, 2).toUpperCase()
  return '??'
}

// ─── Component ──────────────────────────────────────────────

export function DeptFlowNode({ data }: NodeProps) {
  const { dept, isRoot, isCollapsed, colorIndex, onToggleCollapse, onClick } =
    data as unknown as DeptFlowNodeData
  const tOrg = useTranslations('org')

  const isCompact = dept.level >= 2 && !isRoot
  const hasChildren = dept.children.length > 0

  // 레벨별 사이즈
  const { w } = getNodeSize(dept.level, isRoot)
  const avatarCls = isCompact
    ? 'w-6 h-6 text-[8px]'
    : 'w-8 h-8 text-[11px]'
  const nameCls = isCompact ? 'text-[10px]' : 'text-[11px]'
  const metaCls = isCompact ? 'text-[8px]' : 'text-[9px]'
  const expandSize = isCompact ? 'w-3.5 h-3.5 text-[8px]' : 'w-[18px] h-[18px] text-[10px]'

  return (
    <div
      style={{ width: w }}
      className={[
        'rounded-lg border cursor-pointer shadow-sm',
        'transition-all hover:border-primary hover:-translate-y-0.5 hover:shadow-md',
        isRoot
          ? 'bg-gradient-to-br from-primary to-primary-dim text-white border-transparent'
          : 'bg-card border-border',
        dept.deletedAt ? 'opacity-60' : '',
      ].join(' ')}
      onClick={() => onClick(dept)}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary" />

      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Avatar */}
        <div
          className={`${avatarCls} rounded-md flex items-center justify-center text-white font-bold flex-shrink-0`}
          style={{
            backgroundColor: isRoot ? 'rgba(255,255,255,0.2)' : getAvatarColor(colorIndex),
          }}
        >
          {dept.head
            ? getInitials(dept.head.name, dept.head.nameEn)
            : dept.name.slice(0, 2)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p
            className={`${nameCls} font-bold leading-tight line-clamp-1 ${
              isRoot ? 'text-white' : 'text-foreground'
            }`}
          >
            {dept.name}
          </p>

          {dept.head && (
            <p
              className={`${metaCls} flex items-center gap-0.5 mt-0.5 ${
                isRoot ? 'text-white/70' : 'text-muted-foreground'
              }`}
            >
              <User size={isCompact ? 7 : 8} strokeWidth={1.5} />
              {dept.head.name}
              {dept.head.title ? ` · ${dept.head.title}` : ''}
            </p>
          )}

          <p
            className={`${metaCls} mt-0.5 ${
              isRoot ? 'text-white/60' : 'text-muted-foreground'
            }`}
          >
            {tOrg('headcountUnit', { count: dept.employeeCount })}
            {dept.children.length > 0 &&
              ` · ${tOrg('subDeptCount', { count: dept.children.length })}`}
          </p>
        </div>

        {/* Expand/collapse */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse(dept.id)
            }}
            className={`${expandSize} rounded flex items-center justify-center flex-shrink-0 ${
              isRoot
                ? 'bg-white/20 text-white'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {isCollapsed ? '+' : '−'}
          </button>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  )
}
