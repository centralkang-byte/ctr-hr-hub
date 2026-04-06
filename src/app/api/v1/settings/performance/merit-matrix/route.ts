// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Merit Matrix Settings
// GET/PUT /api/v1/settings/performance/merit-matrix
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

const GRADE_KEYS = ['O', 'E', 'M', 'S'] as const
const BAND_KEYS = ['LOW', 'MID', 'HIGH'] as const

// ─── GET ──────────────────────────────────────────────────
export const GET = withPermission(
    async (req: NextRequest, _context, user: SessionUser) => {
        const companyId = resolveCompanyId(
            user,
            req.nextUrl.searchParams.get('companyId'),
        )

        try {
            const matrix = await prisma.salaryAdjustmentMatrix.findMany({
                where: {
                    companyId,
                    gradeKey: { not: null },
                },
                orderBy: [{ gradeKey: 'asc' }, { comparatioBand: 'asc' }],
            })

            return apiSuccess({
                matrix: matrix.map((row) => ({
                    id: row.id,
                    gradeKey: row.gradeKey,
                    comparatioBand: row.comparatioBand,
                    minPct: row.meritMinPct != null ? Number(row.meritMinPct) : null,
                    maxPct: row.meritMaxPct != null ? Number(row.meritMaxPct) : null,
                    recommendedPct: row.meritRecommendedPct != null ? Number(row.meritRecommendedPct) : null,
                })),
                gradeKeys: GRADE_KEYS,
                bandKeys: BAND_KEYS,
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.SETTINGS, ACTION.VIEW),
)

// ─── PUT ──────────────────────────────────────────────────
// Upsert 4 grades × 3 bands = 12 rows

const meritRowSchema = z.object({
    gradeKey: z.enum(GRADE_KEYS),
    comparatioBand: z.enum(BAND_KEYS),
    minPct: z.number().min(0).max(100),
    maxPct: z.number().min(0).max(100),
    recommendedPct: z.number().min(0).max(100),
})

const putSchema = z.object({
    rows: z.array(meritRowSchema).min(1).max(12),
    companyId: z.string().uuid().optional(),
})

export const PUT = withPermission(
    async (req: NextRequest, _context, user: SessionUser) => {
        const body: unknown = await req.json()
        const parsed = putSchema.safeParse(body)
        if (!parsed.success) {
            throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
        }

        const companyId = resolveCompanyId(user, parsed.data.companyId)

        // Validate min <= recommended <= max
        for (const row of parsed.data.rows) {
            if (row.minPct > row.recommendedPct || row.recommendedPct > row.maxPct) {
                throw badRequest(`${row.gradeKey}/${row.comparatioBand}: min(${row.minPct}) <= recommended(${row.recommendedPct}) <= max(${row.maxPct}) 조건을 충족해야 합니다.`)
            }
        }

        try {
            // Use emsBlock as a dummy key for rows that use the new gradeKey system
            const results = await prisma.$transaction(
                parsed.data.rows.map((row) =>
                    prisma.salaryAdjustmentMatrix.upsert({
                        where: {
                            // Use combined lookup — we need a unique constraint workaround
                            id: `merit-${companyId}-${row.gradeKey}-${row.comparatioBand}`,
                        },
                        update: {
                            meritMinPct: row.minPct,
                            meritMaxPct: row.maxPct,
                            meritRecommendedPct: row.recommendedPct,
                        },
                        create: {
                            id: `merit-${companyId}-${row.gradeKey}-${row.comparatioBand}`,
                            companyId,
                            emsBlock: `MERIT_${row.gradeKey}_${row.comparatioBand}`,
                            recommendedIncreasePct: row.recommendedPct,
                            gradeKey: row.gradeKey,
                            comparatioBand: row.comparatioBand,
                            meritMinPct: row.minPct,
                            meritMaxPct: row.maxPct,
                            meritRecommendedPct: row.recommendedPct,
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
