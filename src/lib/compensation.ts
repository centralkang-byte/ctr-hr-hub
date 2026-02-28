// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation Utilities
// ═══════════════════════════════════════════════════════════

import type { SalaryAdjustmentMatrix } from '@/generated/prisma/client'

// ─── Compa-Ratio ─────────────────────────────────────────

export type CompaRatioBand =
  | 'VERY_LOW'   // < 0.80 — 저보상 🔴
  | 'LOW'        // 0.80 ~ 0.95 — 시장 대비 낮음 🟡
  | 'AT_RANGE'   // 0.95 ~ 1.05 — 적정 🟢
  | 'HIGH'       // 1.05 ~ 1.20 — 높음 🔵
  | 'VERY_HIGH'  // > 1.20 — 과보상 🟣

export function calculateCompaRatio(
  currentSalary: number,
  midSalary: number,
): number {
  if (midSalary <= 0) return 0
  return Math.round((currentSalary / midSalary) * 100) / 100
}

export function getCompaRatioBand(ratio: number): CompaRatioBand {
  if (ratio < 0.80) return 'VERY_LOW'
  if (ratio < 0.95) return 'LOW'
  if (ratio <= 1.05) return 'AT_RANGE'
  if (ratio <= 1.20) return 'HIGH'
  return 'VERY_HIGH'
}

export const COMPA_RATIO_CONFIG: Record<
  CompaRatioBand,
  { label: string; color: string; bgClass: string; textClass: string }
> = {
  VERY_LOW: {
    label: '저보상',
    color: '#EF4444',
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
  },
  LOW: {
    label: '시장 대비 낮음',
    color: '#F59E0B',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
  },
  AT_RANGE: {
    label: '적정',
    color: '#10B981',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
  },
  HIGH: {
    label: '높음',
    color: '#3B82F6',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
  },
  VERY_HIGH: {
    label: '과보상',
    color: '#8B5CF6',
    bgClass: 'bg-purple-50',
    textClass: 'text-purple-700',
  },
}

// ─── EMS Block → Performance Group ───────────────────────
// 9블록 매트릭스 기반 성과 그룹 매핑
// 행(row) 기반: 1=Low, 2=Mid, 3=High (performance axis)

export type PerformanceGroup = 'HIGH' | 'MID' | 'LOW'

const BLOCK_PERFORMANCE_MAP: Record<string, PerformanceGroup> = {
  '3C': 'HIGH', '3B': 'HIGH', '3A': 'HIGH',  // 블록 7, 8, 9
  '2C': 'MID',  '2B': 'MID',  '2A': 'MID',   // 블록 4, 5, 6
  '1C': 'LOW',  '1B': 'LOW',  '1A': 'LOW',   // 블록 1, 2, 3
}

export function getPerformanceGroup(emsBlock: string): PerformanceGroup {
  return BLOCK_PERFORMANCE_MAP[emsBlock] ?? 'MID'
}

// ─── Compa-Ratio → Matrix Column ─────────────────────────

export type CompaColumn = 'BELOW' | 'AT' | 'ABOVE'

export function getCompaColumn(compaRatio: number): CompaColumn {
  if (compaRatio < 0.9) return 'BELOW'
  if (compaRatio <= 1.1) return 'AT'
  return 'ABOVE'
}

// ─── Matrix-based Recommendation ─────────────────────────

export interface MatrixRecommendation {
  emsBlock: string
  performanceGroup: PerformanceGroup
  compaColumn: CompaColumn
  recommendedPct: number
  minPct: number
  maxPct: number
}

export function getMatrixRecommendation(
  emsBlock: string,
  compaRatio: number,
  matrixEntries: SalaryAdjustmentMatrix[],
): MatrixRecommendation | null {
  const entry = matrixEntries.find((e) => e.emsBlock === emsBlock)
  if (!entry) return null

  return {
    emsBlock,
    performanceGroup: getPerformanceGroup(emsBlock),
    compaColumn: getCompaColumn(compaRatio),
    recommendedPct: Number(entry.recommendedIncreasePct),
    minPct: Number(entry.minIncreasePct ?? 0),
    maxPct: Number(entry.maxIncreasePct ?? Number(entry.recommendedIncreasePct)),
  }
}

// ─── Budget Summary ──────────────────────────────────────

export interface BudgetSummary {
  headcount: number
  totalCurrentSalary: number
  totalNewSalary: number
  totalIncrease: number
  avgIncreasePct: number
}

export function calculateBudgetSummary(
  items: Array<{ currentSalary: number; newSalary: number }>,
): BudgetSummary {
  if (items.length === 0) {
    return {
      headcount: 0,
      totalCurrentSalary: 0,
      totalNewSalary: 0,
      totalIncrease: 0,
      avgIncreasePct: 0,
    }
  }

  const totalCurrentSalary = items.reduce((s, i) => s + i.currentSalary, 0)
  const totalNewSalary = items.reduce((s, i) => s + i.newSalary, 0)
  const totalIncrease = totalNewSalary - totalCurrentSalary
  const avgIncreasePct =
    totalCurrentSalary > 0
      ? Math.round((totalIncrease / totalCurrentSalary) * 10000) / 100
      : 0

  return {
    headcount: items.length,
    totalCurrentSalary,
    totalNewSalary,
    totalIncrease,
    avgIncreasePct,
  }
}

// ─── Currency Format ─────────────────────────────────────

const CURRENCY_LOCALES: Record<string, string> = {
  KRW: 'ko-KR',
  USD: 'en-US',
  CNY: 'zh-CN',
  PLN: 'pl-PL',
  MXN: 'es-MX',
  RUB: 'ru-RU',
  VND: 'vi-VN',
}

export function formatCurrency(
  amount: number,
  currency: string = 'KRW',
): string {
  const locale = CURRENCY_LOCALES[currency] ?? 'ko-KR'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'KRW' ? 0 : 2,
  }).format(amount)
}
