'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — ImpactAnalysisPanel
// Right-side panel showing restructure simulation metrics
// ═══════════════════════════════════════════════════════════

import { Users, DollarSign, Building2, TrendingUp, ArrowRight, Minus, Info } from 'lucide-react'
import type { OrgNode, SimulationDiff } from './DraggableOrgTree'

interface ImpactAnalysisPanelProps {
  diff: SimulationDiff
  selectedNode: OrgNode | null
}

// ─── Baseline snapshot (mock) ────────────────────────────────

const BASELINE = {
  totalHeadcount: 109,
  totalMonthlyCost: 872_000_000, // KRW
  departmentCount: 12,
}

function formatKRW(amount: number): string {
  if (Math.abs(amount) >= 100_000_000) return `${(amount / 100_000_000).toFixed(1)}억원`
  if (Math.abs(amount) >= 10_000) return `${(amount / 10_000).toFixed(0)}만원`
  return `${amount.toLocaleString()}원`
}

// ─── Metric Card ─────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent?: string
}

function MetricCard({ icon, label, value, sub, accent = '#5E81F4' }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-[#F0F0F3] bg-[#F5F5FA] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span style={{ color: accent }}>{icon}</span>
        <p className="text-xs font-medium text-[#8181A5]">{label}</p>
      </div>
      <p className="text-2xl font-bold text-[#1C1D21]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[#8181A5]">{sub}</p>}
    </div>
  )
}

// ─── ImpactAnalysisPanel ─────────────────────────────────────

export function ImpactAnalysisPanel({ diff, selectedNode }: ImpactAnalysisPanelProps) {
  const currentHeadcount = BASELINE.totalHeadcount + diff.headcountChange
  const currentCost = BASELINE.totalMonthlyCost + diff.costChange
  const currentDepts = BASELINE.departmentCount + diff.deptCountChange
  const hasMoves = diff.moves.length > 0

  return (
    <div className="flex h-full flex-col">
      {/* Panel Header */}
      <div className="border-b border-[#F0F0F3] px-5 py-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-[#5E81F4]" />
          <h2 className="text-sm font-bold text-[#1C1D21]">영향 분석</h2>
        </div>
        <p className="mt-0.5 text-xs text-[#8181A5]">개편 전·후 예측 변화량</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 p-5">
        {/* Current Snapshot Metrics */}
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8181A5]">
            현재 현황
          </p>
          <div className="space-y-2">
            <MetricCard
              icon={<Users size={15} />}
              label="총 인원"
              value={`${currentHeadcount.toLocaleString()}명`}
              sub="전체 법인 합산"
              accent="#5E81F4"
            />
            <MetricCard
              icon={<DollarSign size={15} />}
              label="월 인건비 추정"
              value={formatKRW(currentCost)}
              sub="추정 기준 (세전)"
              accent="#059669"
            />
            <MetricCard
              icon={<Building2 size={15} />}
              label="부서 수"
              value={`${currentDepts}개`}
              sub="팀 단위 포함"
              accent="#F59E0B"
            />
          </div>
        </section>

        {/* Diff Section — Move Actions */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8181A5]">
              개편 변경 내역
            </p>
            {hasMoves && (
              <span className="rounded-full bg-[#00C853]/10 px-2 py-0.5 text-[11px] font-semibold text-[#00A844]">
                {diff.moves.length}건
              </span>
            )}
          </div>

          {hasMoves ? (
            <div className="space-y-2">
              {diff.moves.map((move, idx) => (
                <div
                  key={`${move.nodeId}-${idx}`}
                  className="rounded-xl border border-[#F0F0F3] bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-[#1C1D21] leading-tight">
                      {move.nodeName}
                    </p>
                    <span className="flex-shrink-0 rounded-full bg-[#F5F5FA] px-1.5 py-0.5 text-[11px] font-medium text-[#8181A5]">
                      {move.headcount}명
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="truncate rounded bg-[#FEF3C7] px-1.5 py-0.5 text-[11px] text-[#B45309]">
                      {move.fromParentName}
                    </span>
                    <ArrowRight size={11} className="flex-shrink-0 text-[#8181A5]" />
                    <span className="truncate rounded bg-[#D1FAE5] px-1.5 py-0.5 text-[11px] text-[#047857]">
                      {move.toParentName}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#8181A5]">
                    월 인건비 {formatKRW(move.estSalaryCost)} 이동
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-[#F0F0F3] bg-white divide-y divide-[#F0F0F3]">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-[#8181A5]" />
                  <span className="text-sm text-[#1C1D21]">인원 변화</span>
                </div>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[#F5F5FA] px-2 py-0.5 text-xs font-semibold text-[#8181A5]">
                  <Minus size={10} />
                  변화 없음
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <DollarSign size={14} className="text-[#8181A5]" />
                  <span className="text-sm text-[#1C1D21]">비용 변화</span>
                </div>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[#F5F5FA] px-2 py-0.5 text-xs font-semibold text-[#8181A5]">
                  <Minus size={10} />
                  변화 없음
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-[#8181A5]" />
                  <span className="text-sm text-[#1C1D21]">부서 수 변화</span>
                </div>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[#F5F5FA] px-2 py-0.5 text-xs font-semibold text-[#8181A5]">
                  <Minus size={10} />
                  변화 없음
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Selected Node Detail */}
        {selectedNode ? (
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8181A5]">
              선택된 부서
            </p>
            <div className="rounded-xl border border-[#5E81F4]/30 bg-[#5E81F4]/5 p-4">
              <p className="text-sm font-bold text-[#1C1D21]">{selectedNode.name}</p>
              <p className="mt-0.5 text-xs text-[#8181A5]">{selectedNode.manager}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-[#F0F0F3] bg-white px-3 py-2">
                  <p className="text-[10px] text-[#8181A5]">인원</p>
                  <p className="text-sm font-bold text-[#1C1D21]">{selectedNode.headcount}명</p>
                </div>
                <div className="rounded-lg border border-[#F0F0F3] bg-white px-3 py-2">
                  <p className="text-[10px] text-[#8181A5]">월 인건비</p>
                  <p className="text-sm font-bold text-[#1C1D21]">
                    {formatKRW(selectedNode.estSalaryCost)}
                  </p>
                </div>
              </div>
              {selectedNode.children && (
                <p className="mt-2 text-xs text-[#8181A5]">
                  하위 팀 {selectedNode.children.length}개
                </p>
              )}
            </div>
          </section>
        ) : (
          <section>
            <div className="flex items-start gap-2 rounded-xl border border-dashed border-[#F0F0F3] p-4">
              <Info size={14} className="mt-0.5 flex-shrink-0 text-[#8181A5]" />
              <p className="text-xs text-[#8181A5]">
                트리에서 부서를 클릭하면 상세 정보를 확인할 수 있습니다.
                드래그 핸들을 잡고 다른 부서 위에 놓으면 이동됩니다.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
