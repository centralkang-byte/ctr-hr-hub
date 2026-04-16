// ═══════════════════════════════════════════════════════════
// CTR HR Hub — DirectoryView
// Phase 4 Batch 8: 디렉토리 뷰 (트리 사이드바 + 멤버 테이블)
// ═══════════════════════════════════════════════════════════

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { TABLE_STYLES } from '@/lib/styles'
import { toast } from '@/hooks/use-toast'

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

type DirectoryEmployee = {
  id: string
  name: string
  nameEn: string | null
  email: string
  department: { id: string; name: string } | null
  title: { id: string; name: string } | null
  jobGrade: { id: string; name: string; code: string } | null
}

interface DirectoryViewProps {
  tree: DeptNode[]
  selectedCompanyId: string
}

// ─── Constants ──────────────────────────────────────────────

const AVATAR_PALETTE = [
  '#6366f1', '#0ea5e9', '#16a34a', '#f59e0b', '#e11d48',
  '#7c3aed', '#06b6d4', '#ea580c', '#84cc16', '#ec4899',
] as const

// ─── Helpers ────────────────────────────────────────────────

function flattenTree(tree: DeptNode[]): DeptNode[] {
  const result: DeptNode[] = []
  const queue = [...tree]
  while (queue.length > 0) {
    const node = queue.shift()!
    result.push(node)
    queue.push(...node.children)
  }
  return result
}

function getDescendantIds(node: DeptNode): string[] {
  const ids: string[] = []
  const queue = [...node.children]
  while (queue.length > 0) {
    const n = queue.shift()!
    ids.push(n.id)
    queue.push(...n.children)
  }
  return ids
}

// ─── Tree Sidebar Item ──────────────────────────────────────

