// ═══════════════════════════════════════════════════════════
// CTR HR Hub — OrgClient (Client Component)
// 조직도: React Flow + Dagre, 부서 상세 패널
// ═══════════════════════════════════════════════════════════

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { apiClient } from '@/lib/api'
import type { SessionUser, RefOption } from '@/types'
import { ROLE } from '@/lib/constants'

// ─── Types ─────────────────────────────────────────────────

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

// ─── Custom Node Component ──────────────────────────────────

function DeptFlowNode({ data }: NodeProps) {
  const { dept, onClick } = data as unknown as DeptNodeData
  const tOrg = useTranslations('org')

  return (
    <div
      className={`
        w-[200px] min-h-[76px] rounded-lg border-2 bg-white cursor-pointer
        flex flex-col items-center justify-center px-3 py-2 shadow-sm
        transition-colors hover:border-ctr-primary hover:shadow-md
        ${dept.isActive ? 'border-ctr-gray-300' : 'border-ctr-gray-200 opacity-60'}
      `}
      onClick={() => onClick(dept)}
    >
      <Handle type="target" position={Position.Top} className="!bg-ctr-primary" />
      <p className="text-sm font-semibold text-ctr-gray-900 text-center line-clamp-2">
        {dept.name}
      </p>
      <p className="text-xs text-ctr-gray-500 mt-1">{tOrg('headcountUnit', { count: dept.employeeCount })}</p>
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
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    }))

  return { nodes, edges }
}

// ─── Inner Flow Canvas (needs ReactFlowProvider context) ────

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
      className="bg-ctr-gray-50"
    >
      <Background color="#e2e8f0" gap={20} />
      <Controls />
    </ReactFlow>
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
    <div className="absolute top-0 right-0 h-full w-80 bg-white border-l border-ctr-gray-200 shadow-lg z-10 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ctr-gray-200 bg-ctr-primary text-white shrink-0">
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
          <h4 className="text-xs font-semibold text-ctr-gray-500 uppercase tracking-wide">
            {t('deptInfo')}
          </h4>
          <div className="bg-ctr-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
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
            <h4 className="text-xs font-semibold text-ctr-gray-500 uppercase tracking-wide">
              {t('subDepartments')} ({dept.children.length})
            </h4>
            <ul className="space-y-1">
              {dept.children.map((child) => (
                <li
                  key={child.id}
                  className="text-sm px-3 py-1.5 bg-ctr-gray-50 rounded flex justify-between"
                >
                  <span className="text-ctr-gray-900">{child.name}</span>
                  <span className="text-ctr-gray-500 text-xs">{t('headcountUnit', { count: child.employeeCount })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Employees */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-ctr-gray-500 uppercase tracking-wide">
            {t('employees')}
          </h4>
          {loadingEmps ? (
            <p className="text-xs text-ctr-gray-500 py-2">{t('loadingData')}</p>
          ) : employees.length === 0 ? (
            <p className="text-xs text-ctr-gray-500 py-2">{t('noEmployees')}</p>
          ) : (
            <ul className="space-y-1">
              {employees.map((emp) => (
                <li
                  key={emp.id}
                  className="text-sm px-3 py-1.5 bg-ctr-gray-50 rounded flex justify-between items-center"
                >
                  <span className="text-ctr-gray-900">{emp.name}</span>
                  <span className="text-ctr-gray-500 text-xs">
                    {emp.jobGrade?.name ?? emp.employeeNo}
                  </span>
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
      <span className="text-ctr-gray-500">{label}</span>
      <span className="text-ctr-gray-900 font-medium">{value}</span>
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

// ─── OrgClient ──────────────────────────────────────────────

interface OrgClientProps {
  user: SessionUser
  companies: RefOption[]
}

export function OrgClient({ user, companies }: OrgClientProps) {
  const t = useTranslations('org')
  const isSuperAdmin = user.role === ROLE.SUPER_ADMIN

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    isSuperAdmin ? SENTINEL_ALL : user.companyId,
  )
  const [tree, setTree] = useState<DeptNode[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDept, setSelectedDept] = useState<DeptNode | null>(null)
  const [snapshotDate, setSnapshotDate] = useState<string>('') // YYYY-MM-DD or empty for live
  const dateInputRef = useRef<HTMLInputElement>(null)

  const loadTree = useCallback(async (companyId: string, date?: string) => {
    setLoading(true)
    setSelectedDept(null)
    try {
      if (date) {
        // Load from snapshot
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
          const depts = snapshots[0].snapshotData.departments
          // Convert flat snapshot to tree
          const snapshotTree = buildSnapshotTree(depts)
          setTree(snapshotTree)
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
    loadTree(selectedCompanyId, snapshotDate || undefined)
  }, [loadTree, selectedCompanyId, snapshotDate])

  const handleNodeClick = useCallback((dept: DeptNode) => {
    setSelectedDept((prev) => (prev?.id === dept.id ? null : dept))
  }, [])

  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => buildFlowElements(tree, handleNodeClick),
    [tree, handleNodeClick],
  )

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-ctr-gray-200 bg-white shrink-0">
        <h1 className="text-lg font-bold text-ctr-gray-900">{t('orgChart')}</h1>

        <div className="flex items-center gap-2 ml-auto">
          {/* Snapshot DatePicker */}
          <input
            ref={dateInputRef}
            type="month"
            value={snapshotDate ? snapshotDate.substring(0, 7) : ''}
            onChange={(e) => {
              if (e.target.value) {
                setSnapshotDate(`${e.target.value}-01`)
              } else {
                setSnapshotDate('')
              }
            }}
            className="text-sm border border-ctr-gray-300 rounded-md px-3 py-1.5 text-ctr-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-ctr-primary"
            style={{ width: 160 }}
          />
          {snapshotDate && (
            <button
              onClick={() => setSnapshotDate('')}
              className="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              {t('current')}
            </button>
          )}

          {isSuperAdmin && (
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="text-sm border border-ctr-gray-300 rounded-md px-3 py-1.5 text-ctr-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-ctr-primary"
            >
              <option value={SENTINEL_ALL}>{t('allCompanies')}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Snapshot mode banner */}
      {snapshotDate && (
        <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm flex items-center gap-2 shrink-0">
          <span className="font-medium">{t('snapshotViewing', { date: snapshotDate })}</span>
          <span className="text-amber-600 text-xs">({t('snapshotData')})</span>
        </div>
      )}

      {/* Flow canvas area */}
      <div className="relative flex-1 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-20">
            <p className="text-sm text-ctr-gray-500">{t('loadingData')}</p>
          </div>
        )}

        {!loading && tree.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-ctr-gray-500">{t('noDepartments')}</p>
          </div>
        )}

        <ReactFlowProvider>
          <FlowCanvas initNodes={initNodes} initEdges={initEdges} />
        </ReactFlowProvider>

        {/* Detail panel */}
        <DetailPanel dept={selectedDept} onClose={() => setSelectedDept(null)} />
      </div>
    </div>
  )
}
