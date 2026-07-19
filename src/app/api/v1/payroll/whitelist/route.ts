// ═══════════════════════════════════════════════════════════
// GET  /api/v1/payroll/whitelist — 화이트리스트 목록 (법인별 최신)
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess, buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { resolveCompanyId } from '@/lib/api/companyFilter'

const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const GET = withPermission(
    async (req: NextRequest, _context, user) => {
        const url = new URL(req.url)
        const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams))
        if (!parsed.success) throw badRequest('잘못된 쿼리 파라미터입니다.')
        const { page, limit } = parsed.data
        const companyId = resolveCompanyId(user, url.searchParams.get('companyId'))

        // 법인 내 화이트리스트 등록된 이상 항목
        // 직원+규칙 기준 가장 최신 항목만 표시 (distinct equivalent)
        const rows = await prisma.payrollAnomaly.findMany({
            where: {
                whitelisted: true,
                payrollRun: { companyId },
            },
            include: {
                employee: {
                    select: {
                        id: true, name: true, employeeNo: true,
                        assignments: {
                            where: { isPrimary: true },
                            orderBy: { effectiveDate: 'desc' },
                            select: {
                                companyId: true,
                                effectiveDate: true,
                                endDate: true,
                                department: { select: { name: true } },
                            },
                        },
                    },
                },
                payrollRun: {
                    select: {
                        yearMonth: true,
                        companyId: true,
                        periodStart: true,
                        periodEnd: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        })

        // distinct on (employeeId, ruleCode) — keep latest per pair
        const seen = new Set<string>()
        const unique = rows.filter((r) => {
            const key = `${r.employeeId}:${r.ruleCode}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })

        const pageData = unique
            .slice((page - 1) * limit, page * limit)
            .map((row) => {
                const assignment = row.employee.assignments.find((candidate) =>
                    candidate.companyId === row.payrollRun.companyId &&
                    candidate.effectiveDate <= row.payrollRun.periodEnd &&
                    (candidate.endDate === null || candidate.endDate > row.payrollRun.periodStart),
                )
                return {
                    ...row,
                    employee: {
                        ...row.employee,
                        assignments: assignment ? [assignment] : [],
                    },
                }
            })

        return apiSuccess({
            items: pageData,
            pagination: buildPagination(page, limit, unique.length),
        }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.VIEW),
)
