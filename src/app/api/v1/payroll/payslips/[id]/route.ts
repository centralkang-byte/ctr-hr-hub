// ═══════════════════════════════════════════════════════════
// GET  /api/v1/payroll/payslips/[id] — 급여명세서 상세 조회 + 열람 처리
// PATCH /api/v1/payroll/payslips/[id] — 수동 열람 처리
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden } from '@/lib/errors'
import { withRLS, buildRLSContext } from '@/lib/api/withRLS'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import type { PayrollItemDetail } from '@/lib/payroll/types'

export const GET = withPermission(
  async (_req: NextRequest, context, user) => {
    const { id } = await context.params

    // RLS: DB-level isolation + app-level companyId check kept as redundant guard
    const { payslip, payrollItem } = await withRLS(buildRLSContext(user), async (tx) => {
      const slip = await tx.payslip.findUnique({
        where: { id },
        include: {
          employee: {
            select: {
              id: true, name: true, employeeNo: true,
              assignments: {
                where: { isPrimary: true, endDate: null },
                take: 1,
                include: {
                  department: { select: { name: true } },
                  jobGrade: { select: { name: true } },
                },
              },
            },
          },
        },
      })
      if (!slip) return { payslip: null, payrollItem: null }

      const item = await tx.payrollItem.findUnique({ where: { id: slip.payrollItemId } })
      return { payslip: slip, payrollItem: item }
    })

    if (!payslip) throw notFound('주여명세서를 찾을 수 없습니다.')
    if (payslip.companyId !== user.companyId && user.role !== 'SUPER_ADMIN') throw forbidden()

    const isOwnPayslip = payslip.employeeId === user.employeeId
    const isHR = user.role === 'HR_ADMIN' || user.role === 'SUPER_ADMIN'
    if (!isOwnPayslip && !isHR) throw forbidden()

    // 본인 열람 시 자동으로 열람 표시 (최초 1회)
    if (isOwnPayslip && !payslip.isViewed) {
      void prisma.payslip.update({
        where: { id },
        data: { isViewed: true, viewedAt: new Date() },
      })
    }

    return apiSuccess({
      ...payslip,
      detail: payrollItem?.detail as PayrollItemDetail | null,
      baseSalary: payrollItem ? Number(payrollItem.baseSalary) : null,
      grossPay: payrollItem ? Number(payrollItem.grossPay) : null,
      deductions: payrollItem ? Number(payrollItem.deductions) : null,
      netPay: payrollItem ? Number(payrollItem.netPay) : null,
      overtimePay: payrollItem ? Number(payrollItem.overtimePay) : null,
      bonus: payrollItem ? Number(payrollItem.bonus) : null,
    })
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)

export const PATCH = withPermission(
  async (req, context, user) => {
    const { id } = await context.params

    const payslip = await prisma.payslip.findUnique({ where: { id } })
    if (!payslip) throw notFound('급여명세서를 찾을 수 없습니다.')
    // GET과 동일하게 SUPER_ADMIN은 전 법인 접근 허용 (carve-out 일관)
    if (payslip.companyId !== user.companyId && user.role !== 'SUPER_ADMIN') throw forbidden()

    // 본인 명세서만 열람 처리 (HR은 모두 가능)
    const isOwnPayslip = payslip.employeeId === user.employeeId
    const isHR = user.role === 'HR_ADMIN' || user.role === 'SUPER_ADMIN'
    if (!isOwnPayslip && !isHR) throw forbidden()

    const updated = await prisma.payslip.update({
      where: { id },
      data: {
        isViewed: true,
        viewedAt: payslip.viewedAt ?? new Date(),
      },
    })

    // 타인 명세서 대리 열람처리(HR/SUPER, SUPER는 cross-company 가능)는 감사 기록 — 본인 열람은 제외
    if (!isOwnPayslip) {
      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'PAYSLIP_MARK_VIEWED',
        resourceType: 'Payslip',
        resourceId: id,
        companyId: payslip.companyId,
        changes: { employeeId: payslip.employeeId },
        ip,
        userAgent,
      })
    }

    return apiSuccess(updated)
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
