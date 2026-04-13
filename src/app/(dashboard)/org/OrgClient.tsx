// ═══════════════════════════════════════════════════════════
// CTR HR Hub — OrgClient (Client Component)
// B8-1: 조직도 시각화 + 조직 개편
// ═══════════════════════════════════════════════════════════

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import { GitBranch, LayoutGrid, List, Network, Search, Users } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser, RefOption } from '@/types'
import { ROLE } from '@/lib/constants'
import { EffectiveDatePicker } from '@/components/shared/EffectiveDatePicker'
import { RestructureModal } from '@/components/org/RestructureModal'
import { DetailPanel } from '@/components/org/DetailPanel'
import { DirectoryView } from '@/components/org/DirectoryView'
import { BUTTON_SIZES, BUTTON_VARIANTS, TABLE_STYLES, TAB_STYLES } from '@/lib/styles'
import { DeptFlowNode, getNodeSize, type DeptFlowNodeData } from '@/components/org/DeptFlowNode'

// ─── Types ─────────────────────────────────────────────────

type ViewMode = 'tree' | 'directory' | 'list' | 'grid'

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

// ─── Constants ─────────────────────────────────────────────

const SENTINEL_ALL = '__ALL__'
const GROUP_ROOT_ID = '__GROUP_ROOT__'

function formatDateYMD(date: Date): string {
  return date.toISOString().split('T')[0]
}

function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

const nodeTypes: NodeTypes = {
  deptNode: DeptFlowNode,
}

// ─── Dagre layout builder ───────────────────────────────────

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

/** collapsed 자식 pruning + 그룹 루트 가상 노드 주입 */
function buildFlowElements(
  tree: DeptNode[],
  onNodeClick: (dept: DeptNode) => void,
  collapsedIds: Set<string>,
  onToggleCollapse: (id: string) => void,
  selectedCompanyId: string,
): { nodes: Node[]; edges: Edge[] } {
  if (tree.length === 0) return { nodes: [], edges: [] }

  // 그룹 루트 가상 노드 (전체 법인 조회 시)
  let workingTree = tree
  if (selectedCompanyId === SENTINEL_ALL && tree.length > 0) {
    const totalCount = tree.reduce((sum, n) => sum + n.employeeCount, 0)
    const groupRoot: DeptNode = {
      id: GROUP_ROOT_ID,
      name: 'CTR Group',
      nameEn: 'CTR Group',
      code: 'GROUP',
      level: 0,
      sortOrder: 0,
      deletedAt: null,
      parentId: null,
      employeeCount: totalCount,
      head: null,
      children: tree.map((r) => ({ ...r, parentId: GROUP_ROOT_ID })),
    }
    workingTree = [groupRoot]
  }

  // collapsed pruning이 적용된 flat 배열
  const flat: DeptNode[] = []
  const queue = [...workingTree]
  while (queue.length > 0) {
    const node = queue.shift()!
    flat.push(node)
    if (!collapsedIds.has(node.id)) {
      queue.push(...node.children)
    }
  }

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', ranksep: 50, nodesep: 24 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const dept of flat) {
    const isRoot = dept.id === GROUP_ROOT_ID || (selectedCompanyId !== SENTINEL_ALL && !dept.parentId)
    const size = getNodeSize(dept.level, isRoot)
    g.setNode(dept.id, { width: size.w, height: size.h })
  }
  for (const dept of flat) {
    if (dept.parentId && flat.some((n) => n.id === dept.parentId)) {
      g.setEdge(dept.parentId, dept.id)
    }
  }

  dagre.layout(g)

  let colorIdx = 0
  const nodes: Node[] = flat.map((dept) => {
    const pos = g.node(dept.id)
    const isRoot = dept.id === GROUP_ROOT_ID || (selectedCompanyId !== SENTINEL_ALL && !dept.parentId)
    const size = getNodeSize(dept.level, isRoot)
    const ci = colorIdx++
    return {
      id: dept.id,
      type: 'deptNode',
      position: { x: pos.x - size.w / 2, y: pos.y - size.h / 2 },
      data: {
        dept,
        isRoot,
        isCollapsed: collapsedIds.has(dept.id),
        colorIndex: ci,
        onToggleCollapse,
        onClick: onNodeClick,
      } satisfies DeptFlowNodeData as unknown as Record<string, unknown>,
    }
  })

  const edges: Edge[] = flat
    .filter((dept) => dept.parentId && flat.some((n) => n.id === dept.parentId))
    .map((dept) => ({
      id: `e-${dept.parentId}-${dept.id}`,
      source: dept.parentId!,
      target: dept.id,
      type: 'smoothstep',
      style: { stroke: 'hsl(var(--border))', strokeWidth: 1.5 },
    }))

  return { nodes, edges }
}

