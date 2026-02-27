// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/recruitment/interviews
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Validation Schemas ──────────────────────────────────

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  applicationId: z.string().uuid().optional(),
  postingId: z.string().uuid().optional(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
})

const createSchema = z.object({
  applicationId: z.string().uuid('유효한 지원서 ID를 입력해주세요.'),
  interviewerId: z.string().uuid('유효한 면접관 ID를 입력해주세요.'),
  scheduledAt: z.string().datetime('유효한 일시를 입력해주세요.'),
  durationMinutes: z.number().int().min(15).max(480).default(60),
  location: z.string().optional(),
  meetingLink: z.string().url().optional().or(z.literal('')),
  interviewType: z.enum(['PHONE', 'VIDEO', 'ONSITE', 'PANEL']).optional(),
  round: z.enum(['FIRST', 'SECOND', 'FINAL']).optional(),
})

// ─── GET /api/v1/recruitment/interviews ──────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, applicationId, postingId, status } = parsed.data

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN
        ? {}
        : { application: { posting: { companyId: user.companyId } } }

    const where = {
      ...companyFilter,
      ...(applicationId ? { applicationId } : {}),
      ...(postingId ? { application: { postingId, ...companyFilter.application } } : {}),
      ...(status ? { status } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.interviewSchedule.findMany({
        where,
        include: {
          application: {
            select: {
              id: true,
              postingId: true,
              applicant: {
                select: { id: true, name: true, email: true },
              },
              posting: {
                select: { id: true, title: true },
              },
            },
          },
          interviewer: {
            select: { id: true, name: true },
          },
          _count: {
            select: { interviewEvaluations: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
      }),
      prisma.interviewSchedule.count({ where }),
    ])

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)

// ─── POST /api/v1/recruitment/interviews ─────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const data = parsed.data

    // Verify the application exists and belongs to the user's company
    const application = await prisma.application.findFirst({
      where: {
        id: data.applicationId,
        ...(user.role === ROLE.SUPER_ADMIN
          ? {}
          : { posting: { companyId: user.companyId } }),
      },
      select: { id: true, posting: { select: { companyId: true } } },
    })

    if (!application) {
      throw badRequest('지원서를 찾을 수 없거나 접근 권한이 없습니다.')
    }

    try {
      const record = await prisma.interviewSchedule.create({
        data: {
          applicationId: data.applicationId,
          interviewerId: data.interviewerId,
          scheduledAt: new Date(data.scheduledAt),
          durationMinutes: data.durationMinutes,
          location: data.location ?? null,
          meetingLink: data.meetingLink || null,
          interviewType: data.interviewType ?? null,
          round: data.round ?? null,
          status: 'SCHEDULED',
        },
        include: {
          application: {
            select: {
              id: true,
              postingId: true,
              applicant: {
                select: { id: true, name: true, email: true },
              },
              posting: {
                select: { id: true, title: true },
              },
            },
          },
          interviewer: {
            select: { id: true, name: true },
          },
          _count: {
            select: { interviewEvaluations: true },
          },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'recruitment.interview.create',
        resourceType: 'interview_schedule',
        resourceId: record.id,
        companyId: application.posting.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(record, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.CREATE),
)
