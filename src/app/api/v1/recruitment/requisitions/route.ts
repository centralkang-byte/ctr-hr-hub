// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/recruitment/requisitions
// B4: 채용 요청 목록 조회 + 신규 생성
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import type { SessionUser } from '@/types'

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  companyId: z.string().uuid().optional(),
  status: z.string().optional(),
  urgency: z.string().optional(),
  myApprovals: z.coerce.boolean().default(false), // 나의 결재 대기만 조회
})

const createSchema = z.object({
  companyId: z.string().uuid(),
  departmentId: z.string().uuid(),
  title: z.string().min(1, '직무명을 입력해주세요.'),
  headcount: z.number().int().min(1).default(1),
  jobLevel: z.string().optional(),
  employmentType: z.enum(['permanent', 'contract', 'intern']),
  justification: z.string().min(1, '채용 사유를 입력해주세요.'),
  requirements: z.any().optional(),
  urgency: z.enum(['urgent', 'normal', 'low']).default('normal'),
  targetDate: z.string().optional(),
  positionId: z.string().uuid().optional(),
  submitForApproval: z.boolean().default(false), // true=결재요청, false=임시저장
})

// ─── GET /api/v1/recruitment/requisitions ──────────────────
export const GET = withPermission(
  async (req: NextRequest, _context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams)
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) throw badRequest(parsed.error.message)

    const { page, limit, companyId, status, urgency, myApprovals } = parsed.data
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (companyId) where.companyId = companyId
    if (status) where.status = status
    if (urgency) where.urgency = urgency

    // 나의 결재 대기: 현 단계의 결재 레코드가 자신 것인 요청만
    if (myApprovals) {
      where.approvalRecords = {
        some: {
          approverId: user.id,
          status: 'pending',
        },
      }
    }

    const [total, items] = await Promise.all([
      prisma.requisition.count({ where }),
      prisma.requisition.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          requester: { select: { id: true, name: true, nameEn: true } },
          position: { select: { id: true, titleKo: true, titleEn: true } },
          approvalRecords: {
            orderBy: { stepOrder: 'asc' },
            include: {
              approver: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ])

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)

// ─── POST /api/v1/recruitment/requisitions ─────────────────
export const POST = withPermission(
  async (req: NextRequest, _context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)

    const {
      companyId,
      departmentId,
      title,
      headcount,
      jobLevel,
      employmentType,
      justification,
      requirements,
      urgency,
      targetDate,
      positionId,
      submitForApproval,
    } = parsed.data

    try {
      // 채용 요청 번호 생성 (REQ-YYYYMM-NNN)
      const now = new Date()
      const prefix = `REQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
      const lastReq = await prisma.requisition.findFirst({
        where: { reqNumber: { startsWith: prefix } },
        orderBy: { reqNumber: 'desc' },
      })
      const seq = lastReq
        ? parseInt(lastReq.reqNumber.split('-')[2] ?? '0') + 1
        : 1
      const reqNumber = `${prefix}-${String(seq).padStart(3, '0')}`

      // 결재 플로우 결정 (urgency에 따라)
      const flowName =
        urgency === 'urgent' ? '임원급 채용' : '일반 채용 승인'
      const approvalFlow = await prisma.approvalFlow.findFirst({
        where: { module: 'recruitment', name: flowName, isActive: true },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      })

      const status = submitForApproval ? 'pending' : 'draft'
      const currentStep = submitForApproval ? 1 : 0

      const requisition = await prisma.requisition.create({
        data: {
          reqNumber,
          companyId,
          departmentId,
          requesterId: user.id,
          positionId: positionId ?? null,
          title,
          headcount,
          jobLevel: jobLevel ?? null,
          employmentType,
          justification,
          requirements: requirements ?? null,
          urgency,
          targetDate: targetDate ? new Date(targetDate) : null,
          status,
          currentStep,
          approvalFlowId: approvalFlow?.id ?? null,
          // 결재 요청 시 승인 레코드 생성
          ...(submitForApproval && approvalFlow
            ? {
                approvalRecords: {
                  create: approvalFlow.steps.map((step) => ({
                    stepOrder: step.stepOrder,
                    approverRole: step.approverRole ?? 'hr_admin',
                    status: 'pending',
                  })),
                },
              }
            : {}),
        },
        include: {
          company: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          approvalRecords: { orderBy: { stepOrder: 'asc' } },
        },
      })

      return apiSuccess(requisition, 201)
    } catch (err) {
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.CREATE),
)
