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

const querySchema = z.object({
    companyId: z.string().min(1),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const GET = withPermission(
    async (req: NextRequest, _context, _user) => {
        const url = new URL(req.url)
        const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams))
        if (!parsed.success) throw badRequest('companyId 파라미터가 필요합니다.')
        const { companyId, page, limit } = parsed.data

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
                            where: { isPrimary: true, endDate: null },
                            take: 1,
                            include: { department: { select: { name: true } } },
                        },
                    },
                },
                payrollRun: { select: { yearMonth: true } },
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

        const pageData = unique.slice((page - 1) * limit, page * limit)

        return apiSuccess({
            items: pageData,
            pagination: buildPagination(page, limit, unique.length),
        }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.VIEW),
)
