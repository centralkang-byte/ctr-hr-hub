// ═══════════════════════════════════════════════════════════
// CTR HR Hub — CN Social Insurance Report Export
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { socialInsuranceExportSchema } from '@/lib/schemas/compliance'
import { generateSocialInsuranceReport } from '@/lib/compliance/cn'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/compliance/cn/social-insurance/export ──
// Export monthly social insurance report as JSON data for client-side Excel

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = socialInsuranceExportSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { year, month } = parsed.data
    const companyId = user.companyId

    const report = await generateSocialInsuranceReport(companyId, year, month)

    if (report.rows.length === 0) {
      throw badRequest(`${year}년 ${month}월 사회보험 데이터가 없습니다. 먼저 계산을 실행해주세요.`)
    }

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'compliance.cn.socialInsurance.export',
      resourceType: 'socialInsuranceReport',
      resourceId: `${companyId}-${year}-${month}`,
      companyId,
      changes: { year, month },
      ip,
      userAgent,
    })

    // Return structured data for client-side Excel generation
    return apiSuccess({
      meta: {
        companyId,
        year,
        month,
        generatedAt: report.generatedAt,
        filename: `social_insurance_${year}_${String(month).padStart(2, '0')}.xlsx`,
      },
      summary: {
        grandTotalEmployer: report.grandTotalEmployer,
        grandTotalEmployee: report.grandTotalEmployee,
        grandTotal: Number(
          (report.grandTotalEmployer + report.grandTotalEmployee).toFixed(2),
        ),
      },
      rows: report.rows.map((row) => ({
        insuranceType: row.insuranceType,
        employeeCount: row.employeeCount,
        totalBaseSalary: row.totalBaseSalary,
        totalEmployerAmount: row.totalEmployerAmount,
        totalEmployeeAmount: row.totalEmployeeAmount,
        totalAmount: Number(
          (row.totalEmployerAmount + row.totalEmployeeAmount).toFixed(2),
        ),
      })),
    })
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)
