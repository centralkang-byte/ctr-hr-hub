'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — OrgStudioClient
// Organizational Restructure Simulator — Split-View Canvas
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react'
import { GitBranch, Info, Save, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import type { SessionUser } from '@/types'
import { DraggableOrgTree } from '@/components/org-studio/DraggableOrgTree'
import { ImpactAnalysisPanel } from '@/components/org-studio/ImpactAnalysisPanel'
import type { OrgNode, SimulationDiff } from '@/components/org-studio/DraggableOrgTree'

interface OrgStudioClientProps {
  user: SessionUser
}

type SaveState = 'idle' | 'saving' | 'success' | 'error'

// Transform API tree nodes to OrgNode format
interface ApiTreeNode {
  id: string
  name: string
  nameEn: string | null
  code: string
  level: number
  employeeCount: number
  children: ApiTreeNode[]
}

function apiNodeToOrgNode(node: ApiTreeNode): OrgNode {
  const headcount = node.employeeCount
  return {
    id: node.id,
    name: node.nameEn ? `${node.name} (${node.nameEn})` : node.name,
    manager: '', // Position manager data not in tree API — blank for now
    headcount,
    estSalaryCost: headcount * 5_500_000, // Rough estimate: 5.5M KRW avg monthly per employee
    level: node.level,
    children: node.children?.map(apiNodeToOrgNode),
  }
}

export function OrgStudioClient({ user }: OrgStudioClientProps) {
  const [tree, setTree] = useState<OrgNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [diff, setDiff] = useState<SimulationDiff>({
    headcountChange: 0,
    costChange: 0,
    deptCountChange: 0,
    moves: [],
  })
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  // Compute baseline from tree
  const baseline = useMemo(() => {
    function count(nodes: OrgNode[]): { headcount: number; cost: number; depts: number } {
      let headcount = 0, cost = 0, depts = 0
      for (const n of nodes) {
        headcount += n.headcount
        cost += n.estSalaryCost
        depts++
        if (n.children) {
          const sub = count(n.children)
          headcount += sub.headcount
          cost += sub.cost
          depts += sub.depts
        }
      }
      return { headcount, cost, depts }
    }
    const totals = count(tree)
    return { totalHeadcount: totals.headcount, totalMonthlyCost: totals.cost, departmentCount: totals.depts }
  }, [tree])

  // Fetch real org tree from API
  useEffect(() => {
    async function fetchTree() {
      try {
        setLoading(true)
        // SUPER_ADMIN sees all companies; others see their own
        const res = await fetch('/api/v1/org/tree')
        if (!res.ok) throw new Error('조직 트리를 불러올 수 없습니다.')
        const data = await res.json() as { data: { tree: ApiTreeNode[] } }
        const orgNodes = data.data.tree.map(apiNodeToOrgNode)
        setTree(orgNodes)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류')
        setTree([])
      } finally {
        setLoading(false)
      }
    }
    fetchTree()
  }, [])

  const hasMoves = diff.moves.length > 0

  async function handleSavePlan() {
    if (!hasMoves) return
    setSaveState('saving')
    setSaveError(null)

    try {
      const payload = {
        companyId: user.companyId,
        title: `조직 개편 시뮬레이션 — ${new Date().toLocaleDateString('ko-KR')}`,
        description: `${diff.moves.length}개 부서 이동: ${diff.moves.map((m) => `${m.nodeName}(${m.fromParentName}→${m.toParentName})`).join(', ')}`,
        effectiveDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
        changes: diff.moves.map((m) => ({
          type: 'move',
          nodeId: m.nodeId,
          nodeName: m.nodeName,
          fromParentId: m.fromParentId,
          fromParentName: m.fromParentName,
          toParentId: m.toParentId,
          toParentName: m.toParentName,
          headcount: m.headcount,
          estSalaryCost: m.estSalaryCost,
        })),
        status: 'draft',
      }

      const res = await fetch('/api/v1/org/restructure-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message ?? '저장에 실패했습니다.')
      }

      setSaveState('success')
      setTimeout(() => setSaveState('idle'), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 4000)
    }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-muted">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-border bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <GitBranch size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Org Studio</h1>
            <p className="text-xs text-muted-foreground">
              조직 개편 시뮬레이터 — 드래그하여 부서를 재배치하세요
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Simulation mode badge */}
          <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5">
            <Info size={13} className="text-primary" />
            <span className="text-xs font-medium text-primary">
              시뮬레이션 모드 — 저장 전까지 실제 반영 안 됨
            </span>
          </div>

          {/* Save status feedback */}
          {saveState === 'success' && (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5">
              <CheckCircle2 size={13} className="text-emerald-700" />
              <span className="text-xs font-medium text-emerald-700">초안으로 저장됨</span>
            </div>
          )}
          {saveState === 'error' && saveError && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5">
              <AlertCircle size={13} className="text-red-700" />
              <span className="text-xs font-medium text-red-700">{saveError}</span>
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSavePlan}
            disabled={!hasMoves || saveState === 'saving'}
            className={[
              'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              hasMoves && saveState !== 'saving'
                ? 'bg-primary text-white hover:bg-primary/90'
                : 'cursor-not-allowed bg-border text-[#999]',
            ].join(' ')}
          >
            {saveState === 'saving' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {saveState === 'saving' ? '저장 중...' : '시뮬레이션 플랜 저장'}
            {hasMoves && saveState === 'idle' && (
              <span className="ml-0.5 rounded-full bg-white/30 px-1.5 py-0.5 text-[10px] font-bold">
                {diff.moves.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Split-View Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Tree Canvas (70%) */}
        <div className="flex-[7] overflow-y-auto p-6">
          {loading ? (
            <TableSkeleton rows={8} />
          ) : error ? (
            <EmptyState title="조직 트리 로딩 실패" description={error} />
          ) : tree.length === 0 ? (
            <EmptyState title="조직 데이터 없음" description="부서 데이터가 아직 생성되지 않았습니다." />
          ) : (
            <DraggableOrgTree
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
              onDiffChange={setDiff}
              tree={tree}
              onTreeChange={setTree}
            />
          )}
        </div>

        {/* Right: Impact Analysis Panel (30%) */}
        <div className="flex-[3] overflow-y-auto border-l border-border bg-white">
          <ImpactAnalysisPanel diff={diff} selectedNode={selectedNode} baseline={baseline} />
        </div>
      </div>
    </div>
  )
}
