'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 시나리오 비교 뷰
// Unified Table: 항목(행) × 시나리오(열) + 차이 열
// ═══════════════════════════════════════════════════════════

import { X, GitCompareArrows } from 'lucide-react'
import { useTranslations } from 'next-intl'
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

const MODE_LABEL_KEYS: Record<SaveableMode, string> = {
  SINGLE: 'simModeSingle',
  BULK: 'simModeBulk',
  DIFFERENTIAL: 'simModeDifferential',
  HIRING: 'simModeHiring',
  FX: 'simModeFx',
}

// ─── Helpers ────────────────────────────────────────────────

interface CompareRow {
  label: string
  leftVal: number
  rightVal: number
  format?: 'krw' | 'pct' | 'count'
  bold?: boolean
}

function CompareTable({ rows, headers }: { rows: CompareRow[]; headers: { item: string; scenarioA: string; scenarioB: string; diff: string } }) {
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
            <th className={TABLE_STYLES.headerCell}>{headers.item}</th>
            <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{headers.scenarioA}</th>
            <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{headers.scenarioB}</th>
            <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{headers.diff}</th>
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

function CompareSingleBulk({ left, right, headers }: { left: ScenarioDetail; right: ScenarioDetail; headers: { item: string; scenarioA: string; scenarioB: string; diff: string } }) {
  const t = useTranslations('payroll')
  const lTotals = (left.results as { summary?: { totals?: Record<string, number> } })?.summary?.totals ?? {}
  const rTotals = (right.results as { summary?: { totals?: Record<string, number> } })?.summary?.totals ?? {}

  const rows: CompareRow[] = [
    { label: t('simCompareCurrentGross'), leftVal: lTotals.currentGross ?? 0, rightVal: rTotals.currentGross ?? 0 },
    { label: t('simCompareSimGross'), leftVal: lTotals.simulatedGross ?? 0, rightVal: rTotals.simulatedGross ?? 0, bold: true },
    { label: t('simCompareDiffGross'), leftVal: lTotals.grossDifference ?? 0, rightVal: rTotals.grossDifference ?? 0 },
    { label: t('simCompareChangeRate'), leftVal: lTotals.grossChangeRate ?? 0, rightVal: rTotals.grossChangeRate ?? 0, format: 'pct' },
    { label: t('simCompareSimNet'), leftVal: lTotals.simulatedNet ?? 0, rightVal: rTotals.simulatedNet ?? 0, bold: true },
    { label: t('simCompareDiffNet'), leftVal: lTotals.netDifference ?? 0, rightVal: rTotals.netDifference ?? 0 },
  ]

  return <CompareTable rows={rows} headers={headers} />
}

function CompareDifferential({ left, right, headers }: { left: ScenarioDetail; right: ScenarioDetail; headers: { item: string; scenarioA: string; scenarioB: string; diff: string } }) {
  const t = useTranslations('payroll')
  const lSummary = (left.results as { summary?: Record<string, unknown> })?.summary ?? {}
  const rSummary = (right.results as { summary?: Record<string, unknown> })?.summary ?? {}
  const lTotals = (lSummary.totals ?? {}) as Record<string, number>
  const rTotals = (rSummary.totals ?? {}) as Record<string, number>

  const topRows: CompareRow[] = [
    { label: t('simCompareSimGross'), leftVal: lTotals.simulatedGross ?? 0, rightVal: rTotals.simulatedGross ?? 0, bold: true },
    { label: t('simCompareDiffGross'), leftVal: lTotals.grossDifference ?? 0, rightVal: rTotals.grossDifference ?? 0 },
    { label: t('simCompareChangeRate'), leftVal: lTotals.grossChangeRate ?? 0, rightVal: rTotals.grossChangeRate ?? 0, format: 'pct' },
  ]

  // 직급별 비교
  const lByGrade = (lSummary.byGrade ?? []) as { grade: string; simulatedGross: number; difference: number }[]
  const rByGrade = (rSummary.byGrade ?? []) as { grade: string; simulatedGross: number; difference: number }[]
  const allGrades = [...new Set([...lByGrade.map(g => g.grade), ...rByGrade.map(g => g.grade)])]

  const gradeRows: CompareRow[] = allGrades.map(grade => {
    const l = lByGrade.find(g => g.grade === grade)
    const r = rByGrade.find(g => g.grade === grade)
    return { label: t('simCompareGradeCost', { grade }), leftVal: l?.difference ?? 0, rightVal: r?.difference ?? 0 }
  })

  return (
    <div className="space-y-4">
      <CompareTable rows={topRows} headers={headers} />
      {gradeRows.length > 0 && (
        <>
          <h4 className="text-sm font-semibold text-[#1C1D21] mt-4">{t('simCompareGradeCostTitle')}</h4>
          <CompareTable rows={gradeRows} headers={headers} />
        </>
      )}
    </div>
  )
}

function CompareHiring({ left, right, headers }: { left: ScenarioDetail; right: ScenarioDetail; headers: { item: string; scenarioA: string; scenarioB: string; diff: string } }) {
  const t = useTranslations('payroll')
  const lSummary = (left.results as { summary?: Record<string, number> })?.summary ?? {}
  const rSummary = (right.results as { summary?: Record<string, number> })?.summary ?? {}

  const rows: CompareRow[] = [
    { label: t('simCompareCurrentMonthlyCost'), leftVal: (lSummary as Record<string, number>).currentMonthlyGross ?? 0, rightVal: (rSummary as Record<string, number>).currentMonthlyGross ?? 0 },
    { label: t('simCompareNewHireMonthlyCost'), leftVal: (lSummary as Record<string, number>).newHireMonthlyGross ?? 0, rightVal: (rSummary as Record<string, number>).newHireMonthlyGross ?? 0, bold: true },
    { label: t('simCompareTotalMonthlyCost'), leftVal: (lSummary as Record<string, number>).projectedMonthlyGross ?? 0, rightVal: (rSummary as Record<string, number>).projectedMonthlyGross ?? 0, bold: true },
    { label: t('simCompareAnnualAddCost'), leftVal: (lSummary as Record<string, number>).annualAdditionalCost ?? 0, rightVal: (rSummary as Record<string, number>).annualAdditionalCost ?? 0 },
    { label: t('simCompareNewHireCount'), leftVal: (lSummary as Record<string, number>).newHireCount ?? 0, rightVal: (rSummary as Record<string, number>).newHireCount ?? 0, format: 'count' },
  ]

  return <CompareTable rows={rows} headers={headers} />
}

function CompareFx({ left, right, headers }: { left: ScenarioDetail; right: ScenarioDetail; headers: { item: string; scenarioA: string; scenarioB: string; diff: string } }) {
  const t = useTranslations('payroll')
  const lSummary = (left.results as { summary?: Record<string, number> })?.summary ?? {}
  const rSummary = (right.results as { summary?: Record<string, number> })?.summary ?? {}

  const rows: CompareRow[] = [
    { label: t('simCompareDomesticMonthly'), leftVal: (lSummary as Record<string, number>).domesticMonthlyKRW ?? 0, rightVal: (rSummary as Record<string, number>).domesticMonthlyKRW ?? 0 },
    { label: t('simCompareOverseasCurrent'), leftVal: (lSummary as Record<string, number>).overseasCurrentKRW ?? 0, rightVal: (rSummary as Record<string, number>).overseasCurrentKRW ?? 0 },
    { label: t('simCompareOverseasSim'), leftVal: (lSummary as Record<string, number>).overseasSimulatedKRW ?? 0, rightVal: (rSummary as Record<string, number>).overseasSimulatedKRW ?? 0, bold: true },
    { label: t('simCompareTotalCurrent'), leftVal: (lSummary as Record<string, number>).totalCurrentKRW ?? 0, rightVal: (rSummary as Record<string, number>).totalCurrentKRW ?? 0 },
    { label: t('simCompareTotalSim'), leftVal: (lSummary as Record<string, number>).totalSimulatedKRW ?? 0, rightVal: (rSummary as Record<string, number>).totalSimulatedKRW ?? 0, bold: true },
    { label: t('simCompareDiffKRW'), leftVal: (lSummary as Record<string, number>).differenceKRW ?? 0, rightVal: (rSummary as Record<string, number>).differenceKRW ?? 0 },
  ]

  return <CompareTable rows={rows} headers={headers} />
}

// ─── Component ──────────────────────────────────────────────

export default function ScenarioCompareView({ left, right, onClose }: Props) {
  const t = useTranslations('payroll')
  const tCommon = useTranslations('common')
  const mode = left.mode as SaveableMode

  const headers = {
    item: t('simCompareItem'),
    scenarioA: t('simCompareScenarioA'),
    scenarioB: t('simCompareScenarioB'),
    diff: t('simCompareDiff'),
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="w-5 h-5 text-[#5E81F4]" />
          <h2 className="text-lg font-bold text-[#1C1D21]">{t('simCompareTitle')}</h2>
          <span className="text-xs px-2 py-0.5 bg-[#5E81F4]/10 text-[#5E81F4] rounded-full">
            {t(MODE_LABEL_KEYS[mode])}
          </span>
        </div>
        <button onClick={onClose}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-[#8181A5] hover:text-[#1C1D21] border border-[#F0F0F3] rounded-lg">
          <X className="w-4 h-4" /> {tCommon('close')}
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
      {(mode === 'SINGLE' || mode === 'BULK') && <CompareSingleBulk left={left} right={right} headers={headers} />}
      {mode === 'DIFFERENTIAL' && <CompareDifferential left={left} right={right} headers={headers} />}
      {mode === 'HIRING' && <CompareHiring left={left} right={right} headers={headers} />}
      {mode === 'FX' && <CompareFx left={left} right={right} headers={headers} />}
    </div>
  )
}
