// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/me — 내 급여명세서 목록 (PAID만)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import type { PayrollItemDetail } from '@/lib/payroll/types'

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
  }
}

// ─── Normalise raw DB detail → PayrollItemDetail ───────────
function normaliseDetail(
  raw: unknown,
  grossPay: number,
  netPay: number,
): PayrollItemDetail | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as RawDetail
  const c = d.components ?? {}
  const ded = d.deductions ?? {}

  const earnings = {
    baseSalary:               c.base ?? 0,
    fixedOvertimeAllowance:   0,
    mealAllowance:            c.meal ?? 0,
    transportAllowance:       c.transport ?? 0,
    overtimePay:              c.overtime ?? 0,
    nightShiftPay:            c.nightShift ?? 0,
    holidayPay:               c.holiday ?? 0,
    bonuses:                  c.bonus ?? 0,
    otherEarnings:            c.positionAllowance ?? 0,
  }
  const deductions = {
    nationalPension:    ded.nationalPension ?? 0,
    healthInsurance:    ded.healthInsurance ?? 0,
    longTermCare:       ded.longTermCare ?? 0,
    employmentInsurance:ded.employmentInsurance ?? 0,
    incomeTax:          ded.incomeTax ?? 0,
    localIncomeTax:     ded.localIncomeTax ?? 0,
    otherDeductions:    0,
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
    grossPay: Number(grossPay),
    totalDeductions,
    netPay: Number(netPay),
  }
}

export const GET = withPermission(
  async (_req, _context, user) => {
    const items = await prisma.payrollItem.findMany({
      where: {
        employeeId: user.employeeId,
        run: {
          companyId: user.companyId,
          status: { in: ['APPROVED', 'PAID'] },
        },
      },
      include: {
        run: {
          select: {
            id: true,
            name: true,
            yearMonth: true,
            periodStart: true,
            periodEnd: true,
            payDate: true,
            paidAt: true,
          },
        },
      },
      orderBy: { run: { periodEnd: 'desc' } },
    })

    // Normalise each item's detail to match PayrollItemDetail shape
    const normalised = items.map((item) => ({
      ...item,
      detail: normaliseDetail(
        item.detail,
        item.grossPay as unknown as number,
        item.netPay as unknown as number,
      ),
    }))

    return apiSuccess(normalised)
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)

