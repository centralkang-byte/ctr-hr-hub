// ═══════════════════════════════════════════════════════════
// CTR HR Hub — RestructureDiffView
// B8-1 Task 5: 조직 개편 영향도 분석 + Diff 비교 뷰
// ═══════════════════════════════════════════════════════════

'use client'

import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, Users, Building2, ArrowRight } from 'lucide-react'
import type { OrgChange, RestructurePlanDraft } from './RestructureModal'

// ─── Types ──────────────────────────────────────────────────

interface DeptOption {
  id: string
  name: string
  code: string
  level: number
  parentId: string | null
  employeeCount: number
}

interface EmployeeOption {
  id: string
  name: string
  employeeNo: string
  departmentId: string | null
}

interface DiffLine {
  changeId: string
  type: 'add' | 'remove' | 'modify' | 'move'
  label: string
  detail: string
  affectedCount: number
  warning?: string
}

interface RestructureDiffViewProps {
  plan: RestructurePlanDraft
  depts: DeptOption[]
  employees: EmployeeOption[]
}

// ─── Helpers ────────────────────────────────────────────────

const CHANGE_TYPE_LABELS: Record<string, string> = {
  create: '부서 신설',
  move: '부서 이동',
  merge: '부서 통합',
  rename: '부서 명칭 변경',
  close: '부서 폐지',
  transfer_employee: '인원 이동',
}

function getDeptName(id: string | undefined | null, depts: DeptOption[]): string {
  if (!id) return '—'
  return depts.find((d) => d.id === id)?.name ?? id
}

function getDeptCount(id: string | undefined | null, depts: DeptOption[]): number {
  if (!id) return 0
  return depts.find((d) => d.id === id)?.employeeCount ?? 0
}

function getEmployeeName(id: string | undefined | null, employees: EmployeeOption[]): string {
  if (!id) return '—'
  const e = employees.find((e) => e.id === id)
  return e ? `${e.name} (${e.employeeNo})` : id
}

// Build diff lines from changes
function buildDiffLines(
  changes: OrgChange[],
  depts: DeptOption[],
  employees: EmployeeOption[],
): DiffLine[] {
  return changes.map((change) => {
    switch (change.type) {
      case 'create': {
        const parentName = getDeptName(change.newDeptParentId, depts)
        return {
          changeId: change.id,
          type: 'add',
          label: `[신설] ${change.newDeptName || '(미입력)'}`,
          detail: `코드: ${change.newDeptCode || '—'}  /  상위: ${parentName}`,
          affectedCount: 0,
        }
      }
      case 'move': {
        const deptName = getDeptName(change.deptId, depts)
        const targetName = getDeptName(change.targetParentId, depts)
        const count = getDeptCount(change.deptId, depts)
        return {
          changeId: change.id,
          type: 'move',
          label: `[이동] ${deptName}`,
          detail: `현재 상위 → ${targetName}`,
          affectedCount: count,
        }
      }
      case 'merge': {
        const sourceName = getDeptName(change.sourceDeptId, depts)
        const targetName = getDeptName(change.targetDeptId, depts)
        const sourceCount = getDeptCount(change.sourceDeptId, depts)
        const targetCount = getDeptCount(change.targetDeptId, depts)
        return {
          changeId: change.id,
          type: 'remove',
          label: `[통합] ${sourceName} → ${targetName}`,
          detail: `인원 ${sourceCount}명이 ${targetName}(${targetCount}명)에 편입`,
          affectedCount: sourceCount,
          warning: sourceCount > 0 ? `${sourceName} 소속 ${sourceCount}명의 Assignment가 변경됩니다.` : undefined,
        }
      }
      case 'rename': {
        const deptName = getDeptName(change.renameDeptId, depts)
        return {
          changeId: change.id,
          type: 'modify',
          label: `[명칭 변경] ${deptName}`,
          detail: `"${deptName}" → "${change.newName || '(미입력)'}"`,
          affectedCount: getDeptCount(change.renameDeptId, depts),
        }
      }
      case 'close': {
        const deptName = getDeptName(change.closeDeptId, depts)
        const count = getDeptCount(change.closeDeptId, depts)
        return {
          changeId: change.id,
          type: 'remove',
          label: `[폐지] ${deptName}`,
          detail: `소속 인원 ${count}명 → 상위 부서로 자동 이동`,
          affectedCount: count,
          warning: count > 0 ? `${count}명의 부서 Assignment가 재배치됩니다.` : undefined,
        }
      }
      case 'transfer_employee': {
        const empName = getEmployeeName(change.employeeId, employees)
        const fromName = getDeptName(change.fromDeptId, depts)
        const toName = getDeptName(change.toDeptId, depts)
        return {
          changeId: change.id,
          type: 'move',
          label: `[인원 이동] ${empName}`,
          detail: `${fromName} → ${toName}`,
          affectedCount: 1,
        }
      }
      default:
        return {
          changeId: change.id,
          type: 'modify' as const,
          label: `[${CHANGE_TYPE_LABELS[change.type] ?? change.type}]`,
          detail: '—',
          affectedCount: 0,
        }
    }
  })
}

// ─── Diff Row ───────────────────────────────────────────────

