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
  type NodeProps,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import { GitBranch, LayoutGrid, List, Network, Search } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser, RefOption } from '@/types'
import { ROLE } from '@/lib/constants'
import { EffectiveDatePicker } from '@/components/shared/EffectiveDatePicker'
import { RestructureModal } from '@/components/org/RestructureModal'

// ─── Types ─────────────────────────────────────────────────

type ViewMode = 'tree' | 'list' | 'grid'

type DeptNode = {
  id: string
  name: string
  nameEn: string | null
  code: string
  level: number
  sortOrder: number
  isActive: boolean
  parentId: string | null
  employeeCount: number
  children: DeptNode[]
}

type DeptNodeData = {
  dept: DeptNode
  onClick: (dept: DeptNode) => void
}

type EmployeeRow = {
  id: string
  name: string
  employeeNo: string
  jobGrade?: { name: string } | null
}

// ─── Constants ─────────────────────────────────────────────

const NODE_W = 200
const NODE_H = 76
const SENTINEL_ALL = '__ALL__'

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

// ─── Custom Node Component ──────────────────────────────────

function DeptFlowNode({ data }: NodeProps) {
  const { dept, onClick } = data as unknown as DeptNodeData
  const tOrg = useTranslations('org')

  return (
    <div
      className={`
        w-[200px] min-h-[76px] rounded-xl border bg-white cursor-pointer
        flex flex-col items-center justify-center px-3 py-3 shadow-none
        transition-colors hover:border-ctr-primary
        ${dept.isActive ? 'border-[#E8E8E8]' : 'border-[#E8E8E8] opacity-60'}
      `}
      onClick={() => onClick(dept)}
    >
      <Handle type="target" position={Position.Top} className="!bg-ctr-primary" />
      <p className="text-sm font-bold text-[#1A1A1A] text-center line-clamp-2">
        {dept.name}
      </p>
      <p className="text-xs text-[#999] mt-1">{tOrg('headcountUnit', { count: dept.employeeCount })}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-ctr-primary" />
    </div>
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

function buildFlowElements(
  tree: DeptNode[],
  onNodeClick: (dept: DeptNode) => void,
): { nodes: Node[]; edges: Edge[] } {
  if (tree.length === 0) return { nodes: [], edges: [] }

  const flat = flattenTree(tree)

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', ranksep: 40, nodesep: 20 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const dept of flat) {
    g.setNode(dept.id, { width: NODE_W, height: NODE_H })
  }
  for (const dept of flat) {
    if (dept.parentId) {
      g.setEdge(dept.parentId, dept.id)
    }
  }

  dagre.layout(g)

  const nodes: Node[] = flat.map((dept) => {
    const pos = g.node(dept.id)
    return {
      id: dept.id,
      type: 'deptNode',
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      data: { dept, onClick: onNodeClick } as Record<string, unknown>,
    }
  })

  const edges: Edge[] = flat
    .filter((dept) => dept.parentId)
    .map((dept) => ({
      id: `e-${dept.parentId}-${dept.id}`,
      source: dept.parentId!,
      target: dept.id,
      type: 'smoothstep',
      style: { stroke: '#E8E8E8', strokeWidth: 1.5 },
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
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50)
  }, [initNodes, initEdges, setNodes, setEdges, fitView])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.2}
      maxZoom={2}
      className="bg-[#FAFAFA]"
    >
      <Background color="#E8E8E8" gap={20} />
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
        <p className="text-sm text-[#999]">{tOrg('noDepartments')}</p>
      </div>
    )
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#FAFAFA] border-b border-[#E8E8E8]">
            <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tOrg('code')}</th>
            <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tOrg('name')}</th>
            <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tOrg('level')}</th>
            <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tOrg('headcount')}</th>
            <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tOrg('status')}</th>
          </tr>
        </thead>
        <tbody>
          {depts.map((dept) => (
            <tr
              key={dept.id}
              onClick={() => onSelect(dept)}
              className={`border-b border-[#F5F5F5] cursor-pointer hover:bg-[#FAFAFA] transition-colors ${
                selectedId === dept.id ? 'bg-[#E8F5E9]' : ''
              }`}
            >
              <td className="px-4 py-3 font-mono text-xs text-[#666]">{dept.code}</td>
              <td className="px-4 py-3 font-medium text-[#1A1A1A]" style={{ paddingLeft: `${1 + dept.level * 1.5}rem` }}>
                {dept.level > 0 && <span className="text-[#CCC] mr-1">{'└'}</span>}
                {dept.name}
              </td>
              <td className="px-4 py-3 text-[#666]">{dept.level + 1}</td>
              <td className="px-4 py-3 text-[#1A1A1A]">{tOrg('headcountUnit', { count: dept.employeeCount })}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  dept.isActive
                    ? 'bg-[#D1FAE5] text-[#047857]'
                    : 'bg-[#FAFAFA] text-[#999] border border-[#E8E8E8]'
                }`}>
                  {dept.isActive ? tc('active') : tc('inactive')}
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
        <p className="text-sm text-[#999]">{tOrg('noDepartments')}</p>
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
            className={`text-left rounded-xl border p-4 transition-all hover:border-ctr-primary hover:shadow-sm ${
              selectedId === dept.id
                ? 'border-ctr-primary bg-[#E8F5E9] shadow-sm'
                : 'border-[#E8E8E8] bg-white'
            } ${!dept.isActive ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-[10px] font-mono text-[#999] bg-[#FAFAFA] px-1.5 py-0.5 rounded">{dept.code}</span>
              {!dept.isActive && (
                <span className="text-[10px] text-[#999]">{tc('inactive')}</span>
              )}
            </div>
            <p className="text-sm font-semibold text-[#1A1A1A] line-clamp-2 mb-1">{dept.name}</p>
            {dept.nameEn && (
              <p className="text-xs text-[#999] line-clamp-1 mb-2">{dept.nameEn}</p>
            )}
            <p className="text-xs text-[#00C853] font-medium">
              {tOrg('headcountUnit', { count: dept.employeeCount })}
            </p>
            {dept.children.length > 0 && (
              <p className="text-xs text-[#999] mt-1">
                {tOrg('subDepartments')} {dept.children.length}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Detail Panel ───────────────────────────────────────────

interface DetailPanelProps {
  dept: DeptNode | null
  onClose: () => void
}

function DetailPanel({ dept, onClose }: DetailPanelProps) {
  const t = useTranslations('org')
  const tc = useTranslations('common')
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [loadingEmps, setLoadingEmps] = useState(false)

  useEffect(() => {
    if (!dept) return
    setLoadingEmps(true)
    apiClient
      .getList<EmployeeRow>('/api/v1/employees', {
        departmentId: dept.id,
        limit: 50,
      })
      .then((res) => setEmployees(res.data))
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmps(false))
  }, [dept])

  if (!dept) return null

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-white border-l border-[#E8E8E8] shadow-lg z-10 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8E8] bg-ctr-primary text-white shrink-0">
        <h3 className="font-semibold text-sm truncate">{dept.name}</h3>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white text-lg leading-none ml-2"
          aria-label={t('close')}
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Dept Info */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[#999]">{t('deptInfo')}</h4>
          <div className="bg-[#FAFAFA] rounded-lg p-3 space-y-1.5 text-sm">
            <InfoRow label={t('code')} value={dept.code} />
            <InfoRow label={t('level')} value={String(dept.level)} />
            <InfoRow label={t('status')} value={dept.isActive ? tc('active') : tc('inactive')} />
            <InfoRow label={t('headcount')} value={t('headcountUnit', { count: dept.employeeCount })} />
            {dept.nameEn && <InfoRow label={t('nameEn')} value={dept.nameEn} />}
          </div>
        </div>

        {/* Sub-departments */}
        {dept.children.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-[#999]">
              {t('subDepartments')} ({dept.children.length})
            </h4>
            <ul className="space-y-1">
              {dept.children.map((child) => (
                <li key={child.id} className="text-sm px-3 py-1.5 bg-[#FAFAFA] rounded flex justify-between">
                  <span className="text-[#1A1A1A]">{child.name}</span>
                  <span className="text-[#999] text-xs">{t('headcountUnit', { count: child.employeeCount })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Employees */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[#999]">{t('employees')}</h4>
          {loadingEmps ? (
            <p className="text-xs text-[#999] py-2">{t('loadingData')}</p>
          ) : employees.length === 0 ? (
            <p className="text-xs text-[#999] py-2">{t('noEmployees')}</p>
          ) : (
            <ul className="space-y-1">
              {employees.map((emp) => (
                <li key={emp.id} className="text-sm px-3 py-1.5 bg-[#FAFAFA] rounded flex justify-between items-center">
                  <span className="text-[#1A1A1A]">{emp.name}</span>
                  <span className="text-[#999] text-xs">{emp.jobGrade?.name ?? emp.employeeNo}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#999]">{label}</span>
      <span className="text-[#1A1A1A] font-medium">{value}</span>
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
      isActive: true,
      parentId: d.parentId,
      employeeCount: d.headcount,
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
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-[#00C853] text-white'
          : 'bg-white border border-[#D4D4D4] text-[#555] hover:bg-[#FAFAFA]'
      }`}
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
    setSelectedDept((prev) => (prev?.id === dept.id ? null : dept))
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

  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => buildFlowElements(tree, handleNodeClick),
    [tree, handleNodeClick],
  )

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
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-[#E8E8E8] bg-white shrink-0">
        <h1 className="text-lg font-bold text-[#1A1A1A] tracking-ctr mr-2">{t('orgChart')}</h1>

        {/* View mode toggle */}
        <div className="flex items-center gap-1">
          <ViewModeButton
            mode="tree"
            current={viewMode}
            icon={<Network size={14} />}
            label={t('viewTree')}
            onClick={() => setViewMode('tree')}
          />
          <ViewModeButton
            mode="list"
            current={viewMode}
            icon={<List size={14} />}
            label={t('viewList')}
            onClick={() => setViewMode('list')}
          />
          <ViewModeButton
            mode="grid"
            current={viewMode}
            icon={<LayoutGrid size={14} />}
            label={t('viewGrid')}
            onClick={() => setViewMode('grid')}
          />
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#999]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchDepts')}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-[#D4D4D4] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#00C853]/10 placeholder:text-[#999]"
          />
        </div>

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
              className="text-sm px-3 py-1.5 rounded-lg bg-[#00C853] text-white hover:bg-[#00A844] transition-colors"
            >
              {t('current')}
            </button>
          )}

          {/* Company selector (SUPER_ADMIN only) */}
          {isSuperAdmin && (
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="text-sm border border-[#D4D4D4] rounded-lg px-3 py-1.5 text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#00C853]/10"
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
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#00C853] hover:bg-[#00A844] text-white text-sm font-medium transition-colors"
            >
              <GitBranch size={14} />
              {t('restructure')}
            </button>
          )}
        </div>
      </div>

      {/* Snapshot mode banner */}
      {isSnapshot && (
        <div className="px-6 py-2 bg-[#FEF3C7] border-b border-[#FCD34D] text-[#92400E] text-sm flex items-center gap-2 shrink-0">
          <span className="font-medium">{t('snapshotViewing', { date: snapshotDateStr ?? '' })}</span>
          <span className="text-[#D97706] text-xs">({t('snapshotData')})</span>
        </div>
      )}

      {/* Search result count */}
      {search.trim() && (
        <div className="px-6 py-1.5 bg-[#F0FDF4] border-b border-[#BBF7D0] text-[#15803D] text-xs">
          {t('searchResult', { count: filteredDepts.length })}
        </div>
      )}

      {/* Main content area */}
      <div className="relative flex-1 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-20">
            <p className="text-sm text-[#999]">{t('loadingData')}</p>
          </div>
        )}

        {!loading && tree.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-[#999]">{t('noDepartments')}</p>
          </div>
        )}

        {viewMode === 'tree' && (
          <>
            <ReactFlowProvider>
              <FlowCanvas initNodes={filteredTreeNodes} initEdges={initEdges} />
            </ReactFlowProvider>
            <DetailPanel dept={selectedDept} onClose={() => setSelectedDept(null)} />
          </>
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
