'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 시나리오 비교 뷰
// Unified Table: 항목(행) × 시나리오(열) + 차이 열
// ═══════════════════════════════════════════════════════════

import { X, GitCompareArrows } from 'lucide-react'
import { CARD_STYLES, TABLE_STYLES } from '@/lib/styles'
import { cn } from '@/lib/utils'
import type { ScenarioDetail, SaveableMode } from './types'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  left: ScenarioDetail
  right: ScenarioDetail
  onClose: () => void
}

// ─── Formatters ─────────────────────────────────────────────

const fmtKRW = (n: number) => `₩${Math.abs(n).toLocaleString('ko-KR')}`
const signedKRW = (n: number) => n === 0 ? '₩0' : `${n > 0 ? '+' : '-'}${fmtKRW(n)}`
const pctStr = (r: number) => `${r >= 0 ? '+' : ''}${(r * 100).toFixed(1)}%`
const fmtDate = (d: string) => new Date(d).toLocaleDateString('ko-KR', {
  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
})

function diffColor(n: number) {
  if (n > 0) return 'text-primary'
  if (n < 0) return 'text-red-600'
  return 'text-[#8181A5]'
}

const MODE_LABELS: Record<SaveableMode, string> = {
  SINGLE: '개별 시뮬레이션',
  BULK: '일괄 시뮬레이션',
  DIFFERENTIAL: '차등 인상',
  HIRING: '채용 시뮬레이션',
  FX: '환율 시뮬레이션',
}

// ─── Helpers ────────────────────────────────────────────────

interface CompareRow {
  label: string
  leftVal: number
  rightVal: number
  format?: 'krw' | 'pct' | 'count'
  bold?: boolean
}

