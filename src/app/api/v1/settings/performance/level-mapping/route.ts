// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Level Mapping Settings
// GET/PUT /api/v1/settings/performance/level-mapping
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET ──────────────────────────────────────────────────
export const GET = withPermission(
    async (req: NextRequest, _context, user: SessionUser) => {
        const companyId = resolveCompanyId(
            user,
            req.nextUrl.searchParams.get('companyId'),
        )

        try {
            const mappings = await prisma.employeeLevelMapping.findMany({
                where: { companyId },
                orderBy: { levelCode: 'asc' },
            })

            return apiSuccess(mappings)
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.SETTINGS, ACTION.VIEW),
)

// ─── PUT ──────────────────────────────────────────────────
// Upsert level mappings for a company (bulk)

const mappingSchema = z.object({
    mappings: z.array(
        z.object({
            jobGradeCode: z.string().min(1),
            levelCode: z.enum(['L1', 'L2', 'L3', 'L4', 'L5', 'EXEC']),
            mboWeight: z.number().int().min(0).max(100).nullable().optional(),
            beiWeight: z.number().int().min(0).max(100).nullable().optional(),
        }),
    ).min(1).max(20),
    companyId: z.string().uuid().optional(),
})

export const PUT = withPermission(
    async (req: NextRequest, _context, user: SessionUser) => {
        const body: unknown = await req.json()
        const parsed = mappingSchema.safeParse(body)
        if (!parsed.success) {
            throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
        }

        const companyId = resolveCompanyId(user, parsed.data.companyId)

        try {
            // Validate MBO + BEI = 100 where both are provided
            for (const m of parsed.data.mappings) {
                if (m.mboWeight != null && m.beiWeight != null && m.mboWeight + m.beiWeight !== 100) {
                    throw badRequest(`${m.levelCode}: MBO(${m.mboWeight}) + BEI(${m.beiWeight}) = ${m.mboWeight + m.beiWeight}. 합계는 100이어야 합니다.`)
                }
            }

            const results = await prisma.$transaction(
                parsed.data.mappings.map((m) =>
                    prisma.employeeLevelMapping.upsert({
                        where: {
                            companyId_jobGradeCode: {
                                companyId,
                                jobGradeCode: m.jobGradeCode,
                            },
                        },
                        update: {
                            levelCode: m.levelCode,
                            mboWeight: m.mboWeight ?? null,
                            beiWeight: m.beiWeight ?? null,
                        },
                        create: {
                            companyId,
                            jobGradeCode: m.jobGradeCode,
                            levelCode: m.levelCode,
                            mboWeight: m.mboWeight ?? null,
                            beiWeight: m.beiWeight ?? null,
                        },
                    }),
                ),
            )

            return apiSuccess({ updated: results.length })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.SETTINGS, ACTION.UPDATE),
)