function TreeItem({
  dept,
  depth,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
}: {
  dept: DeptNode
  depth: number
  selectedId: string | null
  expandedIds: Set<string>
  onSelect: (id: string) => void
  onToggle: (id: string) => void
}) {
  const hasChildren = dept.children.length > 0
  const isExpanded = expandedIds.has(dept.id)
  const isActive = selectedId === dept.id

  return (
    <>
      <button
        onClick={() => onSelect(dept.id)}
        className={`w-full flex items-center gap-1 py-1.5 rounded-md cursor-pointer text-[11px] ${
          isActive
            ? 'bg-primary/8 text-primary font-semibold'
            : 'text-muted-foreground hover:bg-muted/50'
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: 6 }}
      >
        {hasChildren ? (
          <span
            className="w-3 flex-shrink-0 text-muted-foreground"
            onClick={(e) => { e.stopPropagation(); onToggle(dept.id) }}
          >
            {isExpanded
              ? <ChevronDown size={12} strokeWidth={1.5} />
              : <ChevronRight size={12} strokeWidth={1.5} />
            }
          </span>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        <span className="truncate flex-1 text-left">{dept.name}</span>
        <span className="text-[9px] text-muted-foreground font-medium flex-shrink-0 ml-1">
          {dept.employeeCount}
        </span>
      </button>
      {hasChildren && isExpanded && dept.children.map((child) => (
        <TreeItem
          key={child.id}
          dept={child}
          depth={depth + 1}
          selectedId={selectedId}
          expandedIds={expandedIds}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </>
  )
}

// ─── Component ──────────────────────────────────────────────

export function DirectoryView({ tree, selectedCompanyId }: DirectoryViewProps) {
  const t = useTranslations('org')
  const SENTINEL_ALL = '__ALL__'

  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [includeSubDepts, setIncludeSubDepts] = useState(false)
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([])
  const [total, setTotal] = useState(0)
  const [inactiveCount, setInactiveCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searchDir, setSearchDir] = useState('')

  const allDepts = useMemo(() => flattenTree(tree), [tree])

  // 첫 로드 시 루트 레벨 확장
  useEffect(() => {
    const rootIds = new Set(tree.map((n) => n.id))
    setExpandedIds(rootIds)
  }, [tree])

  const selectedDeptNode = useMemo(
    () => allDepts.find((d) => d.id === selectedDeptId) ?? null,
    [allDepts, selectedDeptId],
  )

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelect = useCallback((id: string) => {
    setSelectedDeptId(id)
    setPage(1)
  }, [])

  // 데이터 fetch
  useEffect(() => {
    setLoading(true)
    const params: Record<string, string | number | undefined> = {
      page,
      limit: 20,
    }
    if (selectedCompanyId !== SENTINEL_ALL) params.companyId = selectedCompanyId
    if (searchDir.trim()) params.search = searchDir.trim()

    if (selectedDeptId && includeSubDepts && selectedDeptNode) {
      const ids = [selectedDeptId, ...getDescendantIds(selectedDeptNode)]
      params.departmentIds = ids.join(',')
    } else if (selectedDeptId) {
      params.departmentId = selectedDeptId
    }

    apiClient.getList<DirectoryEmployee>('/api/v1/directory', params)
      .then((res) => {
        setEmployees(res.data ?? [])
        setTotal(res.pagination?.total ?? 0)
        // inactiveCount는 PaginatedResponse 표준 외 확장 필드
        setInactiveCount((res as unknown as Record<string, number>).inactiveCount ?? 0)
      })
      .catch(() => {
        toast({ title: '데이터 로드 실패', variant: 'destructive' })
        setEmployees([])
      })
      .finally(() => setLoading(false))
  }, [selectedCompanyId, selectedDeptId, includeSubDepts, selectedDeptNode, page, searchDir])

  const companyName = useMemo(() => {
    if (selectedCompanyId === SENTINEL_ALL) return 'CTR Group'
    // 사이드바 루트 중 매칭
    return tree.find((n) => n.code !== 'GROUP')?.name ?? ''
  }, [tree, selectedCompanyId])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar */}
      <aside className="w-[200px] shrink-0 overflow-y-auto bg-card p-2">
        <p className="text-[10px] font-bold text-primary px-2 py-1 mb-1">
          {companyName} <span className="text-muted-foreground font-medium">{allDepts.reduce((s, d) => s + d.employeeCount, 0)}</span>
        </p>
        {tree.map((dept) => (
          <TreeItem
            key={dept.id}
            dept={dept}
            depth={0}
            selectedId={selectedDeptId}
            expandedIds={expandedIds}
            onSelect={handleSelect}
            onToggle={handleToggle}
          />
        ))}
      </aside>

      {/* Right content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0">
          <span className="text-[10px] text-muted-foreground">
            <b className="text-foreground">{selectedDeptNode?.name ?? companyName}</b>
            {' · All '}
            {total}
            {inactiveCount > 0 && (
              <span className="text-muted-foreground"> · {t('inactive')} {inactiveCount}</span>
            )}
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[9px] text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSubDepts}
                onChange={(e) => { setIncludeSubDepts(e.target.checked); setPage(1) }}
                className="w-3 h-3 rounded border-border accent-primary"
              />
              {t('includeSubDepts')}
            </label>
            <div className="relative">
              <Search size={12} strokeWidth={1.5} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchDir}
                onChange={(e) => { setSearchDir(e.target.value); setPage(1) }}
                placeholder={t('searchEmployees')}
                className="pl-6 pr-2 py-1 text-[10px] border border-border rounded-full bg-card focus:outline-none focus:ring-1 focus:ring-primary/10 w-32"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className={TABLE_STYLES.table}>
            <thead>
              <tr>
                <th className="text-left text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 bg-muted/30">{t('name')}</th>
                <th className="text-left text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 bg-muted/30">{t('email')}</th>
                <th className="text-left text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 bg-muted/30">{t('department')}</th>
                <th className="text-left text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 bg-muted/30">{t('positionTitle')}</th>
                <th className="text-left text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 bg-muted/30">{t('grade')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-xs text-muted-foreground">{t('loadingData')}</td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-xs text-muted-foreground">{t('noEmployees')}</td>
                </tr>
              ) : (
                employees.map((emp, i) => (
                  <tr key={emp.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-[26px] h-[26px] rounded-md flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: AVATAR_PALETTE[i % AVATAR_PALETTE.length] }}
                        >
                          {emp.name.slice(0, 1)}
                        </div>
                        <span className="text-[11px] font-semibold text-foreground">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[10px] text-muted-foreground">{emp.email}</td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">{emp.department?.name ?? '-'}</td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">{emp.title?.name ?? '-'}</td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">{emp.jobGrade?.name ?? '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-card shrink-0 text-[10px] text-muted-foreground">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2 py-0.5 rounded bg-muted/50 disabled:opacity-40"
            >
              ←
            </button>
            <span>{(page - 1) * 20 + 1}-{Math.min(page * 20, total)} / {total}</span>
            <button
              disabled={page * 20 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-0.5 rounded bg-muted/50 disabled:opacity-40"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
