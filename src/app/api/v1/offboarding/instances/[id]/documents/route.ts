// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/offboarding/instances/[id]/documents
// 오프보딩 문서 수집 (동의서, 인계 문서, NDA 등)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/offboarding/instances/[id]/documents ────

export const GET = withPermission(
    async (_req: NextRequest, ctx, user: SessionUser) => {
        const { id } = await ctx.params

        const offboarding = await prisma.employeeOffboarding.findFirst({
            where: {
                id,
                ...(user.role !== ROLE.SUPER_ADMIN
                    ? { employee: { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } } }
                    : {}),
            },
            select: { id: true },
        })

        if (!offboarding) throw notFound('오프보딩 기록을 찾을 수 없습니다.')

        const documents = await prisma.offboardingDocument.findMany({
            where: { offboardingId: id },
            include: {
                uploadedBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        })

        return apiSuccess(documents)
    },
    perm(MODULE.OFFBOARDING, ACTION.VIEW),
)

// ─── POST Schema ─────────────────────────────────────────

const createSchema = z.object({
    type: z.enum(['CONSENT', 'HANDOVER', 'EXIT', 'NDA', 'OTHER']),
    fileName: z.string().min(1, '파일 이름을 입력해주세요.'),
    fileKey: z.string().min(1, '파일 키를 입력해주세요.'),
    fileSize: z.number().int().positive().optional(),
})

// ─── POST /api/v1/offboarding/instances/[id]/documents ───

export const POST = withPermission(
    async (req: NextRequest, ctx, user: SessionUser) => {
        const { id } = await ctx.params

        const offboarding = await prisma.employeeOffboarding.findFirst({
            where: {
                id,
                ...(user.role !== ROLE.SUPER_ADMIN
                    ? { employee: { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } } }
                    : {}),
            },
            select: { id: true, status: true },
        })

        if (!offboarding) throw notFound('오프보딩 기록을 찾을 수 없습니다.')

        const body: unknown = await req.json()
        const parsed = createSchema.safeParse(body)
        if (!parsed.success) {
            throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
        }

        try {
            const doc = await prisma.offboardingDocument.create({
                data: {
                    offboardingId: id,
                    type: parsed.data.type,
                    fileName: parsed.data.fileName,
                    fileKey: parsed.data.fileKey,
                    fileSize: parsed.data.fileSize ?? null,
                    uploadedById: user.employeeId,
                },
                include: {
                    uploadedBy: { select: { id: true, name: true } },
                },
            })

            const { ip, userAgent } = extractRequestMeta(req.headers)
            logAudit({
                actorId: user.employeeId,
                action: 'offboarding.document.upload',
                resourceType: 'offboarding_document',
                resourceId: doc.id,
                companyId: user.companyId,
                changes: { type: parsed.data.type, fileName: parsed.data.fileName },
                ip,
                userAgent,
            })

            return apiSuccess(doc, 201)
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.OFFBOARDING, ACTION.UPDATE),
)
