// ═══════════════════════════════════════════════════════════
// CTR HR Hub — CN Social Insurance Batch Calculate
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { socialInsuranceCalculateSchema } from '@/lib/schemas/compliance'
import { calculateSocialInsurance } from '@/lib/compliance/cn'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/compliance/cn/social-insurance/calculate ─
// Batch calculate monthly social insurance for all active employees

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = socialInsuranceCalculateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { year, month } = parsed.data
    const companyId = user.companyId
    const today = new Date()

    // Load active configs for this company
    const configs = await prisma.socialInsuranceConfig.findMany({
      where: {
        companyId,
        isActive: true,
        effectiveFrom: { lte: today },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
      },
    })

    if (configs.length === 0) {
      throw badRequest('활성화된 사회보험 설정이 없습니다. 먼저 요율을 등록해주세요.')
    }

    // Load active employees with salary info
    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        employeeNo: true,
        compensationHistories: {
          orderBy: { effectiveDate: 'desc' },
          take: 1,
          select: { newBaseSalary: true },
        },
      },
    })

    if (employees.length === 0) {
      throw badRequest('재직 중인 직원이 없습니다.')
    }

    // Delete existing records for this year/month to avoid duplicates
    await prisma.socialInsuranceRecord.deleteMany({
      where: { companyId, year, month },
    })

    // Calculate and upsert records for each employee
    let totalCreated = 0
    const errors: string[] = []

    for (const employee of employees) {
      try {
        // Use the latest salary item as base salary, or 0 if none
        const baseSalary = employee.compensationHistories[0]
          ? Number(employee.compensationHistories[0].newBaseSalary)
          : 0

        if (baseSalary <= 0) continue

        const results = calculateSocialInsurance(baseSalary, configs)

        // Create records for each insurance type
        await prisma.socialInsuranceRecord.createMany({
          data: results.map((result) => ({
            companyId,
            employeeId: employee.id,
            insuranceType: result.insuranceType as 'PENSION' | 'MEDICAL' | 'UNEMPLOYMENT' | 'WORK_INJURY' | 'MATERNITY_INS' | 'HOUSING_FUND',
            year,
            month,
            baseSalary: result.baseSalary,
            employerAmount: result.employerAmount,
            employeeAmount: result.employeeAmount,
          })),
        })

        totalCreated += results.length
      } catch {
        errors.push(employee.employeeNo)
      }
    }

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'compliance.cn.socialInsurance.calculate',
      resourceType: 'socialInsuranceRecord',
      resourceId: `${companyId}-${year}-${month}`,
      companyId,
      changes: { year, month, totalCreated, employeeCount: employees.length },
      ip,
      userAgent,
    })

    return apiSuccess({
      year,
      month,
      employeeCount: employees.length,
      recordsCreated: totalCreated,
      errors: errors.length > 0 ? errors : undefined,
    })
  },
  perm(MODULE.COMPLIANCE, ACTION.CREATE),
)
