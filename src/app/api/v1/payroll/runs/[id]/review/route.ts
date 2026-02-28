// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/runs/[id]/review — 급여 검토 데이터
// 이상항목 플래그 포함
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import type { PayrollAnomaly, PayrollItemDetail, AnomalySeverity } from '@/lib/payroll/types'

export const GET = withPermission(
  async (_req, context, user) => {
    const { id } = await context.params

    const run = await prisma.payrollRun.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        payrollItems: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                employeeNo: true,
                hireDate: true,
                department: { select: { id: true, name: true } },
                jobGrade: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })

    if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')

    // 이상항목 감지
    const anomalies: PayrollAnomaly[] = []

    for (const item of run.payrollItems) {
      const detail = item.detail as unknown as PayrollItemDetail | null

      // 초과근무 > 월 60시간
      if (detail?.overtime?.totalOvertimeHours && detail.overtime.totalOvertimeHours > 60) {
        anomalies.push({
          employeeId: item.employeeId,
          employeeName: item.employee.name,
          severity: 'WARNING',
          message: `초과근무 ${detail.overtime.totalOvertimeHours.toFixed(1)}시간 (월 60시간 초과)`,
          field: 'overtimeHours',
          currentValue: detail.overtime.totalOvertimeHours,
        })
      }

      // 전월 대비 급여 차이 > 20% 체크
      const previousItem = await prisma.payrollItem.findFirst({
        where: {
          employeeId: item.employeeId,
          run: {
            companyId: user.companyId,
            status: 'PAID',
            id: { not: run.id },
          },
        },
        orderBy: { run: { periodEnd: 'desc' } },
      })

      if (previousItem) {
        const prevNet = Number(previousItem.netPay)
        const currNet = Number(item.netPay)
        if (prevNet > 0) {
          const diff = Math.abs(currNet - prevNet) / prevNet
          if (diff > 0.2) {
            anomalies.push({
              employeeId: item.employeeId,
              employeeName: item.employee.name,
              severity: 'ERROR',
              message: `전월 대비 급여 차이 ${(diff * 100).toFixed(1)}% (기준: 20%)`,
              field: 'netPay',
              currentValue: currNet,
              previousValue: prevNet,
            })
          }
        }
      }

      // 신규 입사자 (기간 내 입사)
      if (item.employee.hireDate >= run.periodStart) {
        anomalies.push({
          employeeId: item.employeeId,
          employeeName: item.employee.name,
          severity: 'INFO',
          message: '신규 입사자 — 일할 계산이 필요할 수 있습니다.',
          field: 'hireDate',
          currentValue: Number(item.grossPay),
        })
      }
    }

    return apiSuccess({
      run,
      summary: {
        headcount: run.headcount,
        totalGross: Number(run.totalGross ?? 0),
        totalDeductions: Number(run.totalDeductions ?? 0),
        totalNet: Number(run.totalNet ?? 0),
        anomalies,
      },
    })
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
