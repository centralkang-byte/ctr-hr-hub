// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll detail normaliser (SSOT)
// Raw PayrollItem.detail → PayrollItemDetail shape.
// Handles BOTH formats stored in the DB:
//   - payroll engine: { earnings, insurance, tax }
//   - legacy seed:    { components, deductions }
// Pure + dependency-free (type-only import) → server- AND client-safe.
// Consumers: GET /payroll/me (list), GET /payroll/me/[runId]/pdf,
//            PayStubDetailClient (Wave 1 X-1: 로컬 사본 흡수).
// ═══════════════════════════════════════════════════════════

import type { PayrollItemDetail } from './types'

// malformed(NaN·Infinity·비숫자) 금액 방어 — Number(x)만으로는 NaN이 그대로
// 전파되어 화면에 'NaN' 노출. Number.isFinite 기반 가드로 통일 (Codex G1 P2)
function toFiniteNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// ─── Raw detail shape stored in DB by seed script ──────────
interface RawDetail {
  grade?: string
  persona?: string
  components?: {
    base?: number
    meal?: number
    transport?: number
    overtime?: number
    positionAllowance?: number
    nightShift?: number
    holiday?: number
    bonus?: number
  }
  deductions?: {
    nationalPension?: number
    healthInsurance?: number
    longTermCare?: number
    employmentInsurance?: number
    incomeTax?: number
    localIncomeTax?: number
    otherDeductions?: number
  }
}

// ─── Normalise raw DB detail → PayrollItemDetail ───────────
export function normaliseDetail(
  raw: unknown,
  grossPay: number,
  netPay: number,
): PayrollItemDetail | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>

  // Payroll engine format: { earnings, insurance, tax }
  if (d.earnings && typeof d.earnings === 'object') {
    const ins = (d.insurance as Record<string, number>) ?? {}
    const tax = (d.tax as Record<string, number>) ?? {}
    const existingDed = d.deductions as Record<string, number> | undefined

    const deductions: PayrollItemDetail['deductions'] = existingDed && Object.keys(existingDed).length > 0
      ? existingDed as unknown as PayrollItemDetail['deductions']
      : {
          nationalPension: ins.nationalPension ?? 0,
          healthInsurance: ins.healthInsurance ?? 0,
          longTermCare: ins.longTermCare ?? 0,
          employmentInsurance: ins.employmentInsurance ?? 0,
          incomeTax: tax.incomeTax ?? 0,
          localIncomeTax: tax.localIncomeTax ?? 0,
          otherDeductions: 0,
        }

    const totalDeductions = Object.values(deductions).reduce((s, v) => s + v, 0)

    return {
      earnings: d.earnings as PayrollItemDetail['earnings'],
      deductions,
      overtime: (d.overtime as PayrollItemDetail['overtime']) ?? {
        hourlyWage: 0, totalOvertimeHours: 0,
        weekdayOTHours: 0, weekendHours: 0,
        holidayHours: 0, nightHours: 0,
      },
      grossPay: toFiniteNumber(grossPay),
      totalDeductions,
      netPay: toFiniteNumber(netPay),
      customAllowances: d.customAllowances as PayrollItemDetail['customAllowances'],
      customDeductions: d.customDeductions as PayrollItemDetail['customDeductions'],
      previousMonth: d.previousMonth as PayrollItemDetail['previousMonth'],
    }
  }

  // Legacy seed format: { components, deductions }
  const rd = d as unknown as RawDetail
  const c = rd.components ?? {}
  const ded = rd.deductions ?? {}

  const earnings = {
    baseSalary: c.base ?? 0,
    fixedOvertimeAllowance: 0,
    mealAllowance: c.meal ?? 0,
    transportAllowance: c.transport ?? 0,
    overtimePay: c.overtime ?? 0,
    nightShiftPay: c.nightShift ?? 0,
    holidayPay: c.holiday ?? 0,
    bonuses: c.bonus ?? 0,
    otherEarnings: c.positionAllowance ?? 0,
  }
  const deductions = {
    nationalPension: ded.nationalPension ?? 0,
    healthInsurance: ded.healthInsurance ?? 0,
    longTermCare: ded.longTermCare ?? 0,
    employmentInsurance: ded.employmentInsurance ?? 0,
    incomeTax: ded.incomeTax ?? 0,
    localIncomeTax: ded.localIncomeTax ?? 0,
    // Wave 1 X-1: 로컬 사본 슈퍼셋 흡수 — legacy detail에 저장된 otherDeductions 보존 (기존 0 고정은 유실)
    otherDeductions: ded.otherDeductions ?? 0,
  }
  const totalDeductions = Object.values(deductions).reduce((s, v) => s + v, 0)

  return {
    earnings,
    deductions,
    overtime: {
      hourlyWage: 0, totalOvertimeHours: 0,
      weekdayOTHours: 0, weekendHours: 0,
      holidayHours: 0, nightHours: 0,
    },
    grossPay: toFiniteNumber(grossPay),
    totalDeductions,
    netPay: toFiniteNumber(netPay),
  }
}
