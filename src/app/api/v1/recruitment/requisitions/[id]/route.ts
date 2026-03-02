// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PATCH /api/v1/recruitment/requisitions/[id]
// B4: 채용 요청 상세 조회 + 수정
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  headcount: z.number().int().min(1).optional(),
  jobLevel: z.string().optional(),
  employmentType: z.enum(['permanent', 'contract', 'intern']).optional(),
  justification: z.string().optional(),
  requirements: z.any().optional(),
  urgency: z.enum(['urgent', 'normal', 'low']).optional(),
  targetDate: z.string().optional(),
  positionId: z.string().uuid().optional().nullable(),
  status: z.enum(['cancelled']).optional(), // 취소만 허용
})

// ─── GET ────────────────────────────────────────────────────
export const GET = withPermission(
  async (_req: NextRequest, { params }: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const { id } = await params

    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        requester: {
          select: { id: true, name: true, nameEn: true, photoUrl: true },
        },
        position: { select: { id: true, titleKo: true, titleEn: true, code: true } },
        approvalRecords: {
          orderBy: { stepOrder: 'asc' },
          include: {
            approver: { select: { id: true, name: true, photoUrl: true } },
          },
        },
        jobPostings: {
          select: { id: true, title: true, status: true, postedAt: true },
        },
      },
    })

    if (!requisition) throw notFound('채용 요청을 찾을 수 없습니다.')
    return apiSuccess(requisition)
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)

// ─── PATCH ──────────────────────────────────────────────────
export const PATCH = withPermission(
  async (req: NextRequest, { params }: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const { id } = await params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)

    const existing = await prisma.requisition.findUnique({ where: { id } })
    if (!existing) throw notFound('채용 요청을 찾을 수 없습니다.')

    // draft 상태에서만 수정 가능
    if (existing.status !== 'draft' && !parsed.data.status) {
      throw badRequest('결재 중인 채용 요청은 수정할 수 없습니다.')
    }

    try {
      const updated = await prisma.requisition.update({
        where: { id },
        data: {
          ...(parsed.data.title && { title: parsed.data.title }),
          ...(parsed.data.headcount && { headcount: parsed.data.headcount }),
          ...(parsed.data.jobLevel !== undefined && { jobLevel: parsed.data.jobLevel }),
          ...(parsed.data.employmentType && { employmentType: parsed.data.employmentType }),
          ...(parsed.data.justification && { justification: parsed.data.justification }),
          ...(parsed.data.requirements !== undefined && { requirements: parsed.data.requirements }),
          ...(parsed.data.urgency && { urgency: parsed.data.urgency }),
          ...(parsed.data.targetDate && { targetDate: new Date(parsed.data.targetDate) }),
          ...(parsed.data.positionId !== undefined && { positionId: parsed.data.positionId }),
          ...(parsed.data.status && { status: parsed.data.status }),
        },
      })
      return apiSuccess(updated)
    } catch (err) {
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)