function DiffRow({ line }: { line: DiffLine }) {
  const typeConfig = {
    add: { bg: 'bg-[#F0FDF4]', border: 'border-l-[#00C853]', icon: <CheckCircle2 size={14} className="text-[#00C853]" />, badge: 'bg-[#D1FAE5] text-[#047857]', badgeText: '추가' },
    remove: { bg: 'bg-[#FFF5F5]', border: 'border-l-[#EF4444]', icon: <AlertTriangle size={14} className="text-[#EF4444]" />, badge: 'bg-[#FEE2E2] text-[#B91C1C]', badgeText: '제거' },
    modify: { bg: 'bg-[#FFFBEB]', border: 'border-l-[#F59E0B]', icon: <Building2 size={14} className="text-[#F59E0B]" />, badge: 'bg-[#FEF3C7] text-[#B45309]', badgeText: '변경' },
    move: { bg: 'bg-[#EFF6FF]', border: 'border-l-[#3B82F6]', icon: <ArrowRight size={14} className="text-[#3B82F6]" />, badge: 'bg-[#DBEAFE] text-[#1D4ED8]', badgeText: '이동' },
  }[line.type]

  return (
    <div className={`${typeConfig.bg} border-l-4 ${typeConfig.border} rounded-r-lg px-4 py-3 space-y-1`}>
      <div className="flex items-center gap-2">
        {typeConfig.icon}
        <span className="text-sm font-medium text-[#1A1A1A]">{line.label}</span>
        <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.badge}`}>
          {typeConfig.badgeText}
        </span>
      </div>
      <p className="text-xs text-[#555] pl-5">{line.detail}</p>
      {line.affectedCount > 0 && (
        <p className="text-xs text-[#666] pl-5 flex items-center gap-1">
          <Users size={11} /> 영향 인원: {line.affectedCount}명
        </p>
      )}
      {line.warning && (
        <p className="text-xs text-[#B45309] pl-5 flex items-center gap-1 mt-1">
          <AlertTriangle size={11} /> {line.warning}
        </p>
      )}
    </div>
  )
}

// ─── RestructureDiffView ────────────────────────────────────

export function RestructureDiffView({ plan, depts, employees }: RestructureDiffViewProps) {
  const diffLines = useMemo(
    () => buildDiffLines(plan.changes, depts, employees),
    [plan.changes, depts, employees],
  )

  const totalAffected = useMemo(
    () => diffLines.reduce((sum, l) => sum + l.affectedCount, 0),
    [diffLines],
  )

  const warnings = useMemo(() => diffLines.filter((l) => l.warning), [diffLines])

  const addCount = diffLines.filter((l) => l.type === 'add').length
  const removeCount = diffLines.filter((l) => l.type === 'remove').length
  const modifyCount = diffLines.filter((l) => l.type === 'modify').length
  const moveCount = diffLines.filter((l) => l.type === 'move').length

  return (
    <div className="p-6 space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-[#00C853]">{addCount}</p>
          <p className="text-xs text-[#555] mt-0.5">신설</p>
        </div>
        <div className="bg-[#FFF5F5] border border-[#FECACA] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-[#EF4444]">{removeCount}</p>
          <p className="text-xs text-[#555] mt-0.5">제거</p>
        </div>
        <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-[#F59E0B]">{modifyCount}</p>
          <p className="text-xs text-[#555] mt-0.5">변경</p>
        </div>
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-[#3B82F6]">{moveCount}</p>
          <p className="text-xs text-[#555] mt-0.5">이동</p>
        </div>
      </div>

      {/* Impact summary */}
      <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-4 flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-[#555]">
          <Users size={16} className="text-[#666]" />
          <span>총 영향 인원:</span>
          <span className="font-bold text-[#1A1A1A]">{totalAffected}명</span>
        </div>
        <div className="w-px h-4 bg-[#E8E8E8]" />
        <div className="flex items-center gap-2 text-sm text-[#555]">
          <Building2 size={16} className="text-[#666]" />
          <span>변경 항목:</span>
          <span className="font-bold text-[#1A1A1A]">{plan.changes.length}건</span>
        </div>
        <div className="w-px h-4 bg-[#E8E8E8]" />
        <div className="flex items-center gap-2 text-sm text-[#555]">
          <span>발효일:</span>
          <span className="font-bold text-[#1A1A1A]">{plan.effectiveDate.toLocaleDateString('ko-KR')}</span>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-[#FEF3C7] border border-[#FCD34D] rounded-xl p-4 space-y-1">
          <p className="text-xs font-semibold text-[#92400E] flex items-center gap-1.5 mb-2">
            <AlertTriangle size={13} />
            주의 필요 ({warnings.length}건)
          </p>
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-[#B45309]">• {w.warning}</p>
          ))}
        </div>
      )}

      {/* Diff lines */}
      <div>
        <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">변경 사항 상세</h3>
        <div className="space-y-2">
          {diffLines.map((line) => (
            <DiffRow key={line.changeId} line={line} />
          ))}
          {diffLines.length === 0 && (
            <p className="text-sm text-[#999] text-center py-8">변경 사항이 없습니다.</p>
          )}
        </div>
      </div>

      {/* Before / After preview (dept count) */}
      <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">부서 수 변화 예측</h3>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-[#1A1A1A]">{depts.length}</p>
            <p className="text-xs text-[#999] mt-0.5">현재</p>
          </div>
          <ArrowRight size={20} className="text-[#999]" />
          <div className="text-center">
            <p className="text-3xl font-bold text-[#00C853]">
              {depts.length + addCount - removeCount}
            </p>
            <p className="text-xs text-[#999] mt-0.5">개편 후 예상</p>
          </div>
          <div className="ml-auto text-xs text-[#666]">
            {addCount > 0 && <span className="text-[#00C853]">+{addCount} 신설 </span>}
            {removeCount > 0 && <span className="text-[#EF4444]">-{removeCount} 폐지/통합</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
