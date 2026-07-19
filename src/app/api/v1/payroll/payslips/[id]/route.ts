// ═══════════════════════════════════════════════════════════
// GET  /api/v1/payroll/payslips/[id] — 급여명세서 상세 조회 + 열람 처리
// PATCH /api/v1/payroll/payslips/[id] — 수동 열람 처리
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden } from '@/lib/errors'
import { withRLS, buildRLSContext } from '@/lib/api/withRLS'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import type { PayrollItemDetail } from '@/lib/payroll/types'

export const GET = withPermission(
  async (_req: NextRequest, context, user) => {
    const { id } = await context.params

    const ownership = await prisma.payslip.findFirst({
      where: {
        id,
        ...(user.role === ROLE.SUPER_ADMIN
          ? {}
          : user.role === ROLE.HR_ADMIN
            ? {
                OR: [
                  { employeeId: user.employeeId },
                  { companyId: user.companyId },
                ],
              }
            : { employeeId: user.employeeId }),
      },
      select: { employeeId: true, companyId: true },
    })
    if (!ownership) throw notFound('급여명세서를 찾을 수 없습니다.')

    const isOwnPayslip = ownership.employeeId === user.employeeId
    const canAccessAsAdmin = user.role === ROLE.SUPER_ADMIN
      || (user.role === ROLE.HR_ADMIN && ownership.companyId === user.companyId)
    if (!isOwnPayslip && !canAccessAsAdmin) throw forbidden()

    // 전적 전 기록도 조회할 수 있도록 RLS 회사 컨텍스트는 현재 소속이 아니라
    // 접근 검사를 통과한 Payslip의 저장 법인으로 설정한다.
    const { payslip, payrollItem } = await withRLS(
      {
        ...buildRLSContext(user),
        companyId: ownership.companyId,
      },
      async (tx) => {
        const storedSlip = await tx.payslip.findUnique({
          where: { id },
          include: {
            employee: {
              select: {
                id: true, name: true, employeeNo: true,
              },
            },
          },
        })
        if (!storedSlip) return { payslip: null, payrollItem: null }

        const periodStart = new Date(Date.UTC(storedSlip.year, storedSlip.month - 1, 1))
        const periodEnd = new Date(Date.UTC(storedSlip.year, storedSlip.month, 0))
        const assignment = await tx.employeeAssignment.findFirst({
          where: {
            employeeId: storedSlip.employeeId,
            companyId: storedSlip.companyId,
            isPrimary: true,
            effectiveDate: { lte: periodEnd },
            OR: [
              { endDate: null },
              { endDate: { gt: periodStart } },
            ],
          },
          orderBy: { effectiveDate: 'desc' },
          include: {
            department: { select: { name: true } },
            jobGrade: { select: { name: true } },
          },
        })
        const slip = {
          ...storedSlip,
          employee: {
            ...storedSlip.employee,
            assignments: assignment ? [assignment] : [],
          },
        }

        const item = await tx.payrollItem.findUnique({ where: { id: slip.payrollItemId } })
        return { payslip: slip, payrollItem: item }
      },
    )

    if (!payslip) throw notFound('급여명세서를 찾을 수 없습니다.')

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

    // 본인은 전적 전후 본인 기록을, HR은 현재 법인의 기록을, SUPER는 전 법인 기록을 처리한다.
    const isOwnPayslip = payslip.employeeId === user.employeeId
    const canAccessAsAdmin = user.role === ROLE.SUPER_ADMIN
      || (user.role === ROLE.HR_ADMIN && payslip.companyId === user.companyId)
    if (!isOwnPayslip && !canAccessAsAdmin) throw forbidden()

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
