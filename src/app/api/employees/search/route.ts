// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/employees/search
// 급여 시뮬레이션용 직원 검색 (autocomplete)
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

const searchQuerySchema = z.object({
    q: z.string().min(1),
    companyId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(20).default(10),
})

// ─── 한글/영문 최소 길이 판별 ──────────────────────────────
function isKorean(text: string): boolean {
    return /[\uAC00-\uD7A3\u3131-\u3163\u1100-\u11FF]/.test(text)
}

// ─── GET /api/employees/search ─────────────────────────────

export const GET = withPermission(
    async (
        req: NextRequest,
        _context: { params: Promise<Record<string, string>> },
        user: SessionUser,
    ) => {
        const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries())
        const parsed = searchQuerySchema.safeParse(rawParams)
        if (!parsed.success) {
            throw badRequest('검색어를 입력하세요.', { issues: parsed.error.issues })
        }

        const { q: query, companyId: requestedCompanyId, limit } = parsed.data

        // 한글 1자 허용, 영문/숫자 2자 이상 필요
        if (!isKorean(query) && query.length < 2) {
            return apiSuccess({ employees: [] })
        }

        // Security: resolveCompanyId
        const companyId = requestedCompanyId
            ? resolveCompanyId(user, requestedCompanyId)
            : undefined

        const assignmentFilter = {
            isPrimary: true,
            endDate: null,
            status: 'ACTIVE',
            ...(companyId ? { companyId } : {}),
        }

        const results = await prisma.employee.findMany({
            where: {
                deletedAt: null,
                OR: [
                    { name: { contains: query, mode: 'insensitive' as const } },
                    { nameEn: { contains: query, mode: 'insensitive' as const } },
                    { employeeNo: { contains: query, mode: 'insensitive' as const } },
                ],
                assignments: {
                    some: assignmentFilter,
                },
            },
            take: limit,
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                nameEn: true,
                employeeNo: true,
                assignments: {
                    where: { isPrimary: true, endDate: null },
                    take: 1,
                    select: {
                        companyId: true,
                        department: { select: { name: true } },
                        position: { select: { titleKo: true } },
                        company: { select: { code: true, currency: true } },
                    },
                },
            },
        })

        // 최신 CompensationHistory에서 현재 급여 조회
        const employeeIds = results.map((e) => e.id)
        const latestCompensations = employeeIds.length > 0
            ? await prisma.compensationHistory.findMany({
                where: { employeeId: { in: employeeIds } },
                orderBy: { effectiveDate: 'desc' },
                distinct: ['employeeId'],
                select: { employeeId: true, newBaseSalary: true, currency: true },
            })
            : []

        const salaryMap = new Map(
            latestCompensations.map((c) => [
                c.employeeId,
                { salary: Number(c.newBaseSalary), currency: c.currency },
            ]),
        )

        // 정확 매치 → startsWith → contains 순서 정렬
        const scored = results.map((emp) => {
            const asgn = extractPrimaryAssignment(emp.assignments ?? [])
            const salaryInfo = salaryMap.get(emp.id)

            let score = 0
            const nameLC = emp.name.toLowerCase()
            const queryLC = query.toLowerCase()

            if (nameLC === queryLC || emp.employeeNo.toLowerCase() === queryLC) {
                score = 3 // exact
            } else if (nameLC.startsWith(queryLC) || emp.employeeNo.toLowerCase().startsWith(queryLC)) {
                score = 2 // startsWith
            } else {
                score = 1 // contains
            }

            return {
                id: emp.id,
                name: emp.name,
                nameEn: emp.nameEn,
                employeeNo: emp.employeeNo,
                department: asgn?.department?.name ?? '',
                position: asgn?.position?.titleKo ?? '',
                companyCode: asgn?.company?.code ?? '',
                companyId: asgn?.companyId ?? '',
                currentSalary: salaryInfo?.salary ?? 0,
                currency: salaryInfo?.currency ?? asgn?.company?.currency ?? 'KRW',
                _score: score,
            }
        })

        // 높은 점수 → 낮은 점수 순서
        scored.sort((a, b) => b._score - a._score)

        return apiSuccess({
            employees: scored.map(({ _score, ...rest }) => rest),
        })
    },
    perm(MODULE.PAYROLL, ACTION.VIEW),
)