// ─── Inner Flow Canvas ──────────────────────────────────────

interface FlowCanvasProps {
  initNodes: Node[]
  initEdges: Edge[]
}

function FlowCanvas({ initNodes, initEdges }: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)
  const { fitView } = useReactFlow()

  useEffect(() => {
    setNodes(initNodes)
    setEdges(initEdges)
    setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 50)
  }, [initNodes, initEdges, setNodes, setEdges, fitView])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.4}
      maxZoom={2}
      className="bg-background"
    >
      <Background color="hsl(var(--border))" gap={20} />
      <Controls />
    </ReactFlow>
  )
}

// ─── List View ──────────────────────────────────────────────

interface ListViewProps {
  depts: DeptNode[]
  onSelect: (dept: DeptNode) => void
  selectedId: string | null
}

function ListView({ depts, onSelect, selectedId }: ListViewProps) {
  const tOrg = useTranslations('org')
  const tc = useTranslations('common')

  if (depts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">{tOrg('noDepartments')}</p>
      </div>
    )
  }

  return (
    <div className="overflow-auto h-full">
      <table className={TABLE_STYLES.table}>
        <thead className="sticky top-0 z-10">
          <tr className={TABLE_STYLES.header}>
            <th className={TABLE_STYLES.headerCell}>{tOrg('code')}</th>
            <th className={TABLE_STYLES.headerCell}>{tOrg('name')}</th>
            <th className={TABLE_STYLES.headerCell}>{tOrg('level')}</th>
            <th className={TABLE_STYLES.headerCell}>{tOrg('headcount')}</th>
            <th className={TABLE_STYLES.headerCell}>{tOrg('status')}</th>
          </tr>
        </thead>
        <tbody>
          {depts.map((dept) => (
            <tr
              key={dept.id}
              onClick={() => onSelect(dept)}
              className={`border-b border-border cursor-pointer hover:bg-background transition-colors ${
                selectedId === dept.id ? 'bg-primary/10' : ''
              }`}
            >
              <td className="px-4 py-3 font-mono tabular-nums text-xs text-muted-foreground">{dept.code}</td>
              <td className="px-4 py-3 font-medium text-foreground" style={{ paddingLeft: `${1 + dept.level * 1.5}rem` }}>
                {dept.level > 0 && <span className="text-border mr-1">{'└'}</span>}
                {dept.name}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{dept.level + 1}</td>
              <td className="px-4 py-3 text-foreground">{tOrg('headcountUnit', { count: dept.employeeCount })}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  !dept.deletedAt
                    ? 'bg-emerald-500/15 text-emerald-700'
                    : 'bg-background text-muted-foreground border border-border'
                }`}>
                  {!dept.deletedAt ? tc('active') : tc('inactive')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Grid View ──────────────────────────────────────────────

interface GridViewProps {
  depts: DeptNode[]
  onSelect: (dept: DeptNode) => void
  selectedId: string | null
}

function GridView({ depts, onSelect, selectedId }: GridViewProps) {
  const tOrg = useTranslations('org')
  const tc = useTranslations('common')

  if (depts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">{tOrg('noDepartments')}</p>
      </div>
    )
  }

  return (
    <div className="overflow-auto h-full p-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {depts.map((dept) => (
          <button
            key={dept.id}
            onClick={() => onSelect(dept)}
            className={`text-left rounded-lg border p-4 transition-all hover:border-primary hover:shadow-sm ${
              selectedId === dept.id
                ? 'border-primary bg-primary/10 shadow-sm'
                : 'border-border bg-card'
            } ${!!dept.deletedAt ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-[10px] font-mono tabular-nums text-muted-foreground bg-background px-1.5 py-0.5 rounded">{dept.code}</span>
              {!!dept.deletedAt && (
                <span className="text-[10px] text-muted-foreground">{tc('inactive')}</span>
              )}
            </div>
            <p className="text-sm font-semibold text-foreground line-clamp-2 mb-1">{dept.name}</p>
            {dept.nameEn && (
              <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{dept.nameEn}</p>
            )}
            <p className="text-xs text-primary font-medium">
              {tOrg('headcountUnit', { count: dept.employeeCount })}
            </p>
            {dept.children.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {tOrg('subDepartments')} {dept.children.length}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}


// ─── Snapshot Tree Builder ──────────────────────────────────

function buildSnapshotTree(
  depts: Array<{
    id: string
    name: string
    code: string
    level: number
    parentId: string | null
    headcount: number
  }>,
): DeptNode[] {
  const nodeMap = new Map<string, DeptNode>()
  for (const d of depts) {
    nodeMap.set(d.id, {
      id: d.id,
      name: d.name,
      nameEn: null,
      code: d.code,
      level: d.level,
      sortOrder: 0,
      deletedAt: null,
      parentId: d.parentId,
      employeeCount: d.headcount,
      head: null,
      children: [],
    })
  }
  const roots: DeptNode[] = []
  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

// ─── View Mode Button ───────────────────────────────────────

interface ViewModeButtonProps {
  mode: ViewMode
  current: ViewMode
  icon: React.ReactNode
  label: string
  onClick: () => void
}

function ViewModeButton({ mode, current, icon, label, onClick }: ViewModeButtonProps) {
  const active = mode === current
  return (
    <button
      onClick={onClick}
      title={label}
      data-state={active ? 'active' : 'inactive'}
      className={TAB_STYLES.trigger}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

// ─── OrgClient ──────────────────────────────────────────────

interface OrgClientProps {
  user: SessionUser
  companies: RefOption[]
}

export function OrgClient({ user, companies }: OrgClientProps) {
  const t = useTranslations('org')
  const isSuperAdmin = user.role === ROLE.SUPER_ADMIN
  const canRestructure = user.role === ROLE.SUPER_ADMIN || user.role === ROLE.HR_ADMIN

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    isSuperAdmin ? SENTINEL_ALL : user.companyId,
  )
  const [tree, setTree] = useState<DeptNode[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDept, setSelectedDept] = useState<DeptNode | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [search, setSearch] = useState('')
  const [effectiveDate, setEffectiveDate] = useState<Date>(new Date())
  const [showRestructureModal, setShowRestructureModal] = useState(false)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [showMatrix, setShowMatrix] = useState(false)
  const [matrixEdgeData, setMatrixEdgeData] = useState<Array<{ fromDeptId: string; toDeptId: string }>>([])


  const isSnapshot = useMemo(() => !isToday(effectiveDate), [effectiveDate])
  const snapshotDateStr = useMemo(() => (isSnapshot ? formatDateYMD(effectiveDate) : undefined), [isSnapshot, effectiveDate])

  const loadTree = useCallback(async (companyId: string, date?: string) => {
    setLoading(true)
    setSelectedDept(null)
    try {
      if (date) {
        const params = new URLSearchParams({ date })
        if (companyId !== SENTINEL_ALL) params.set('companyId', companyId)
        const res = await apiClient.get<Array<{
          snapshotData: {
            departments: Array<{
              id: string
              name: string
              code: string
              level: number
              parentId: string | null
              headcount: number
            }>
          }
        }>>(`/api/v1/org/snapshots?${params.toString()}`)
        const snapshots = res.data
        if (snapshots.length > 0) {
          setTree(buildSnapshotTree(snapshots[0].snapshotData.departments))
        } else {
          setTree([])
        }
      } else {
        const params = companyId !== SENTINEL_ALL ? `?companyId=${companyId}` : ''
        const res = await apiClient.get<{ tree: DeptNode[] }>(`/api/v1/org/tree${params}`)
        setTree(res.data.tree)
      }
    } catch {
      setTree([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTree(selectedCompanyId, snapshotDateStr)
  }, [loadTree, selectedCompanyId, snapshotDateStr])

  const handleNodeClick = useCallback((dept: DeptNode) => {
    if (dept.id === GROUP_ROOT_ID) return // 그룹 루트는 선택 불가
    setSelectedDept((prev) => (prev?.id === dept.id ? null : dept))
  }, [])

  const handleToggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allDepts = useMemo(() => flattenTree(tree), [tree])

  const filteredDepts = useMemo(() => {
    if (!search.trim()) return allDepts
    const q = search.toLowerCase()
    return allDepts.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        (d.nameEn && d.nameEn.toLowerCase().includes(q)),
    )
  }, [allDepts, search])

  // Matrix edge fetch
  useEffect(() => {
    if (!showMatrix) { setMatrixEdgeData([]); return }
    const params = selectedCompanyId !== SENTINEL_ALL ? `?companyId=${selectedCompanyId}` : ''
    apiClient.get<{ edges: Array<{ fromDeptId: string; toDeptId: string }> }>(`/api/v1/org/matrix-edges${params}`)
      .then((res) => setMatrixEdgeData(res.data.edges))
      .catch(() => setMatrixEdgeData([]))
  }, [showMatrix, selectedCompanyId])

  const { nodes: initNodes, edges: initEdges } = useMemo(() => {
    const result = buildFlowElements(tree, handleNodeClick, collapsedIds, handleToggleCollapse, selectedCompanyId)
    // 매트릭스 점선 edge 추가
    if (showMatrix && matrixEdgeData.length > 0) {
      const nodeIds = new Set(result.nodes.map((n) => n.id))
      for (const me of matrixEdgeData) {
        if (nodeIds.has(me.fromDeptId) && nodeIds.has(me.toDeptId)) {
          result.edges.push({
            id: `matrix-${me.fromDeptId}-${me.toDeptId}`,
            source: me.fromDeptId,
            target: me.toDeptId,
            type: 'smoothstep',
            style: { stroke: 'hsl(var(--primary-container))', strokeWidth: 1.5, strokeDasharray: '6 4' },
          })
        }
      }
    }
    return result
  }, [tree, handleNodeClick, collapsedIds, handleToggleCollapse, selectedCompanyId, showMatrix, matrixEdgeData])

  // For tree view, filter by hiding unmatched (highlight instead)
  const filteredTreeNodes = useMemo(() => {
    if (!search.trim()) return initNodes
    const matchedIds = new Set(filteredDepts.map((d) => d.id))
    return initNodes.map((n) => ({
      ...n,
      style: matchedIds.has(n.id) ? {} : { opacity: 0.2 },
    }))
  }, [initNodes, filteredDepts, search])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-muted/30 shrink-0">
        <h1 className="text-lg font-bold text-foreground tracking-ctr mr-2">{t('orgChart')}</h1>

        {/* View mode toggle */}
        <div className={TAB_STYLES.list} aria-label="View mode">
          <ViewModeButton
            mode="tree"
            current={viewMode}
            icon={<Network size={16} strokeWidth={1.5} />}
            label={t('viewTree')}
            onClick={() => setViewMode('tree')}
          />
          <ViewModeButton
            mode="directory"
            current={viewMode}
            icon={<Users size={16} strokeWidth={1.5} />}
            label={t('viewDirectory')}
            onClick={() => setViewMode('directory')}
          />
          <ViewModeButton
            mode="list"
            current={viewMode}
            icon={<List size={16} strokeWidth={1.5} />}
            label={t('viewList')}
            onClick={() => setViewMode('list')}
          />
          <ViewModeButton
            mode="grid"
            current={viewMode}
            icon={<LayoutGrid size={16} strokeWidth={1.5} />}
            label={t('viewGrid')}
            onClick={() => setViewMode('grid')}
          />
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={16} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchDepts')}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-full bg-card focus:outline-none focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
          />
        </div>

        {/* Matrix toggle (tree view only) */}
        {viewMode === 'tree' && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showMatrix}
              onChange={(e) => setShowMatrix(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border accent-primary"
            />
            {t('showMatrix')}
          </label>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {/* Effective Date Picker */}
          <EffectiveDatePicker
            value={effectiveDate}
            onChange={setEffectiveDate}
            allowFuture={false}
            label={t('effectiveDate')}
          />

          {/* Reset to today */}
          {isSnapshot && (
            <button
              onClick={() => setEffectiveDate(new Date())}
              className={`${BUTTON_SIZES.sm} ${BUTTON_VARIANTS.primary}`}
            >
              {t('current')}
            </button>
          )}

          {/* Company selector (SUPER_ADMIN only) */}
          {isSuperAdmin && (
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-primary/10"
            >
              <option value={SENTINEL_ALL}>{t('allCompanies')}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Restructure button */}
          {canRestructure && (
            <button
              onClick={() => setShowRestructureModal(true)}
              className={`inline-flex items-center gap-1.5 ${BUTTON_SIZES.md} ${BUTTON_VARIANTS.primary}`}
            >
              <GitBranch size={14} />
              {t('restructure')}
            </button>
          )}
        </div>
      </div>

      {/* Snapshot mode banner */}
      {isSnapshot && (
        <div className="px-6 py-2 bg-amber-500/15 border-b border-amber-300 text-amber-800 text-sm flex items-center gap-2 shrink-0">
          <span className="font-medium">{t('snapshotViewing', { date: snapshotDateStr ?? '' })}</span>
          <span className="text-amber-600 text-xs">({t('snapshotData')})</span>
        </div>
      )}

      {/* Search result count */}
      {search.trim() && (
        <div className="px-6 py-1.5 bg-tertiary-container/10 border-b border-tertiary/20 text-tertiary text-xs">
          {t('searchResult', { count: filteredDepts.length })}
        </div>
      )}

      {/* Main content area */}
      <div className="relative flex-1 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 z-20">
            <p className="text-sm text-muted-foreground">{t('loadingData')}</p>
          </div>
        )}

        {!loading && tree.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">{t('noDepartments')}</p>
          </div>
        )}

        {viewMode === 'tree' && (
          <>
            <ReactFlowProvider>
              <FlowCanvas initNodes={filteredTreeNodes} initEdges={initEdges} />
            </ReactFlowProvider>
            {showMatrix && (
              <div className="absolute bottom-4 left-4 flex items-center gap-4 text-[9px] text-muted-foreground z-10">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-0 border-t-2 border-border" />
                  {t('directReport')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-0 border-t-2 border-dashed border-primary-container" />
                  {t('matrixReport')}
                </span>
              </div>
            )}
            <DetailPanel dept={selectedDept} onClose={() => setSelectedDept(null)} />
          </>
        )}

        {viewMode === 'directory' && (
          <DirectoryView tree={tree} selectedCompanyId={selectedCompanyId} />
        )}

        {viewMode === 'list' && (
          <div className="flex h-full">
            <div className={`flex-1 overflow-hidden ${selectedDept ? 'pr-80' : ''}`}>
              <ListView
                depts={filteredDepts}
                onSelect={handleNodeClick}
                selectedId={selectedDept?.id ?? null}
              />
            </div>
            {selectedDept && (
              <div className="absolute top-0 right-0 h-full">
                <DetailPanel dept={selectedDept} onClose={() => setSelectedDept(null)} />
              </div>
            )}
          </div>
        )}

        {viewMode === 'grid' && (
          <div className="flex h-full">
            <div className={`flex-1 overflow-hidden ${selectedDept ? 'pr-80' : ''}`}>
              <GridView
                depts={filteredDepts}
                onSelect={handleNodeClick}
                selectedId={selectedDept?.id ?? null}
              />
            </div>
            {selectedDept && (
              <div className="absolute top-0 right-0 h-full">
                <DetailPanel dept={selectedDept} onClose={() => setSelectedDept(null)} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Restructure Modal */}
      {showRestructureModal && (
        <RestructureModal
          companyId={selectedCompanyId === SENTINEL_ALL ? user.companyId : selectedCompanyId}
          onClose={() => setShowRestructureModal(false)}
          onApplied={() => {
            setShowRestructureModal(false)
            loadTree(selectedCompanyId, snapshotDateStr)
          }}
        />
      )}
    </div>
  )
}
