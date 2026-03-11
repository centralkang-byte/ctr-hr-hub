// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Grade Scale Settings
// GET/PUT /api/v1/settings/performance/grade-scale
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

// Settings-connected: grade scale configuration (seed: PERFORMANCE/grade-scale)
// Returns hardcoded 4-grade system per design spec v1.1, customizable via TenantSetting.gradeLabels
const DEFAULT_GRADE_SCALE = {
    grades: [
        { key: 'E', labelKo: '탁월', labelEn: 'Exceeds', guidePct: 10, description: '기대를 크게 상회하는 성과' },
        { key: 'M_PLUS', labelKo: '우수', labelEn: 'Meets+', guidePct: 30, description: '기대를 충족하며 일부 영역에서 상회' },
        { key: 'M', labelKo: '보통', labelEn: 'Meets', guidePct: 50, description: '기대 수준을 충족하는 안정적 성과' },
        { key: 'B', labelKo: '미흡', labelEn: 'Below', guidePct: 10, description: '기대에 미달. 개선 계획(PIP) 대상' },
    ],
    totalGrades: 4,
    isForcedDistribution: false,
}

// ─── GET ──────────────────────────────────────────────────
export const GET = withPermission(
    async (req: NextRequest, _context, user: SessionUser) => {
        const companyId = resolveCompanyId(
            user,
            req.nextUrl.searchParams.get('companyId'),
        )

        try {
            // Check for company-specific override in TenantSetting.gradeLabels
            const settings = await prisma.tenantSetting.findUnique({
                where: { companyId },
                select: { gradeLabels: true },
            })

            if (settings?.gradeLabels && typeof settings.gradeLabels === 'object') {
                return apiSuccess({
                    ...DEFAULT_GRADE_SCALE,
                    customLabels: settings.gradeLabels,
                    companyId,
                })
            }

            return apiSuccess({
                ...DEFAULT_GRADE_SCALE,
                companyId,
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.SETTINGS, ACTION.VIEW),
)

// ─── PUT ──────────────────────────────────────────────────
// Update grade labels via TenantSetting.gradeLabels

const updateSchema = z.object({
    gradeLabels: z.record(z.string(), z.string()),
    companyId: z.string().uuid().optional(),
})

export const PUT = withPermission(
    async (req: NextRequest, _context, user: SessionUser) => {
        const body: unknown = await req.json()
        const parsed = updateSchema.safeParse(body)
        if (!parsed.success) {
            throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
        }

        const companyId = resolveCompanyId(user, parsed.data.companyId)

        try {
            await prisma.tenantSetting.update({
                where: { companyId },
                data: { gradeLabels: parsed.data.gradeLabels },
            })

            return apiSuccess({ message: '등급 라벨이 업데이트되었습니다.' })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.SETTINGS, ACTION.UPDATE),
)
