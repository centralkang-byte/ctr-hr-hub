// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Employee Performance History
// GET /api/v1/performance/reviews/my-history
//
// 과거 사이클 대비 성과 추이 데이터 (성장 여정 시각화용)
// Data Masking: originalGrade, calibrationNote 미포함
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { getGradeLabel } from '@/lib/performance/data-masking'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/performance/reviews/my-history ─────────

export const GET = withPermission(
    async (_req: NextRequest, _context, user: SessionUser) => {
        try {
            const reviews = await prisma.performanceReview.findMany({
                where: {
                    employeeId: user.employeeId,
                    companyId: user.companyId,
                    // 확정된 결과만 (통보 이후)
                    notifiedAt: { not: null },
                },
                select: {
                    id: true,
                    finalGrade: true,
                    mboScore: true,
                    beiScore: true,
                    totalScore: true,
                    cycle: {
                        select: { id: true, name: true, year: true, half: true },
                    },
                },
                orderBy: { cycle: { year: 'asc' } },
            })

            const history = reviews.map((r) => ({
                cycleId: r.cycle.id,
                cycleName: r.cycle.name,
                year: r.cycle.year,
                half: r.cycle.half,
                label: `${r.cycle.year} ${r.cycle.half}`,
                mboScore: r.mboScore ? Number(r.mboScore) : null,
                beiScore: r.beiScore ? Number(r.beiScore) : null,
                totalScore: r.totalScore ? Number(r.totalScore) : null,
                finalGrade: r.finalGrade,
                finalGradeLabel: getGradeLabel(r.finalGrade, 'ko'),
            }))

            return apiSuccess(history)
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