function CompareTable({ rows }: { rows: CompareRow[] }) {
  const fmt = (n: number, f?: string) => {
    if (f === 'pct') return pctStr(n)
    if (f === 'count') return n.toLocaleString('ko-KR')
    return fmtKRW(n)
  }

  return (
    <div className={TABLE_STYLES.wrapper}>
      <table className={TABLE_STYLES.table}>
        <thead>
          <tr className={TABLE_STYLES.header}>
            <th className={TABLE_STYLES.headerCell}>항목</th>
            <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>시나리오 A</th>
            <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>시나리오 B</th>
            <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>차이</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const diff = r.rightVal - r.leftVal
            return (
              <tr key={i} className={cn(TABLE_STYLES.row, r.bold && 'bg-[#FAFAFA] font-semibold')}>
                <td className={TABLE_STYLES.cell}>{r.label}</td>
                <td className={cn(TABLE_STYLES.cell, 'text-right font-mono tabular-nums')}>{fmt(r.leftVal, r.format)}</td>
                <td className={cn(TABLE_STYLES.cell, 'text-right font-mono tabular-nums')}>{fmt(r.rightVal, r.format)}</td>
                <td className={cn(TABLE_STYLES.cell, 'text-right font-mono tabular-nums', diffColor(diff))}>
                  {r.format === 'pct' ? pctStr(diff) : r.format === 'count' ? diff.toLocaleString('ko-KR') : signedKRW(diff)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Mode-specific Renderers ────────────────────────────────

function CompareSingleBulk({ left, right }: { left: ScenarioDetail; right: ScenarioDetail }) {
  const lTotals = (left.results as { summary?: { totals?: Record<string, number> } })?.summary?.totals ?? {}
  const rTotals = (right.results as { summary?: { totals?: Record<string, number> } })?.summary?.totals ?? {}

  const rows: CompareRow[] = [
    { label: '현재 총 지급액', leftVal: lTotals.currentGross ?? 0, rightVal: rTotals.currentGross ?? 0 },
    { label: '시뮬레이션 총 지급액', leftVal: lTotals.simulatedGross ?? 0, rightVal: rTotals.simulatedGross ?? 0, bold: true },
    { label: '차이 (Gross)', leftVal: lTotals.grossDifference ?? 0, rightVal: rTotals.grossDifference ?? 0 },
    { label: '변동률', leftVal: lTotals.grossChangeRate ?? 0, rightVal: rTotals.grossChangeRate ?? 0, format: 'pct' },
    { label: '시뮬레이션 순 지급액', leftVal: lTotals.simulatedNet ?? 0, rightVal: rTotals.simulatedNet ?? 0, bold: true },
    { label: '차이 (Net)', leftVal: lTotals.netDifference ?? 0, rightVal: rTotals.netDifference ?? 0 },
  ]

  return <CompareTable rows={rows} />
}

function CompareDifferential({ left, right }: { left: ScenarioDetail; right: ScenarioDetail }) {
  const lSummary = (left.results as { summary?: Record<string, unknown> })?.summary ?? {}
  const rSummary = (right.results as { summary?: Record<string, unknown> })?.summary ?? {}
  const lTotals = (lSummary.totals ?? {}) as Record<string, number>
  const rTotals = (rSummary.totals ?? {}) as Record<string, number>

  const topRows: CompareRow[] = [
    { label: '시뮬레이션 총 지급액', leftVal: lTotals.simulatedGross ?? 0, rightVal: rTotals.simulatedGross ?? 0, bold: true },
    { label: '차이 (Gross)', leftVal: lTotals.grossDifference ?? 0, rightVal: rTotals.grossDifference ?? 0 },
    { label: '변동률', leftVal: lTotals.grossChangeRate ?? 0, rightVal: rTotals.grossChangeRate ?? 0, format: 'pct' },
  ]

  // 직급별 비교
  const lByGrade = (lSummary.byGrade ?? []) as { grade: string; simulatedGross: number; difference: number }[]
  const rByGrade = (rSummary.byGrade ?? []) as { grade: string; simulatedGross: number; difference: number }[]
  const allGrades = [...new Set([...lByGrade.map(g => g.grade), ...rByGrade.map(g => g.grade)])]

  const gradeRows: CompareRow[] = allGrades.map(grade => {
    const l = lByGrade.find(g => g.grade === grade)
    const r = rByGrade.find(g => g.grade === grade)
    return { label: `${grade} 추가비용`, leftVal: l?.difference ?? 0, rightVal: r?.difference ?? 0 }
  })

  return (
    <div className="space-y-4">
      <CompareTable rows={topRows} />
      {gradeRows.length > 0 && (
        <>
          <h4 className="text-sm font-semibold text-[#1C1D21] mt-4">직급별 추가비용</h4>
          <CompareTable rows={gradeRows} />
        </>
      )}
    </div>
  )
}

function CompareHiring({ left, right }: { left: ScenarioDetail; right: ScenarioDetail }) {
  const lSummary = (left.results as { summary?: Record<string, number> })?.summary ?? {}
  const rSummary = (right.results as { summary?: Record<string, number> })?.summary ?? {}

  const rows: CompareRow[] = [
    { label: '현재 월 인건비', leftVal: (lSummary as Record<string, number>).currentMonthlyGross ?? 0, rightVal: (rSummary as Record<string, number>).currentMonthlyGross ?? 0 },
    { label: '신규 채용 월 인건비', leftVal: (lSummary as Record<string, number>).newHireMonthlyGross ?? 0, rightVal: (rSummary as Record<string, number>).newHireMonthlyGross ?? 0, bold: true },
    { label: '합산 월 인건비', leftVal: (lSummary as Record<string, number>).projectedMonthlyGross ?? 0, rightVal: (rSummary as Record<string, number>).projectedMonthlyGross ?? 0, bold: true },
    { label: '연간 추가 비용', leftVal: (lSummary as Record<string, number>).annualAdditionalCost ?? 0, rightVal: (rSummary as Record<string, number>).annualAdditionalCost ?? 0 },
    { label: '신규 채용 인원', leftVal: (lSummary as Record<string, number>).newHireCount ?? 0, rightVal: (rSummary as Record<string, number>).newHireCount ?? 0, format: 'count' },
  ]

  return <CompareTable rows={rows} />
}

function CompareFx({ left, right }: { left: ScenarioDetail; right: ScenarioDetail }) {
  const lSummary = (left.results as { summary?: Record<string, number> })?.summary ?? {}
  const rSummary = (right.results as { summary?: Record<string, number> })?.summary ?? {}

  const rows: CompareRow[] = [
    { label: '국내 월 인건비 (KRW)', leftVal: (lSummary as Record<string, number>).domesticMonthlyKRW ?? 0, rightVal: (rSummary as Record<string, number>).domesticMonthlyKRW ?? 0 },
    { label: '해외 현재 (KRW 환산)', leftVal: (lSummary as Record<string, number>).overseasCurrentKRW ?? 0, rightVal: (rSummary as Record<string, number>).overseasCurrentKRW ?? 0 },
    { label: '해외 시뮬레이션 (KRW)', leftVal: (lSummary as Record<string, number>).overseasSimulatedKRW ?? 0, rightVal: (rSummary as Record<string, number>).overseasSimulatedKRW ?? 0, bold: true },
    { label: '합산 현재 (KRW)', leftVal: (lSummary as Record<string, number>).totalCurrentKRW ?? 0, rightVal: (rSummary as Record<string, number>).totalCurrentKRW ?? 0 },
    { label: '합산 시뮬레이션 (KRW)', leftVal: (lSummary as Record<string, number>).totalSimulatedKRW ?? 0, rightVal: (rSummary as Record<string, number>).totalSimulatedKRW ?? 0, bold: true },
    { label: '차이 (KRW)', leftVal: (lSummary as Record<string, number>).differenceKRW ?? 0, rightVal: (rSummary as Record<string, number>).differenceKRW ?? 0 },
  ]

  return <CompareTable rows={rows} />
}

// ─── Component ──────────────────────────────────────────────

export default function ScenarioCompareView({ left, right, onClose }: Props) {
  const mode = left.mode as SaveableMode

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="w-5 h-5 text-[#5E81F4]" />
          <h2 className="text-lg font-bold text-[#1C1D21]">시나리오 비교</h2>
          <span className="text-xs px-2 py-0.5 bg-[#5E81F4]/10 text-[#5E81F4] rounded-full">
            {MODE_LABELS[mode]}
          </span>
        </div>
        <button onClick={onClose}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-[#8181A5] hover:text-[#1C1D21] border border-[#F0F0F3] rounded-lg">
          <X className="w-4 h-4" /> 닫기
        </button>
      </div>

      {/* 시나리오 메타 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: 'A', scenario: left },
          { label: 'B', scenario: right },
        ].map(({ label, scenario }) => (
          <div key={label} className={CARD_STYLES.padded}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-white bg-[#5E81F4] w-5 h-5 rounded flex items-center justify-center">
                {label}
              </span>
              <span className="text-sm font-medium text-[#1C1D21] truncate">{scenario.title}</span>
            </div>
            <p className="text-xs text-[#8181A5]">{fmtDate(scenario.createdAt)}</p>
            {scenario.description && (
              <p className="text-xs text-[#8181A5] mt-1 line-clamp-1">{scenario.description}</p>
            )}
          </div>
        ))}
      </div>

      {/* 모드별 비교 테이블 */}
      {(mode === 'SINGLE' || mode === 'BULK') && <CompareSingleBulk left={left} right={right} />}
      {mode === 'DIFFERENTIAL' && <CompareDifferential left={left} right={right} />}
      {mode === 'HIRING' && <CompareHiring left={left} right={right} />}
      {mode === 'FX' && <CompareFx left={left} right={right} />}
    </div>
  )
}
